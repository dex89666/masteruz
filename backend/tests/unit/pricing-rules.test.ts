// ============================================
// MasterUz — Правила расчёта сметы
// ============================================
// Цена, которую видит клиент, складывается из четырёх правил, применяемых
// по порядку: позиции каталога → количество единиц → подтягивание труда к
// оценке AI → снятие выезда с дешёвого варианта.
//
// Здесь проверяется именно арифметика этих правил: каждое из них раньше
// давало клиенту неверную сумму (количество игнорировалось, материалы
// дорожали вместе с трудом, fallback считался по другим правилам).

import { describe, it, expect } from 'vitest';
import {
  applyQuantity,
  solutionBaseQuantity,
  scaleVariantsToPriceHint,
  dropVisitFeeOnCheapVariant,
  buildSmartVariants,
  MAX_UNIT_QUANTITY,
  type EstimateVariant,
} from '../../src/modules/instant-order/pricing-catalog.js';

/** Смета-образец: выезд + работа + материал. */
function makeVariant(over: Partial<EstimateVariant> = {}): EstimateVariant {
  const works = [
    { name: 'Диагностика и выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000, total: 50_000 },
    { name: 'Замена розетки', qty: 1, unit: 'шт.', unitPrice: 60_000, total: 60_000 },
  ];
  const materials = [
    { name: 'Хомут/герметик/фум-лента', qty: 1, unit: 'компл.', unitPrice: 15_000, total: 15_000 },
  ];
  return {
    tier: 'BETTER',
    tierLabel: 'Отличный',
    title: 'Замена розетки',
    description: 'Демонтаж старой, установка новой',
    works,
    materials,
    estimatedPrice: 125_000,
    estimatedDays: 1,
    confidence: 0.8,
    ...over,
  };
}

const laborOf = (v: EstimateVariant) => v.works.reduce((s, w) => s + w.total, 0);
const materialsOf = (v: EstimateVariant) => v.materials.reduce((s, m) => s + m.total, 0);

describe('applyQuantity — количество единиц доходит до цены', () => {
  it('умножает работу и материалы, но не выезд', () => {
    const [v] = applyQuantity([makeVariant()], 3);

    const visit = v.works.find((w) => w.unit === 'выезд')!;
    const work = v.works.find((w) => w.unit === 'шт.')!;

    // Мастер едет один раз независимо от числа розеток
    expect(visit.qty).toBe(1);
    expect(visit.total).toBe(50_000);
    // Сама работа и расходники — на каждую единицу
    expect(work.qty).toBe(3);
    expect(work.total).toBe(180_000);
    expect(v.materials[0].qty).toBe(3);
    expect(v.estimatedPrice).toBe(50_000 + 180_000 + 45_000);
  });

  it('количество 1 или отсутствие количества ничего не меняет', () => {
    const base = makeVariant();
    expect(applyQuantity([base], 1)[0].estimatedPrice).toBe(base.estimatedPrice);
    expect(applyQuantity([base], null)[0].estimatedPrice).toBe(base.estimatedPrice);
    expect(applyQuantity([base], undefined)[0].estimatedPrice).toBe(base.estimatedPrice);
  });

  it('учитывает количество, уже заложенное в решение', () => {
    // Каталожные уровни не всегда рассчитаны на одну единицу: «Замена блока
    // розеток (2-3 шт.)» уже содержит три. Без учёта этого запрос «три
    // розетки» превращал бы решение в девять и утраивал цену.
    const blockOfThree = makeVariant({
      works: [
        { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000, total: 40_000 },
        { name: 'Замена розеток', qty: 3, unit: 'шт.', unitPrice: 35_000, total: 105_000 },
      ],
      materials: [{ name: 'Розетки', qty: 3, unit: 'шт.', unitPrice: 25_000, total: 75_000 }],
      estimatedPrice: 220_000,
    });

    expect(solutionBaseQuantity(blockOfThree)).toBe(3);

    const [v] = applyQuantity([blockOfThree], 3);
    expect(v.works.find((w) => w.unit === 'шт.')!.qty).toBe(3);
    expect(v.estimatedPrice).toBe(220_000);
  });

  it('масштабирует решение вниз, когда единиц нужно меньше заложенного', () => {
    const forFour = makeVariant({
      works: [
        { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000, total: 40_000 },
        { name: 'Замена розеток', qty: 4, unit: 'шт.', unitPrice: 35_000, total: 140_000 },
      ],
      materials: [],
      estimatedPrice: 180_000,
    });

    const [v] = applyQuantity([forFour], 2);
    expect(v.works.find((w) => w.unit === 'шт.')!.qty).toBe(2);
    expect(v.estimatedPrice).toBeLessThan(180_000);
  });

  it('выезд не размножается и не сокращается вместе с количеством', () => {
    const [up] = applyQuantity([makeVariant()], 5);
    const [down] = applyQuantity([makeVariant({ works: [
      { name: 'Диагностика и выезд мастера', qty: 1, unit: 'выезд', unitPrice: 50_000, total: 50_000 },
      { name: 'Замена розеток', qty: 4, unit: 'шт.', unitPrice: 60_000, total: 240_000 },
    ], estimatedPrice: 290_000 })], 2);

    expect(up.works.find((w) => w.unit === 'выезд')!.total).toBe(50_000);
    expect(down.works.find((w) => w.unit === 'выезд')!.total).toBe(50_000);
  });

  it('без штучных строк количество работает как прежний множитель', () => {
    const byArea = makeVariant({
      works: [{ name: 'Штробление стены', qty: 2, unit: 'м.п.', unitPrice: 25_000, total: 50_000 }],
      materials: [],
      estimatedPrice: 50_000,
    });

    expect(solutionBaseQuantity(byArea)).toBe(1);
    const [v] = applyQuantity([byArea], 3);
    expect(v.estimatedPrice).toBe(150_000);
  });

  it('ограничивает множитель потолком — опечатка «100 розеток» не улетает в космос', () => {
    const [v] = applyQuantity([makeVariant()], 999);
    const work = v.works.find((w) => w.unit === 'шт.')!;
    expect(work.qty).toBe(MAX_UNIT_QUANTITY);
  });

  it('срок растёт медленнее количества — мастер уже на объекте', () => {
    const [v] = applyQuantity([makeVariant({ estimatedDays: 1 })], 4);
    expect(v.estimatedDays).toBeGreaterThan(1);
    expect(v.estimatedDays).toBeLessThan(4);
  });
});

describe('scaleVariantsToPriceHint — подтягиваем труд, не материалы', () => {
  it('материалы остаются каталожными при масштабировании', () => {
    const base = makeVariant();
    const materialsBefore = materialsOf(base);

    // AI увидел объект вчетверо дороже каталога
    const [v] = scaleVariantsToPriceHint([base], { min: 450_000, max: 550_000 });

    expect(materialsOf(v)).toBe(materialsBefore);
    expect(v.materials[0].unitPrice).toBe(15_000);
    expect(laborOf(v)).toBeGreaterThan(laborOf(base));
  });

  it('итог попадает в диапазон AI', () => {
    const [v] = scaleVariantsToPriceHint([makeVariant()], { min: 450_000, max: 550_000 });
    expect(v.estimatedPrice).toBeGreaterThanOrEqual(430_000);
    expect(v.estimatedPrice).toBeLessThanOrEqual(570_000);
  });

  it('расхождение в пределах шума каталога игнорируется', () => {
    const base = makeVariant();
    const [v] = scaleVariantsToPriceHint([base], { min: 130_000, max: 140_000 });
    expect(v.estimatedPrice).toBe(base.estimatedPrice);
  });

  it('абсурдная оценка AI отбрасывается — доверяем каталогу', () => {
    const base = makeVariant();
    const [v] = scaleVariantsToPriceHint([base], { min: 9_000_000, max: 10_000_000 });
    expect(v.estimatedPrice).toBe(base.estimatedPrice);
  });

  it('пустой хинт — смета не меняется', () => {
    const base = makeVariant();
    expect(scaleVariantsToPriceHint([base], null)[0].estimatedPrice).toBe(base.estimatedPrice);
  });

  it('хинт, разложенный по долям, в сумме даёт исходный диапазон', () => {
    // Мульти-смета делит хинт между направлениями пропорционально их весу.
    const a = makeVariant({ estimatedPrice: 125_000 });
    const b = makeVariant({ estimatedPrice: 125_000 });
    const hint = { min: 700_000, max: 900_000 };
    const total = a.estimatedPrice + b.estimatedPrice;

    const scaledA = scaleVariantsToPriceHint([a], {
      min: hint.min * (a.estimatedPrice / total),
      max: hint.max * (a.estimatedPrice / total),
    })[0];
    const scaledB = scaleVariantsToPriceHint([b], {
      min: hint.min * (b.estimatedPrice / total),
      max: hint.max * (b.estimatedPrice / total),
    })[0];

    const mid = (hint.min + hint.max) / 2;
    const sum = scaledA.estimatedPrice + scaledB.estimatedPrice;
    expect(Math.abs(sum - mid) / mid).toBeLessThan(0.1);
  });
});

describe('dropVisitFeeOnCheapVariant', () => {
  it('снимает выезд с дешёвого базового варианта', () => {
    const good = makeVariant({ tier: 'GOOD', estimatedPrice: 115_000 });
    const [v] = dropVisitFeeOnCheapVariant([good]);
    expect(v.works.some((w) => /выезд/i.test(w.name))).toBe(false);
    expect(v.estimatedPrice).toBe(75_000);
  });

  it('не трогает дорогие сметы — там выезд не выглядит накруткой', () => {
    const good = makeVariant({ tier: 'GOOD', estimatedPrice: 480_000 });
    const [v] = dropVisitFeeOnCheapVariant([good]);
    expect(v.works.some((w) => /выезд/i.test(w.name))).toBe(true);
  });
});

describe('buildSmartVariants — сквозной расчёт по каталогу', () => {
  it('три розетки стоят дороже одной', () => {
    const one = buildSmartVariants('electrical', 'Электрика', 'заменить розетку', null, { quantity: 1 });
    const three = buildSmartVariants('electrical', 'Электрика', 'заменить 3 розетки', null, { quantity: 3 });

    expect(one).not.toBeNull();
    expect(three).not.toBeNull();

    const oneBetter = one!.variants.find((v) => v.tier === 'BETTER')!;
    const threeBetter = three!.variants.find((v) => v.tier === 'BETTER')!;
    expect(threeBetter.estimatedPrice).toBeGreaterThan(oneBetter.estimatedPrice);
  });

  it('уверенность одинакова для всех уровней и берётся из сигналов', () => {
    const res = buildSmartVariants('plumbing', 'Сантехника', 'течёт кран', null, { confidence: 0.62 });
    expect(res).not.toBeNull();
    for (const v of res!.variants) expect(v.confidence).toBe(0.62);
  });

  it('уровни идут по возрастанию цены', () => {
    const res = buildSmartVariants('plumbing', 'Сантехника', 'протечка трубы под раковиной');
    expect(res).not.toBeNull();
    const byTier = Object.fromEntries(res!.variants.map((v) => [v.tier, v.estimatedPrice]));
    expect(byTier.BETTER).toBeGreaterThanOrEqual(byTier.GOOD);
    expect(byTier.BEST).toBeGreaterThanOrEqual(byTier.BETTER);
  });

  it('неизвестная категория — смета не строится', () => {
    expect(buildSmartVariants('nonexistent-slug', 'Нет такой', 'что-то сломалось')).toBeNull();
  });
});
