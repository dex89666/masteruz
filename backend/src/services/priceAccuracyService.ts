// ════════════════════════════════════════════════════════════════
// MasterUz — Точность прогноза цены
// ────────────────────────────────────────────────────────────────
// Один расчёт метрик на два потребителя: CLI-отчёт и админ-панель.
// Держать их отдельно было бы повторением той самой ошибки, из-за
// которой у сервиса и появилось два расходящихся прайса.
//
// Мера успеха здесь одна: сходится ли обещанная клиенту цена с той,
// которую он в итоге заплатил. Всё остальное — детали реализации.
// ════════════════════════════════════════════════════════════════

import { prisma } from '../config/database.js';
import { toNum } from '../utils/helpers.js';

export interface AccuracyStats {
  /** Сколько закрытых заказов с прогнозом попало в выборку. */
  n: number;
  /** Средняя абсолютная ошибка в сумах. */
  mae: number;
  /** Средняя относительная ошибка, % — главная метрика приёмки. */
  mape: number;
  /** Систематическое смещение: > 0 — завышаем, < 0 — занижаем. */
  bias: number;
  /** Доля прогнозов в пределах ±20 %. */
  within20Pct: number;
  /** Доля грубых промахов свыше 50 %. */
  grossPct: number;
  /** Доля верно угаданных категорий. */
  categoryAccuracyPct: number;
}

export interface AccuracyRow {
  id: string;
  predicted: number;
  actual: number;
  predictedCategoryId: string | null;
  actualCategoryId: string;
  completedAt: Date | null;
}

export function computeStats(rows: AccuracyRow[]): AccuracyStats | null {
  if (rows.length === 0) return null;

  const absErrors = rows.map((r) => Math.abs(r.predicted - r.actual));
  const pctErrors = rows.map((r) => (Math.abs(r.predicted - r.actual) / r.actual) * 100);

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    n: rows.length,
    mae: mean(absErrors),
    mape: mean(pctErrors),
    bias: mean(rows.map((r) => r.predicted - r.actual)),
    within20Pct: (pctErrors.filter((p) => p <= 20).length / rows.length) * 100,
    grossPct: (pctErrors.filter((p) => p > 50).length / rows.length) * 100,
    categoryAccuracyPct:
      (rows.filter((r) => r.predictedCategoryId === r.actualCategoryId).length / rows.length) * 100,
  };
}

/** Закрытые заказы, по которым есть снимок прогноза. */
export async function loadAccuracyRows(days?: number | null): Promise<AccuracyRow[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      aiPredictedAt: { not: null },
      ...(days ? { completedAt: { gte: new Date(Date.now() - days * 86_400_000) } } : {}),
    },
    select: {
      id: true,
      price: true,
      categoryId: true,
      aiPredictedPrice: true,
      aiPredictedCategoryId: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  return orders
    .filter((o) => o.aiPredictedPrice != null && toNum(o.price) > 0)
    .map((o) => ({
      id: o.id,
      predicted: toNum(o.aiPredictedPrice),
      actual: toNum(o.price),
      predictedCategoryId: o.aiPredictedCategoryId,
      actualCategoryId: o.categoryId,
      completedAt: o.completedAt,
    }));
}

/** Помесячная динамика — видно, улучшается система или деградирует. */
export function groupByMonth(rows: AccuracyRow[]): { month: string; stats: AccuracyStats }[] {
  const buckets = new Map<string, AccuracyRow[]>();
  for (const row of rows) {
    const date = row.completedAt ?? new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRows]) => ({ month, stats: computeStats(monthRows)! }));
}

export interface CalibrationCoverage {
  totalItems: number;
  calibratedItems: number;
  coveragePct: number;
  observations90d: number;
  lastCalibratedAt: Date | null;
}

/**
 * Насколько прайс опирается на сделки, а не на экспертную оценку.
 * Это и есть ответ на вопрос «цены уже реальные или ещё придуманные».
 */
export async function getCalibrationCoverage(): Promise<CalibrationCoverage> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [totalItems, calibratedItems, observations90d, latest] = await Promise.all([
    prisma.priceItem.count({ where: { isActive: true, kind: 'LABOR' } }),
    prisma.priceItem.count({ where: { isActive: true, kind: 'LABOR', source: 'CALIBRATED' } }),
    prisma.priceObservation.count({ where: { observedAt: { gte: since } } }),
    prisma.priceItem.findFirst({
      where: { calibratedAt: { not: null } },
      orderBy: { calibratedAt: 'desc' },
      select: { calibratedAt: true },
    }),
  ]);

  return {
    totalItems,
    calibratedItems,
    coveragePct: totalItems > 0 ? (calibratedItems / totalItems) * 100 : 0,
    observations90d,
    lastCalibratedAt: latest?.calibratedAt ?? null,
  };
}

/** Полная сводка для админ-панели. */
export async function getAccuracyReport(days?: number | null) {
  const rows = await loadAccuracyRows(days);
  const [coverage] = await Promise.all([getCalibrationCoverage()]);

  return {
    overall: computeStats(rows),
    byMonth: groupByMonth(rows),
    coverage,
    windowDays: days ?? null,
  };
}
