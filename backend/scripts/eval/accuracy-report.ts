// ============================================
// MasterUz — Отчёт о точности AI на реальных заказах
// ============================================
//
// Сравнивает снимок прогноза (orders.ai_predicted_*) с фактическим итогом
// заказа (price, categoryId после закрытия). Это и есть контур самообучения:
// каждый закрытый заказ автоматически становится обучающим примером,
// ручная разметка не нужна.
//
// Показывает динамику по месяцам — видно, улучшается система или деградирует
// после смены модели/промпта.
//
// Запуск:
//   npx tsx scripts/eval/accuracy-report.ts
//   npx tsx scripts/eval/accuracy-report.ts --days 30

import { prisma } from '../../src/config/database.js';
import { toNum } from '../../src/utils/helpers.js';
import { computeStats, getCalibrationCoverage } from '../../src/services/priceAccuracyService.js';

interface Row {
  id: string;
  predicted: number;
  actual: number;
  predictedCategoryId: string | null;
  actualCategoryId: string;
  confidence: number | null;
  model: string | null;
  completedAt: Date | null;
}

// Арифметику метрик держит priceAccuracyService — она же питает админ-панель.
// Две реализации одних и тех же цифр неизбежно разъезжаются: ровно так
// сервис и получил два разных прайса.
function stats(rows: Row[]) {
  const s = computeStats(rows);
  if (!s) return null;
  return {
    n: s.n,
    mae: s.mae,
    bias: s.bias,
    within20Pct: s.within20Pct,
    grossPct: s.grossPct,
    catAccPct: s.categoryAccuracyPct,
    mape: s.mape,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ru');
}

function printBlock(title: string, s: ReturnType<typeof stats>) {
  if (!s) {
    console.log(`\n${title}: нет данных`);
    return;
  }
  console.log(`\n${title}  (кейсов: ${s.n})`);
  console.log(`  категория угадана     : ${s.catAccPct.toFixed(1)}%`);
  console.log(`  цена в пределах ±20%  : ${s.within20Pct.toFixed(1)}%`);
  console.log(`  грубые промахи (>50%) : ${s.grossPct.toFixed(1)}%`);
  console.log(`  средняя ошибка (MAPE) : ${s.mape.toFixed(1)}%`);
  console.log(`  MAE                   : ${fmt(s.mae)} сум`);
  console.log(
    `  смещение              : ${s.bias >= 0 ? '+' : ''}${fmt(s.bias)} сум ` +
      `(${s.bias >= 0 ? 'завышает' : 'занижает'})`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const days = args.includes('--days') ? Number(args[args.indexOf('--days') + 1]) : null;

  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      aiPredictedAt: { not: null },
      ...(days ? { completedAt: { gte: new Date(Date.now() - days * 86400_000) } } : {}),
    },
    select: {
      id: true,
      price: true,
      categoryId: true,
      aiPredictedPrice: true,
      aiPredictedCategoryId: true,
      aiConfidence: true,
      aiModel: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const rows: Row[] = orders
    .filter((o) => o.aiPredictedPrice != null && toNum(o.price) > 0)
    .map((o) => ({
      id: o.id,
      predicted: toNum(o.aiPredictedPrice),
      actual: toNum(o.price),
      predictedCategoryId: o.aiPredictedCategoryId,
      actualCategoryId: o.categoryId,
      confidence: o.aiConfidence,
      model: o.aiModel,
      completedAt: o.completedAt,
    }));

  console.log('═'.repeat(70));
  console.log('ТОЧНОСТЬ AI НА РЕАЛЬНЫХ ЗАКАЗАХ');
  console.log('═'.repeat(70));
  console.log(`Закрытых заказов с прогнозом: ${rows.length}`);

  if (!rows.length) {
    console.log(
      '\nПока нет закрытых заказов с прогнозом AI.\n' +
        'Снимок пишется автоматически при создании AI-заказа (миграция 0025),\n' +
        'метрики появятся сами, как только заказы начнут закрываться.\n' +
        'До этого используйте bootstrap-набор: scripts/eval/run-eval.ts',
    );
    await prisma.$disconnect();
    return;
  }

  printBlock('ВСЕГО', stats(rows));

  // По моделям — видно, дала ли смена модели реальный выигрыш.
  const byModel = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.model ?? 'неизвестна';
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key)!.push(r);
  }
  if (byModel.size > 1) {
    console.log('\n' + '─'.repeat(70));
    console.log('ПО МОДЕЛЯМ');
    for (const [model, list] of byModel) printBlock(`  ${model}`, stats(list));
  }

  // По месяцам — динамика: становится ли система лучше.
  const byMonth = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.completedAt ? r.completedAt.toISOString().slice(0, 7) : 'без даты';
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  if (byMonth.size > 1) {
    console.log('\n' + '─'.repeat(70));
    console.log('ДИНАМИКА ПО МЕСЯЦАМ (растёт ±20% — система учится)');
    console.log('месяц'.padEnd(12) + 'кейсов'.padEnd(10) + '±20%'.padEnd(10) + 'категория'.padEnd(12) + 'MAE');
    for (const [month, list] of [...byMonth].sort()) {
      const s = stats(list)!;
      console.log(
        month.padEnd(12) +
          String(s.n).padEnd(10) +
          `${s.within20Pct.toFixed(0)}%`.padEnd(10) +
          `${s.catAccPct.toFixed(0)}%`.padEnd(12) +
          fmt(s.mae),
      );
    }
  }

  // Худшие промахи — именно их стоит разобрать руками и добавить в knowledge base.
  const worst = [...rows]
    .sort((a, b) => Math.abs(b.predicted - b.actual) / b.actual - Math.abs(a.predicted - a.actual) / a.actual)
    .slice(0, 5);
  console.log('\n' + '─'.repeat(70));
  console.log('ХУДШИЕ ПРОМАХИ (разберите их — это точки роста)');
  for (const r of worst) {
    const pct = ((Math.abs(r.predicted - r.actual) / r.actual) * 100).toFixed(0);
    console.log(`  ${r.id}  прогноз ${fmt(r.predicted)} → факт ${fmt(r.actual)}  (±${pct}%)`);
  }
  // Опирается ли прайс на сделки или всё ещё на экспертную оценку.
  const coverage = await getCalibrationCoverage();
  console.log('\n' + '─'.repeat(70));
  console.log('ОПОРА ПРАЙСА НА РЕАЛЬНЫЕ СДЕЛКИ');
  console.log(`  позиций работ в реестре   : ${coverage.totalItems}`);
  console.log(`  из них откалибровано      : ${coverage.calibratedItems} (${coverage.coveragePct.toFixed(1)}%)`);
  console.log(`  наблюдений за 90 дней     : ${coverage.observations90d}`);
  console.log(
    `  последняя калибровка      : ${coverage.lastCalibratedAt ? coverage.lastCalibratedAt.toISOString().slice(0, 10) : 'не проводилась'}`,
  );
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
