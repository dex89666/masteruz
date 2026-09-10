// ════════════════════════════════════════════════════════════════
// MasterUz — Калибровка прайса по реальным сделкам
// ────────────────────────────────────────────────────────────────
// Экспертная цена стареет. Рынок при этом уже говорит о себе двумя
// голосами, и оба лежат в базе с первого дня:
//
//   1. OrderResponse.priceOffer — сколько мастера ПРОСЯТ за заказ.
//      Сигнал предложения: появляется сразу, ещё до сделки.
//   2. Order.price после закрытия — сколько за него ЗАПЛАТИЛИ.
//      Сигнал сделки: медленнее, но весомее.
//
// Обе суммы относятся к заказу целиком, а калибровать нужно позиции
// прайса. Раскладка идёт через состав сметы (AiOrderTemplate.priceLines):
// материалы считаются транзитом по каталожной цене, всё расхождение
// относится на труд. Это то же правило, по которому смета и собиралась.
//
// Осторожность встроена в три места:
//   • минимум наблюдений — одна сделка не двигает цену;
//   • шаг за прогон ограничен — выброс не уводит прайс за ночь;
//   • после ручной правки выдерживается пауза.
// ════════════════════════════════════════════════════════════════

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { invalidatePriceBookCache } from '../modules/instant-order/pricebook.service.js';

/** Окно наблюдений: цены старше устаревают быстрее, чем накапливается выборка. */
export const CALIBRATION_WINDOW_DAYS = 90;
/** Минимум наблюдений по позиции — ниже него выборка ничего не значит. */
export const MIN_SAMPLE_SIZE = 5;
/** Максимальный шаг изменения цены за один прогон. */
export const MAX_STEP_RATIO = 0.15;
/** Изменения меньше этого не вносим — не гоняем прайс по шуму. */
export const MIN_DELTA_RATIO = 0.03;
/** Пауза после ручной правки админа, дней. */
export const MANUAL_EDIT_COOLDOWN_DAYS = 30;
/** Отношение факта к смете, за пределами которого заказ считается негодным. */
const SANE_RATIO = { min: 0.3, max: 3 };
/** Вес сделки против ставки мастера при расчёте медианы. */
const WEIGHT = { FINAL_PRICE: 2, MASTER_OFFER: 1 };

interface PriceLine {
  code: string;
  kind: 'LABOR' | 'MATERIAL';
  qty: number;
  unitPrice: number;
  total: number;
}

/** Разбор priceLines из шаблона: поле хранится как Json и приходит любым. */
function parsePriceLines(raw: unknown): PriceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l: any) => l && typeof l.code === 'string' && Number.isFinite(Number(l.unitPrice)))
    .map((l: any) => ({
      code: l.code,
      kind: l.kind === 'MATERIAL' ? 'MATERIAL' : 'LABOR',
      qty: Number(l.qty) || 1,
      unitPrice: Number(l.unitPrice) || 0,
      total: Number(l.total) || Number(l.qty) * Number(l.unitPrice) || 0,
    }));
}

/**
 * Разложить фактическую сумму заказа по позициям сметы.
 *
 * Материалы идут транзитом по каталожной цене; всё расхождение между
 * сметой и фактом относится на труд. Иначе получилось бы, что герметик
 * подорожал оттого, что мастер взял дороже за работу.
 */
export function allocateToLines(
  lines: PriceLine[],
  actualTotal: number,
): { code: string; qty: number; unitPrice: number }[] {
  const labor = lines.filter((l) => l.kind === 'LABOR');
  const estimatedLabor = labor.reduce((s, l) => s + l.total, 0);
  const estimatedMaterials = lines.filter((l) => l.kind === 'MATERIAL').reduce((s, l) => s + l.total, 0);

  if (estimatedLabor <= 0) return [];

  const actualLabor = actualTotal - estimatedMaterials;
  if (actualLabor <= 0) return [];

  const ratio = actualLabor / estimatedLabor;
  if (ratio < SANE_RATIO.min || ratio > SANE_RATIO.max) return [];

  return labor
    .filter((l) => l.qty > 0)
    .map((l) => ({
      code: l.code,
      qty: l.qty,
      unitPrice: Math.round(l.unitPrice * ratio),
    }));
}

