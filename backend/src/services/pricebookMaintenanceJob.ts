// ============================================
// MasterUz — Обслуживание прайс-реестра
// ============================================
// Раз в сутки, без участия человека:
//   1. векторы для проблем, у которых их ещё нет, — после импорта нового
//      каталога подбор по смыслу подхватывает их сам, без ручного прогона
//      pricebook:embed;
//   2. наблюдения из закрытых заказов и ставок мастеров;
//   3. калибровка цен — по умолчанию сухим прогоном в логах. Двигать цены
//      по всему сервису начинает только PRICEBOOK_CALIBRATION_ENABLED=true.
//
// Калибровщик задумывался как ночной cron, но расписание так и не было
// заведено — наблюдения не собирались вовсе. Теперь оно живёт в бэкенде
// рядом с остальными фоновыми задачами.
// ============================================

import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withLock } from './distributedLock.js';
import { embedProblems } from '../modules/instant-order/pricebook.service.js';
import { collectObservations, calibratePrices } from './priceCalibrationService.js';

const LAST_RUN_KEY = 'pricebook_maintenance_at';
const TICK_INTERVAL_MS = 60 * 60_000;
const DUE_AFTER_MS = 23 * 60 * 60_000;
const LOCK_TTL_MS = 30 * 60_000;

let timer: NodeJS.Timeout | null = null;

async function lastRunAt(): Promise<Date | null> {
  const row = await prisma.platformConfig.findUnique({ where: { key: LAST_RUN_KEY } });
  if (!row?.value) return null;
  const at = new Date(row.value);
  return Number.isNaN(at.getTime()) ? null : at;
}

async function markRun(at: Date): Promise<void> {
  await prisma.platformConfig.upsert({
    where: { key: LAST_RUN_KEY },
    update: { value: at.toISOString() },
    create: {
      key: LAST_RUN_KEY,
      value: at.toISOString(),
      description: 'Время последнего обслуживания прайс-реестра (векторы, наблюдения, калибровка)',
    },
  });
}

export async function runPricebookMaintenance() {
  // Векторы считаются только для проблем без них — прогон стоит копейки и
  // ничего не делает, пока каталог не менялся.
  let embedded = 0;
  if (config.rag.enabled && config.openai.apiKey) {
    embedded = (await embedProblems({ force: false })).embedded;
  }

  const collected = await collectObservations();
  const calibrated = await calibratePrices({ dryRun: !config.pricebook.calibrationEnabled });
  return { embedded, collected, calibrated };
}

export async function runPricebookTick(): Promise<void> {
  const last = await lastRunAt();
  if (last && Date.now() - last.getTime() < DUE_AFTER_MS) return;

  const result = await runPricebookMaintenance();
  // Отметка — только после успешного прогона: иначе сбой спрятался бы до завтра.
  await markRun(new Date());

  logger.info(
    {
      embedded: result.embedded,
      observations: result.collected.finalPriceObservations + result.collected.masterOfferObservations,
      itemsToCalibrate: result.calibrated.changed.length,
      calibrationApplied: config.pricebook.calibrationEnabled,
      version: result.calibrated.version,
    },
    '📊 pricebook: обслуживание реестра завершено',
  );
}

export function startPricebookMaintenanceJob(): void {
  if (timer) return;
  if (!config.pricebook.maintenanceEnabled) {
    logger.info('pricebook: обслуживание реестра выключено (PRICEBOOK_MAINTENANCE_ENABLED=false)');
    return;
  }

  const tick = () =>
    withLock('cron:pricebook', LOCK_TTL_MS, runPricebookTick).catch((err) =>
      logger.error({ err: (err as Error)?.message ?? err }, 'pricebook: обслуживание реестра не удалось'),
    );

  // Со сдвигом относительно бэкапа, чтобы тяжёлые задачи не шли разом.
  setTimeout(tick, 6 * 60_000);
  timer = setInterval(tick, TICK_INTERVAL_MS);
  logger.info({ tickMs: TICK_INTERVAL_MS }, '📊 Pricebook maintenance job запущен');
}

export function stopPricebookMaintenanceJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
