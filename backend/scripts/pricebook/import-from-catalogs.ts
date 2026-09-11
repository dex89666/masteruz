// ============================================
// MasterUz — Импорт прайс-реестра из каталогов
// ============================================
//
// Переносит два сегодняшних источника цен в таблицы price_* и фиксирует
// перенос как версию прайса. Идемпотентен: повторный запуск обновляет
// позиции по коду, а не плодит копии.
//
// Запуск:
//   npx tsx scripts/pricebook/import-from-catalogs.ts
//   npx tsx scripts/pricebook/import-from-catalogs.ts --dry
//   npx tsx scripts/pricebook/import-from-catalogs.ts --prune
//
//   --dry    показать, что изменится, ничего не записывая
//   --prune  деактивировать позиции, которых больше нет в каталогах
//            (не удаляет: на них могут ссылаться сохранённые сметы)

import { prisma } from '../../src/config/database.js';
import { buildPriceBookSeed, findPriceConflicts, type PriceBookSeed } from '../../src/modules/instant-order/pricebook.mapping.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const PRUNE = args.includes('--prune');

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n));

interface ChangeRecord {
  code: string;
  field: string;
  from: string | number | null;
  to: string | number;
}

async function importItems(seed: PriceBookSeed): Promise<{ created: number; updated: number; changes: ChangeRecord[] }> {
  const existing = await prisma.priceItem.findMany({
    select: { code: true, unitPrice: true, unit: true, name: true, isActive: true, source: true },
  });
  const byCode = new Map(existing.map((i) => [i.code, i]));

  // Позиции, уже подтянутые к реальным сделкам: их цену импорт не трогает,
  // иначе прогон откатил бы рыночные данные к экспертной оценке. Набор
  // берём одним запросом — прежде на каждую из 606 позиций уходил свой,
  // и импорт по удалённой базе тянулся минутами.
  const calibrated = new Set(
    existing.filter((i) => i.source === 'CALIBRATED').map((i) => i.code),
  );

  const changes: ChangeRecord[] = [];
  let created = 0;
  let updated = 0;

  for (const item of seed.items) {
    const prev = byCode.get(item.code);

    if (!prev) {
      created += 1;
      changes.push({ code: item.code, field: 'created', from: null, to: item.unitPrice });
    } else {
      const prevPrice = Number(prev.unitPrice);
      if (prevPrice !== item.unitPrice) {
        updated += 1;
        changes.push({ code: item.code, field: 'unitPrice', from: prevPrice, to: item.unitPrice });
      }
    }

    if (DRY) continue;

    await prisma.priceItem.upsert({
      where: { code: item.code },
      create: {
        code: item.code,
        name: item.name,
        nameUz: item.nameUz ?? null,
        nameEn: item.nameEn ?? null,
        unit: item.unit,
        kind: item.kind,
        unitPrice: item.unitPrice,
        minCheck: item.minCheck,
        laborMinutes: item.laborMinutes,
        categorySlug: item.categorySlug,
        taskSlug: item.taskSlug ?? null,
        source: 'EXPERT',
      },
      update: {
        name: item.name,
        nameUz: item.nameUz ?? null,
        nameEn: item.nameEn ?? null,
        unit: item.unit,
        kind: item.kind,
        laborMinutes: item.laborMinutes,
        categorySlug: item.categorySlug,
        taskSlug: item.taskSlug ?? null,
        isActive: true,
        ...(calibrated.has(item.code) ? {} : { unitPrice: item.unitPrice }),
      },
    });
  }

  return { created, updated, changes };
}

/**
 * Проблемы целиком выводятся из каталога в коде — админ их не создаёт.
 * Исчезнувшую из каталога проблему нужно снять с подбора, иначе прайс-движок
 * продолжит находить её по старым ключевым словам и со старыми ценами.
 */
function staleProblemsWhere(seed: PriceBookSeed) {
  return { isActive: true, slug: { notIn: seed.problems.map((p) => p.slug) } };
}