/** Медиана обычная. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Квантиль по методу ближайшего ранга — без интерполяции, устойчиво на малых выборках. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

/**
 * Взвешенная медиана: закрытая сделка весит больше, чем ставка мастера.
 * Вес реализован повторением значения — на выборках такого размера это
 * и точнее, и понятнее любой хитрой формулы.
 */
export function weightedMedian(samples: { value: number; weight: number }[]): number {
  const expanded: number[] = [];
  for (const s of samples) {
    for (let i = 0; i < Math.max(1, Math.round(s.weight)); i++) expanded.push(s.value);
  }
  return median(expanded);
}

// ─── Шаг 1: сбор наблюдений ──────────────────────────────────────

export interface CollectResult {
  ordersScanned: number;
  finalPriceObservations: number;
  masterOfferObservations: number;
  skipped: number;
}

/**
 * Разложить закрытые заказы и ставки мастеров по позициям прайса.
 * Идемпотентно: повторный прогон обновляет существующие наблюдения.
 */
export async function collectObservations(windowDays = CALIBRATION_WINDOW_DAYS): Promise<CollectResult> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const orders = await prisma.order.findMany({
    where: {
      aiTemplateId: { not: null },
      createdAt: { gte: since },
    },
    select: {
      id: true,
      price: true,
      status: true,
      completedAt: true,
      createdAt: true,
      aiTemplate: { select: { priceLines: true } },
      responses: { select: { priceOffer: true } },
    },
  });

  const result: CollectResult = {
    ordersScanned: orders.length,
    finalPriceObservations: 0,
    masterOfferObservations: 0,
    skipped: 0,
  };

  for (const order of orders) {
    const lines = parsePriceLines(order.aiTemplate?.priceLines);
    if (lines.length === 0) {
      result.skipped += 1;
      continue;
    }

    const writes: { code: string; qty: number; unitPrice: number; source: 'FINAL_PRICE' | 'MASTER_OFFER'; at: Date }[] = [];

    // ─── Факт закрытого заказа ───
    if (order.status === 'COMPLETED') {
      const allocated = allocateToLines(lines, Number(order.price));
      for (const a of allocated) {
        writes.push({ ...a, source: 'FINAL_PRICE', at: order.completedAt ?? order.createdAt });
      }
    }

    // ─── Ставки мастеров ───
    // Заказ даёт одно наблюдение на позицию: берём медиану предложений,
    // иначе один демпингующий мастер перевесил бы всех остальных.
    const offers = order.responses
      .map((r) => Number(r.priceOffer))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (offers.length > 0) {
      const allocated = allocateToLines(lines, median(offers));
      for (const a of allocated) {
        writes.push({ ...a, source: 'MASTER_OFFER', at: order.createdAt });
      }
    }

    for (const w of writes) {
      try {
        await prisma.priceObservation.upsert({
          where: {
            orderId_itemCode_source: { orderId: order.id, itemCode: w.code, source: w.source },
          },
          create: {
            orderId: order.id,
            itemCode: w.code,
            source: w.source,
            qty: w.qty,
            unitPrice: w.unitPrice,
            observedAt: w.at,
          },
          update: { qty: w.qty, unitPrice: w.unitPrice, observedAt: w.at },
        });
        if (w.source === 'FINAL_PRICE') result.finalPriceObservations += 1;
        else result.masterOfferObservations += 1;
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, orderId: order.id, code: w.code },
          'Калибровка: наблюдение не записано',
        );
      }
    }
  }

  return result;
}

// ─── Шаг 2: движение цен ─────────────────────────────────────────

export interface CalibrationChange {
  code: string;
  from: number;
  to: number;
  median: number;
  sampleSize: number;
  p25: number;
  p75: number;
}

export interface CalibrationResult {
  itemsConsidered: number;
  changed: CalibrationChange[];
  skippedTooFewSamples: number;
  skippedManualCooldown: number;
  skippedSmallDelta: number;
  version?: number;
}

/**
 * Подтянуть цены позиций к медиане наблюдений.
 *
 * `dryRun` считает всё то же самое, но не пишет — так можно посмотреть,
 * что сделает ночной прогон, прежде чем ему довериться.
 */
