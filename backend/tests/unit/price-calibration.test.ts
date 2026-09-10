// ============================================
// MasterUz — Калибровка цен по реальным сделкам
// ============================================
// Здесь проверяется арифметика, которая двигает цены по всему сервису.
// Ошибка в ней тихо уводит прайс в сторону и обнаруживается только по
// жалобам мастеров, поэтому границы проверяются явно.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({ prisma: {} }));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/modules/instant-order/pricebook.service.js', () => ({
  invalidatePriceBookCache: vi.fn(),
}));

import {
  allocateToLines,
  median,
  quantile,
  weightedMedian,
  MIN_SAMPLE_SIZE,
  MAX_STEP_RATIO,
} from '../../src/services/priceCalibrationService.js';
import { computeStats } from '../../src/services/priceAccuracyService.js';

const line = (over: Partial<{ code: string; kind: 'LABOR' | 'MATERIAL'; qty: number; unitPrice: number; total: number }>) => ({
  code: 'x',
  kind: 'LABOR' as const,
  qty: 1,
  unitPrice: 100_000,
  total: 100_000,
  ...over,
});

describe('раскладка фактической цены по позициям', () => {
  it('расхождение относится на труд, материалы идут транзитом', () => {
    // Смета: труд 100 000 + материал 20 000 = 120 000. Факт 160 000.
    // Материал остаётся 20 000, значит труд стоил 140 000 → ×1.4.
    const lines = [
      line({ code: 'w1', kind: 'LABOR', unitPrice: 100_000, total: 100_000 }),
      line({ code: 'm1', kind: 'MATERIAL', unitPrice: 20_000, total: 20_000 }),
    ];

    const allocated = allocateToLines(lines, 160_000);

    expect(allocated).toHaveLength(1);
    expect(allocated[0].code).toBe('w1');
    expect(allocated[0].unitPrice).toBe(140_000);
  });

  it('делит между несколькими работами пропорционально их доле', () => {
    const lines = [
      line({ code: 'w1', unitPrice: 60_000, total: 60_000 }),
      line({ code: 'w2', unitPrice: 40_000, total: 40_000 }),
    ];

    const allocated = allocateToLines(lines, 150_000);

    expect(allocated.find((a) => a.code === 'w1')!.unitPrice).toBe(90_000);
    expect(allocated.find((a) => a.code === 'w2')!.unitPrice).toBe(60_000);
  });

  it('учитывает объём: цена за единицу, а не за строку', () => {
    const lines = [line({ code: 'w1', qty: 3, unitPrice: 50_000, total: 150_000 })];
    const allocated = allocateToLines(lines, 300_000);

    expect(allocated[0].qty).toBe(3);
    expect(allocated[0].unitPrice).toBe(100_000);
  });

  it('отбрасывает заказы с невозможным отношением факта к смете', () => {
    const lines = [line({ code: 'w1', unitPrice: 100_000, total: 100_000 })];

    // В десять раз дороже сметы — это не рынок, это ошибка данных.
    expect(allocateToLines(lines, 1_000_000)).toEqual([]);
    // И в десять раз дешевле тоже.
    expect(allocateToLines(lines, 10_000)).toEqual([]);
  });

  it('не делает выводов, когда труда в смете нет', () => {
    const lines = [line({ code: 'm1', kind: 'MATERIAL', unitPrice: 50_000, total: 50_000 })];
    expect(allocateToLines(lines, 80_000)).toEqual([]);
  });

  it('факт ниже стоимости материалов ничего не даёт', () => {
    const lines = [
      line({ code: 'w1', unitPrice: 100_000, total: 100_000 }),
      line({ code: 'm1', kind: 'MATERIAL', unitPrice: 80_000, total: 80_000 }),
    ];
    expect(allocateToLines(lines, 50_000)).toEqual([]);
  });
});

describe('статистики выборки', () => {
  it('медиана на чётной и нечётной длине', () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBe(0);
  });

  it('квартили режут выборку по рангу', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80];
    expect(quantile(values, 0.25)).toBe(20);
    expect(quantile(values, 0.75)).toBe(60);
  });

  it('закрытая сделка весит больше ставки мастера', () => {
    // Три ставки по 100 против двух сделок по 200: сделки перевешивают
    // за счёт двойного веса — 4 голоса против 3.
    const samples = [
      { value: 100, weight: 1 },
      { value: 100, weight: 1 },
      { value: 100, weight: 1 },
      { value: 200, weight: 2 },
      { value: 200, weight: 2 },
    ];
    expect(weightedMedian(samples)).toBe(200);
  });

  it('без веса ведёт себя как обычная медиана', () => {
    const samples = [10, 20, 30].map((value) => ({ value, weight: 1 }));
    expect(weightedMedian(samples)).toBe(20);
  });
});

describe('пороги безопасности', () => {
  it('одна сделка не двигает цену', () => {
    expect(MIN_SAMPLE_SIZE).toBeGreaterThanOrEqual(5);
  });

  it('шаг за прогон ограничен, чтобы выброс не увёл прайс за ночь', () => {
    expect(MAX_STEP_RATIO).toBeLessThanOrEqual(0.2);
    expect(MAX_STEP_RATIO).toBeGreaterThan(0);
  });
});

describe('метрики точности', () => {
  const row = (predicted: number, actual: number, cat = 'c1', predCat: string | null = 'c1') => ({
    id: Math.random().toString(36).slice(2),
    predicted,
    actual,
    predictedCategoryId: predCat,
    actualCategoryId: cat,
    completedAt: new Date('2026-08-15'),
  });

  it('считает среднюю относительную ошибку', () => {
    // Промахи на 10% и 30% → MAPE 20%
    const stats = computeStats([row(110, 100), row(130, 100)])!;
    expect(stats.mape).toBeCloseTo(20, 5);
  });

  it('различает завышение и занижение', () => {
    expect(computeStats([row(120, 100)])!.bias).toBeGreaterThan(0);
    expect(computeStats([row(80, 100)])!.bias).toBeLessThan(0);
  });

  it('считает долю попаданий в ±20% и грубых промахов', () => {
    const stats = computeStats([row(105, 100), row(115, 100), row(200, 100), row(100, 100)])!;
    expect(stats.within20Pct).toBe(75);
    expect(stats.grossPct).toBe(25);
  });

  it('считает точность категории', () => {
    const stats = computeStats([row(100, 100, 'c1', 'c1'), row(100, 100, 'c1', 'c2')])!;
    expect(stats.categoryAccuracyPct).toBe(50);
  });

  it('на пустой выборке метрик нет', () => {
    expect(computeStats([])).toBeNull();
  });
});
