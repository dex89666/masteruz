// ============================================
// MasterUz — Эмбеддинги проблем прайс-реестра
// ============================================
//
// Без векторов подбор работ идёт по ключевым словам: «не держит воду»
// не находит протечку, потому что ни одного общего слова нет. Эмбеддинг
// строится из названия проблемы, её ключевых слов и заголовков решений —
// то есть из всего, чем проблема описана.
//
// Запуск:
//   npx tsx scripts/pricebook/embed-problems.ts
//   npx tsx scripts/pricebook/embed-problems.ts --force   пересчитать все
//
// Прогон стоит денег (OpenAI Embeddings), поэтому по умолчанию считаются
// только проблемы без вектора.

import { prisma } from '../../src/config/database.js';
import { getEmbedding, toVectorLiteral } from '../../src/services/embeddingService.js';

const FORCE = process.argv.includes('--force');

/** Текст, который векторизуется. Одно правило для записи и для поиска. */
function problemText(p: { name: string; keywords: string[]; solutions: { title: string }[] }): string {
  return [p.name, p.keywords.join(', '), p.solutions.map((s) => s.title).join('. ')]
    .filter(Boolean)
    .join('. ');
}

async function main() {
  const problems = await prisma.priceProblem.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, keywords: true, solutions: { select: { title: true } } },
    orderBy: { slug: 'asc' },
  });

  if (problems.length === 0) {
    console.log('\n⚠ В реестре нет проблем. Сначала выполните: npm run pricebook:import\n');
    return;
  }

  // Какие уже посчитаны — отдельным запросом: Prisma не умеет читать vector.
  const withVector = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "price_problems" WHERE "embedding" IS NOT NULL`,
  );
  const done = new Set(withVector.map((r) => r.id));

  const todo = FORCE ? problems : problems.filter((p) => !done.has(p.id));
  console.log(`\n🧠 Эмбеддинги проблем: ${todo.length} из ${problems.length}${FORCE ? ' (пересчёт всех)' : ''}\n`);

  let ok = 0;
  let failed = 0;

  for (const problem of todo) {
    try {
      const vector = await getEmbedding(problemText(problem));
      await prisma.$executeRawUnsafe(
        `UPDATE "price_problems" SET "embedding" = $1::vector WHERE "id" = $2`,
        toVectorLiteral(vector),
        problem.id,
      );
      ok += 1;
      process.stdout.write(`  ✓ ${problem.slug}\n`);
    } catch (err) {
      failed += 1;
      process.stdout.write(`  ✗ ${problem.slug}: ${(err as Error).message}\n`);
    }
  }

  console.log(`\n✅ Готово: ${ok} посчитано, ${failed} с ошибкой\n`);
}

main()
  .catch((err) => {
    console.error('❌ Прогон провален:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
