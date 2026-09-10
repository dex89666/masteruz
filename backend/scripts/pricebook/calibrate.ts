// ============================================
// MasterUz — Ночная калибровка прайса
// ============================================
//
// Собирает наблюдения из закрытых заказов и ставок мастеров, затем двигает
// цены позиций к медиане рынка. Задуман как ночной cron:
//
//   0 4 * * *  cd /app/backend && npm run pricebook:calibrate
//
// Запуск:
//   npx tsx scripts/pricebook/calibrate.ts
//   npx tsx scripts/pricebook/calibrate.ts --dry     посчитать, но не записывать
//   npx tsx scripts/pricebook/calibrate.ts --window 180
//
// Сухой прогон стоит делать первым: он показывает, что именно изменится,
// и на маленькой истории обычно оказывается, что менять нечего.

import { prisma } from '../../src/config/database.js';
import {
  collectObservations,
  calibratePrices,
  CALIBRATION_WINDOW_DAYS,
  MIN_SAMPLE_SIZE,
  MAX_STEP_RATIO,
} from '../../src/services/priceCalibrationService.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const windowIndex = args.indexOf('--window');
const WINDOW = windowIndex >= 0 ? parseInt(args[windowIndex + 1], 10) || CALIBRATION_WINDOW_DAYS : CALIBRATION_WINDOW_DAYS;

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n));
const pct = (from: number, to: number) => `${to > from ? '+' : ''}${Math.round(((to - from) / from) * 100)}%`;

async function main() {
  console.log(`\n📊 Калибровка прайса${DRY ? ' (сухой прогон)' : ''} — окно ${WINDOW} дней\n`);

  const collected = await collectObservations(WINDOW);
  console.log(`  Просмотрено заказов:        ${collected.ordersScanned}`);
  console.log(`  Наблюдений по факту:        ${collected.finalPriceObservations}`);
  console.log(`  Наблюдений по ставкам:      ${collected.masterOfferObservations}`);
  if (collected.skipped > 0) {
    console.log(`  Пропущено без состава сметы: ${collected.skipped}`);
  }

  const result = await calibratePrices({ dryRun: DRY, windowDays: WINDOW });

  console.log(`\n  Позиций с наблюдениями:     ${result.itemsConsidered}`);
  console.log(`  Мало наблюдений (< ${MIN_SAMPLE_SIZE}):     ${result.skippedTooFewSamples}`);
  console.log(`  Пауза после правки админа:  ${result.skippedManualCooldown}`);
  console.log(`  Изменение в пределах шума:  ${result.skippedSmallDelta}`);
  console.log(`  К изменению:                ${result.changed.length}`);

  if (result.changed.length > 0) {
    console.log(`\n  Изменения (шаг ограничен ${Math.round(MAX_STEP_RATIO * 100)}% за прогон):`);
    for (const c of [...result.changed].sort((a, b) => b.sampleSize - a.sampleSize).slice(0, 25)) {
      console.log(
        `    ${c.code}\n` +
          `        ${money(c.from)} → ${money(c.to)} (${pct(c.from, c.to)}), ` +
          `медиана ${money(c.median)}, P25–P75 ${money(c.p25)}–${money(c.p75)}, наблюдений ${c.sampleSize}`,
      );
    }
    if (result.changed.length > 25) console.log(`    …и ещё ${result.changed.length - 25}`);
  }

  if (result.version) {
    console.log(`\n✅ Записана версия прайса №${result.version}\n`);
  } else if (DRY) {
    console.log('\n✅ Сухой прогон завершён, база не изменялась\n');
  } else {
    console.log('\n✅ Изменений нет — прайс остался прежним\n');
  }
}

main()
  .catch((err) => {
    console.error('❌ Калибровка провалена:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
