// ============================================
// MasterUz — Паритет старого и нового расчёта
// ============================================
//
// Гейт перед включением PRICEBOOK_ENABLED. Реестр наполнен переносом из
// каталога в коде, значит на одних и тех же запросах оба пути обязаны
// давать одну и ту же цену. Любое расхождение — это либо потеря позиций
// при переносе, либо ошибка в калькуляторе, и увидеть её нужно ДО того,
// как по новым ценам начнут блокировать деньги в эскроу.
//
// Проверка идёт по всем проблемам каталога: описание собирается из
// ключевых слов самой проблемы, поэтому набор кейсов не выдуман руками,
// а покрывает ровно то, что умеет система.
//
// Запуск:
//   npx tsx scripts/pricebook/parity-check.ts
//   npx tsx scripts/pricebook/parity-check.ts --tolerance 2
//   npx tsx scripts/pricebook/parity-check.ts --verbose

process.env.PRICEBOOK_ENABLED = 'true';

import { prisma } from '../../src/config/database.js';
import { PRICING_CATALOG, buildSmartVariants } from '../../src/modules/instant-order/pricing-catalog.js';
import { buildVariantsFromPriceBook } from '../../src/modules/instant-order/pricebook.service.js';
import { buildPriceBookSeed } from '../../src/modules/instant-order/pricebook.mapping.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const toleranceIndex = args.indexOf('--tolerance');
/** Допустимое расхождение в процентах. По умолчанию — ноль: пути обязаны совпасть. */
const TOLERANCE_PCT = toleranceIndex >= 0 ? Number(args[toleranceIndex + 1]) || 0 : 0;

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

interface Mismatch {
  category: string;
  problem: string;
  description: string;
  tier: string;
  old: number;
  fresh: number;
  diffPct: number;
}

async function main() {
  console.log('\n🔍 Паритет: каталог в коде против прайс-реестра\n');
  console.log(`  Допуск: ${TOLERANCE_PCT}%\n`);

  const mismatches: Mismatch[] = [];
  const notFoundInBook: string[] = [];
  const notFoundInCatalog: string[] = [];
  let compared = 0;
  let casesChecked = 0;

  for (const category of PRICING_CATALOG) {
    for (const problem of category.problems) {
      // Описание из ключевых слов самой проблемы: так проверяются те же
      // формулировки, по которым система и подбирает решение.
      const description = problem.keywords.slice(0, 3).join(' ');
      casesChecked += 1;

      const oldResult = buildSmartVariants(category.slug, category.name, description);
      const freshResult = await buildVariantsFromPriceBook({
        categorySlug: category.slug,
        description,
      });

      if (!oldResult && !freshResult) continue;
      if (!oldResult) {
        notFoundInCatalog.push(`${category.slug} / ${problem.problemName}`);
        continue;
      }
      if (!freshResult) {
        notFoundInBook.push(`${category.slug} / ${problem.problemName}`);
        continue;
      }

      for (const oldVariant of oldResult.variants) {
        const freshVariant = freshResult.variants.find((v) => v.tier === oldVariant.tier);
        if (!freshVariant) {
          mismatches.push({
            category: category.slug,
            problem: problem.problemName,
            description,
            tier: oldVariant.tier,
            old: oldVariant.estimatedPrice,
            fresh: 0,
            diffPct: 100,
          });
          continue;
        }

        compared += 1;
        const diff = Math.abs(freshVariant.estimatedPrice - oldVariant.estimatedPrice);
        const diffPct = oldVariant.estimatedPrice > 0 ? (diff / oldVariant.estimatedPrice) * 100 : 0;

        if (diffPct > TOLERANCE_PCT) {
          mismatches.push({
            category: category.slug,
            problem: problem.problemName,
            description,
            tier: oldVariant.tier,
            old: oldVariant.estimatedPrice,
            fresh: freshVariant.estimatedPrice,
            diffPct,
          });
        } else if (VERBOSE) {
          console.log(
            `  ✓ ${category.slug} / ${problem.problemName} [${oldVariant.tier}] ${money(oldVariant.estimatedPrice)}`,
          );
        }
      }
    }
  }

  // Проблема, которой больше нет в каталоге, но которая активна в реестре,
  // продолжит подбираться по старым ключевым словам со старыми ценами.
  const codeSlugs = new Set(buildPriceBookSeed().problems.map((p) => p.slug));
  const staleInBook = (
    await prisma.priceProblem.findMany({ where: { isActive: true }, select: { slug: true } })
  )
    .map((p) => p.slug)
    .filter((slug) => !codeSlugs.has(slug));

  console.log(`  Проверено проблем:   ${casesChecked}`);
  console.log(`  Сравнено вариантов:  ${compared}`);
  console.log(`  Расхождений:         ${mismatches.length}`);

  if (notFoundInBook.length > 0) {
    console.log(`\n  ⚠ Проблема есть в коде, но не найдена в реестре (${notFoundInBook.length}):`);
    for (const p of notFoundInBook.slice(0, 15)) console.log(`      ${p}`);
    if (notFoundInBook.length > 15) console.log(`      …и ещё ${notFoundInBook.length - 15}`);
  }

  if (notFoundInCatalog.length > 0) {
    console.log(`\n  ⚠ Проблема есть в реестре, но не найдена в коде (${notFoundInCatalog.length}):`);
    for (const p of notFoundInCatalog.slice(0, 15)) console.log(`      ${p}`);
  }

  if (mismatches.length > 0) {
    console.log('\n  ❌ Расхождения в ценах:');
    for (const m of mismatches.slice(0, 30)) {
      console.log(
        `      ${m.category} / ${m.problem} [${m.tier}]\n` +
          `          каталог ${money(m.old)} → реестр ${money(m.fresh)}  (${m.diffPct.toFixed(1)}%)`,
      );
    }
    if (mismatches.length > 30) console.log(`      …и ещё ${mismatches.length - 30}`);
  }

  if (staleInBook.length > 0) {
    console.log(`\n  ⚠ В реестре активны проблемы, которых нет в каталоге (${staleInBook.length}):`);
    for (const slug of staleInBook) console.log(`      ${slug}`);
    console.log('      Выполните npm run pricebook:import — устаревшие проблемы будут сняты с подбора.');
  }

  const blocking = mismatches.length > 0 || notFoundInBook.length > 0 || staleInBook.length > 0;
  if (blocking) {
    console.log('\n❌ Паритет НЕ достигнут — включать PRICEBOOK_ENABLED рано\n');
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Паритет достигнут: оба пути дают одинаковые цены\n');
}

main()
  .catch((err) => {
    console.error('❌ Проверка провалена:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