export async function calibratePrices(options: { dryRun?: boolean; windowDays?: number } = {}): Promise<CalibrationResult> {
  const windowDays = options.windowDays ?? CALIBRATION_WINDOW_DAYS;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const cooldownEdge = new Date();
  cooldownEdge.setDate(cooldownEdge.getDate() - MANUAL_EDIT_COOLDOWN_DAYS);

  const observations = await prisma.priceObservation.findMany({
    where: { observedAt: { gte: since } },
    select: { itemCode: true, unitPrice: true, source: true },
  });

  const byCode = new Map<string, { value: number; weight: number }[]>();
  for (const o of observations) {
    const bucket = byCode.get(o.itemCode) ?? [];
    bucket.push({ value: Number(o.unitPrice), weight: WEIGHT[o.source] });
    byCode.set(o.itemCode, bucket);
  }

  const result: CalibrationResult = {
    itemsConsidered: byCode.size,
    changed: [],
    skippedTooFewSamples: 0,
    skippedManualCooldown: 0,
    skippedSmallDelta: 0,
  };

  if (byCode.size === 0) return result;

  const items = await prisma.priceItem.findMany({
    where: { code: { in: Array.from(byCode.keys()) }, isActive: true },
  });

  for (const item of items) {
    const samples = byCode.get(item.code) ?? [];

    if (samples.length < MIN_SAMPLE_SIZE) {
      result.skippedTooFewSamples += 1;
      continue;
    }

    if (item.manualPriceAt && item.manualPriceAt > cooldownEdge) {
      result.skippedManualCooldown += 1;
      continue;
    }

    const values = samples.map((s) => s.value);
    const target = weightedMedian(samples);
    const current = Number(item.unitPrice);
    if (current <= 0 || target <= 0) continue;

    const delta = Math.abs(target - current) / current;
    if (delta < MIN_DELTA_RATIO) {
      result.skippedSmallDelta += 1;
      continue;
    }

    // Шаг ограничен: одна аномальная неделя не уводит прайс за ночь.
    const capped = Math.min(
      Math.max(target, current * (1 - MAX_STEP_RATIO)),
      current * (1 + MAX_STEP_RATIO),
    );
    const next = Math.max(1000, Math.round(capped / 1000) * 1000);
    if (next === current) {
      result.skippedSmallDelta += 1;
      continue;
    }

    const p25 = quantile(values, 0.25);
    const p75 = quantile(values, 0.75);

    result.changed.push({
      code: item.code,
      from: current,
      to: next,
      median: Math.round(target),
      sampleSize: samples.length,
      p25: Math.round(p25),
      p75: Math.round(p75),
    });

    if (!options.dryRun) {
      await prisma.priceItem.update({
        where: { id: item.id },
        data: {
          unitPrice: next,
          source: 'CALIBRATED',
          sampleSize: samples.length,
          priceP25: Math.round(p25),
          priceP75: Math.round(p75),
          calibratedAt: new Date(),
        },
      });
    }
  }

  if (!options.dryRun && result.changed.length > 0) {
    const last = await prisma.priceBookVersion.findFirst({ orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    await prisma.priceBookVersion.create({
      data: {
        version,
        reason: `Калибровка по сделкам за ${windowDays} дней`,
        changes: result.changed.map((c) => ({
          code: c.code,
          field: 'unitPrice',
          from: c.from,
          to: c.to,
        })) as any,
        itemsTouched: result.changed.length,
      },
    });
    result.version = version;
    invalidatePriceBookCache();
  }

  return result;
}

/** Полный цикл: собрать наблюдения и подвинуть цены. */
export async function runCalibration(options: { dryRun?: boolean } = {}) {
  const collected = await collectObservations();
  const calibrated = await calibratePrices(options);

  logger.info(
    {
      ordersScanned: collected.ordersScanned,
      finals: collected.finalPriceObservations,
      offers: collected.masterOfferObservations,
      itemsChanged: calibrated.changed.length,
      version: calibrated.version,
      dryRun: options.dryRun ?? false,
    },
    'Калибровка прайса завершена',
  );

  return { collected, calibrated };
}
