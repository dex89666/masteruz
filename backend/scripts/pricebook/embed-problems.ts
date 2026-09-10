// ============================================
// MasterUz — Эмбеддинги проблем прайс-реестра
// ============================================
//
// Тонкая обёртка над embedProblems из pricebook.service: логика одна и та же
// и для локального прогона, и для кнопки в админ-панели. Две реализации
// неизбежно разошлись бы — ровно так сервис и получил два разных прайса.
//
// Запуск:
//   npx tsx scripts/pricebook/embed-problems.ts
//   npx tsx scripts/pricebook/embed-problems.ts --force   пересчитать все
//
// Прогон обращается к OpenAI, поэтому по умолчанию считаются только проблемы
// без вектора. Нужен OPENAI_API_KEY в окружении.

import { prisma } from '../../src/config/database.js';
import { embedProblems, getEmbeddingCoverage } from '../../src/modules/instant-order/pricebook.service.js';

const FORCE = process.argv.includes('--force');

async function main() {
  const before = await getEmbeddingCoverage();
  if (before.total === 0) {
    console.log('\n⚠ В реестре нет проблем. Сначала выполните: npm run pricebook:import\n');
    return;
  }

  console.log(`\n🧠 Эмбеддинги проблем${FORCE ? ' (пересчёт всех)' : ''}`);
  console.log(`  Сейчас посчитано: ${before.embedded} из ${before.total} (${before.coveragePct.toFixed(0)}%)\n`);

  const result = await embedProblems({ force: FORCE });

  console.log(`  Посчитано:  ${result.embedded}`);
  console.log(`  Пропущено:  ${result.skipped}`);
  if (result.failed.length > 0) {
    console.log(`  С ошибкой:  ${result.failed.length}`);
    for (const f of result.failed.slice(0, 10)) console.log(`      ${f.slug}: ${f.error}`);
  }

  const after = await getEmbeddingCoverage();
  console.log(`\n✅ Покрытие: ${after.embedded} из ${after.total} (${after.coveragePct.toFixed(0)}%)\n`);
}

main()
  .catch((err) => {
    console.error('❌ Прогон провален:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