async function importProblems(
  seed: PriceBookSeed,
): Promise<{ problems: number; solutions: number; lines: number; deactivated: number }> {
  if (DRY) {
    return {
      problems: seed.problems.length,
      solutions: seed.problems.reduce((n, p) => n + p.solutions.length, 0),
      lines: seed.problems.reduce((n, p) => n + p.solutions.reduce((m, s) => m + s.lines.length, 0), 0),
      deactivated: await prisma.priceProblem.count({ where: staleProblemsWhere(seed) }),
    };
  }

  const itemIdByCode = new Map(
    (await prisma.priceItem.findMany({ select: { id: true, code: true } })).map((i) => [i.code, i.id]),
  );

  let solutions = 0;
  let lines = 0;

  for (const problem of seed.problems) {
    const saved = await prisma.priceProblem.upsert({
      where: { slug: problem.slug },
      create: {
        slug: problem.slug,
        categorySlug: problem.categorySlug,
        name: problem.name,
        keywords: problem.keywords,
        sortOrder: problem.sortOrder,
      },
      update: {
        categorySlug: problem.categorySlug,
        name: problem.name,
        keywords: problem.keywords,
        sortOrder: problem.sortOrder,
        isActive: true,
      },
    });

    for (const solution of problem.solutions) {
      const savedSolution = await prisma.priceSolution.upsert({
        where: { problemId_tier: { problemId: saved.id, tier: solution.tier } },
        create: {
          problemId: saved.id,
          tier: solution.tier,
          title: solution.title,
          description: solution.description,
          days: solution.days,
          materialClass: solution.materialClass,
        },
        update: {
          title: solution.title,
          description: solution.description,
          days: solution.days,
          materialClass: solution.materialClass,
        },
      });
      solutions += 1;

      // Состав решения перезаписываем целиком: позиции могли поменяться
      // местами или исчезнуть, а частичное обновление оставило бы мусор.
      await prisma.priceSolutionLine.deleteMany({ where: { solutionId: savedSolution.id } });
      for (const line of solution.lines) {
        const itemId = itemIdByCode.get(line.itemCode);
        if (!itemId) {
          console.warn(`  ⚠ позиция ${line.itemCode} не найдена — строка пропущена`);
          continue;
        }
        await prisma.priceSolutionLine.create({
          data: { solutionId: savedSolution.id, itemId, qty: line.qty, sortOrder: line.sortOrder },
        });
        lines += 1;
      }
    }
  }

  const stale = await prisma.priceProblem.updateMany({
    where: staleProblemsWhere(seed),
    data: { isActive: false },
  });

  return { problems: seed.problems.length, solutions, lines, deactivated: stale.count };
}

async function importModifiers(seed: PriceBookSeed): Promise<number> {
  if (DRY) return seed.modifiers.length;

  for (const modifier of seed.modifiers) {
    await prisma.priceModifier.upsert({
      where: { type_key: { type: modifier.type, key: modifier.key } },
      create: {
        type: modifier.type,
        key: modifier.key,
        label: modifier.label,
        factor: modifier.factor,
      },
      // Значение множителя — решение админа. Импорт обновляет только подпись,
      // иначе он затирал бы настройку рынка при каждом прогоне.
      update: { label: modifier.label },
    });
  }
  return seed.modifiers.length;
}

async function pruneMissing(seed: PriceBookSeed): Promise<number> {
  const codes = new Set(seed.items.map((i) => i.code));
  const stale = await prisma.priceItem.findMany({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  const toDeactivate = stale.filter((i) => !codes.has(i.code));
  if (toDeactivate.length === 0 || DRY) return toDeactivate.length;

  await prisma.priceItem.updateMany({
    where: { id: { in: toDeactivate.map((i) => i.id) } },
    data: { isActive: false },
  });
  return toDeactivate.length;
}

/** Печать расхождений, найденных при переносе. */
function reportPriceConflicts(seed: PriceBookSeed): void {
  const conflicts = findPriceConflicts(seed);
  if (conflicts.length === 0) return;

  console.log('\n  ⚠ Расхождения в ценах — проверьте в админке:');
  for (const conflict of conflicts) {
    console.log(`    ${conflict.subject}: ${money(conflict.min)} … ${money(conflict.max)} сум (${conflict.items.length} позиций)`);
    for (const item of conflict.items.slice(0, 6)) {
      console.log(`        ${money(item.price).padStart(9)} — ${item.name} [${item.categorySlug}]`);
    }
    if (conflict.items.length > 6) console.log(`        …и ещё ${conflict.items.length - 6}`);
  }
}

async function main() {
  console.log(`\n📕 Импорт прайс-реестра${DRY ? ' (сухой прогон)' : ''}\n`);

  const seed = buildPriceBookSeed();
  console.log(`  Каталоги дают: ${seed.items.length} позиций, ${seed.problems.length} проблем, ${seed.modifiers.length} множителей`);

  reportPriceConflicts(seed);

  const items = await importItems(seed);
  console.log(`  Позиции:    +${items.created} новых, ${items.updated} с изменённой ценой`);

  const structure = await importProblems(seed);
  console.log(`  Структура:  ${structure.problems} проблем, ${structure.solutions} решений, ${structure.lines} строк`);
  if (structure.deactivated > 0) {
    console.log(`  Снято с подбора устаревших проблем: ${structure.deactivated}`);
  }

  const modifiers = await importModifiers(seed);
  console.log(`  Множители:  ${modifiers}`);

  if (PRUNE) {
    const pruned = await pruneMissing(seed);
    console.log(`  Деактивировано отсутствующих позиций: ${pruned}`);
  }

  if (items.changes.length > 0) {
    console.log('\n  Изменения цен (первые 15):');
    for (const c of items.changes.slice(0, 15)) {
      const from = c.from === null ? '—' : money(Number(c.from));
      console.log(`    ${c.code}: ${from} → ${money(Number(c.to))}`);
    }
    if (items.changes.length > 15) console.log(`    …и ещё ${items.changes.length - 15}`);
  }

  if (!DRY) {
    const last = await prisma.priceBookVersion.findFirst({ orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    await prisma.priceBookVersion.create({
      data: {
        version,
        reason: 'Импорт из каталогов кода',
        changes: items.changes.slice(0, 500) as any,
        itemsTouched: items.created + items.updated,
      },
    });
    console.log(`\n✅ Записана версия прайса №${version}\n`);
  } else {
    console.log('\n✅ Сухой прогон завершён, база не изменялась\n');
  }
}

main()
  .catch((err) => {
    console.error('❌ Импорт провален:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
