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
  roundUnitPrice,
  MAX_UNIT_QUANTITY,
  PRICING_CATALOG,
  WALL_AREA_UNIT,
  wallAreaFromFloor,
  mainWorkLine,
  volumeClassOf,
  findProblemByDescription,
  calculateSolutionPrice,
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

describe('округление цены за единицу', () => {
  it('не искажает дешёвые позиции', () => {
    // Покос газона стоит 500 сум за м². Единый шаг в 1 000 сум удваивал его,
    // и на 200 м² смета вырастала на 100 000 сум из ниоткуда.
    expect(roundUnitPrice(500)).toBe(500);
    expect(roundUnitPrice(3_000)).toBe(3_000);
    expect(roundUnitPrice(540)).toBe(500);
  });

  it('шаг растёт вместе с ценой', () => {
    expect(roundUnitPrice(35_400)).toBe(35_500);
    expect(roundUnitPrice(71_447)).toBe(71_000);
    expect(roundUnitPrice(124_600)).toBe(125_000);
  });

  it('погрешность округления не превышает 10% на любой величине', () => {
    for (const price of [100, 500, 1_500, 4_900, 12_000, 47_000, 90_000, 1_200_000]) {
      const rounded = roundUnitPrice(price);
      expect(Math.abs(rounded - price) / price).toBeLessThanOrEqual(0.1);
    }
  });

  it('на нуле и мусоре возвращает ноль', () => {
    expect(roundUnitPrice(0)).toBe(0);
    expect(roundUnitPrice(-5)).toBe(0);
    expect(roundUnitPrice(NaN)).toBe(0);
  });

  it('масштабирование по хинту AI сохраняет порядок дешёвых позиций', () => {
    const cheap: EstimateVariant = makeVariant({
      works: [{ name: 'Покос газона', qty: 200, unit: 'м²', unitPrice: 500, total: 100_000 }],
      materials: [],
      estimatedPrice: 100_000,
    });

    const [v] = scaleVariantsToPriceHint([cheap], { min: 190_000, max: 210_000 });
    // Цена за м² выросла примерно вдвое, а не в четыре раза из-за округления
    expect(v.works[0].unitPrice).toBeGreaterThanOrEqual(900);
    expect(v.works[0].unitPrice).toBeLessThanOrEqual(1_100);
  });
});

describe('сборка мебели — уровни одного объёма', () => {
  // Раньше уровни проблемы «Сборка мебели» означали разные объёмы: GOOD —
  // комод, BETTER — шкаф-купе или кухонный гарнитур, BEST — комплект. Клиенту
  // с чертежом одного кухонного модуля рекомендовалась «сборка гарнитура»
  // за 590 000.
  const FURNITURE = ['furniture', 'Сборка и ремонт мебели'] as const;

  it('кухонный модуль не попадает в сборку гарнитура', () => {
    const res = buildSmartVariants(...FURNITURE, 'собрать кухонный модуль');
    expect(res).not.toBeNull();
    expect(res!.problemName).toBe('Сборка кухни (по модулям)');
    const better = res!.variants.find((v) => v.tier === 'BETTER')!;
    expect(better.estimatedPrice).toBeLessThan(250_000);
  });

  it('гарнитур из восьми модулей стоит кратно дороже одного модуля', () => {
    const one = buildSmartVariants(...FURNITURE, 'собрать кухонный модуль', null, { quantity: 1 })!;
    const eight = buildSmartVariants(...FURNITURE, 'собрать кухонный гарнитур', null, { quantity: 8 })!;
    const b1 = one.variants.find((v) => v.tier === 'BETTER')!.estimatedPrice;
    const b8 = eight.variants.find((v) => v.tier === 'BETTER')!.estimatedPrice;
    expect(b8).toBeGreaterThan(b1 * 5);
  });

  it('выезд при сборке гарнитура оплачивается один раз', () => {
    const eight = buildSmartVariants(...FURNITURE, 'собрать кухонный гарнитур', null, { quantity: 8 })!;
    for (const variant of eight.variants) {
      const visits = variant.works.filter((w) => w.unit === 'выезд');
      expect(visits.length).toBeLessThanOrEqual(1);
      if (visits[0]) expect(visits[0].qty).toBe(1);
    }
  });

  it('шкаф-купе считается как шкаф, а не как комод', () => {
    const res = buildSmartVariants(...FURNITURE, 'собрать шкаф-купе')!;
    expect(res.problemName).toBe('Сборка шкафа / шкафа-купе');
    expect(res.variants.find((v) => v.tier === 'GOOD')!.estimatedPrice).toBeGreaterThanOrEqual(400_000);
  });

  it('комод — небольшая мебель', () => {
    expect(buildSmartVariants(...FURNITURE, 'собрать комод')!.problemName).toBe('Сборка небольшой мебели');
  });

  it('когда клиент написал лишь «собрать», предмет определяет фото', () => {
    const res = buildSmartVariants(...FURNITURE, 'Как собрать?', null, {
      aiContext:
        'Необходимо собрать один кухонный модуль по предоставленной схеме. фасад ящика. петли. направляющие для ящика',
    })!;
    expect(res.problemName).toBe('Сборка кухни (по модулям)');
  });

  it('конкретные слова клиента важнее фото', () => {
    const res = buildSmartVariants(...FURNITURE, 'собрать шкаф-купе', null, { aiContext: 'кухонный модуль' })!;
    expect(res.problemName).toBe('Сборка шкафа / шкафа-купе');
  });

  it('в каждой проблеме сборки уровни рассчитаны на один и тот же объём', () => {
    for (const text of ['собрать комод', 'собрать шкаф-купе', 'собрать кухонный модуль']) {
      const res = buildSmartVariants(...FURNITURE, text)!;
      const bases = new Set(res.variants.map((v) => solutionBaseQuantity(v)));
      expect(bases.size).toBe(1);
    }
  });

  it('уровни идут по возрастанию цены', () => {
    for (const text of ['собрать комод', 'собрать шкаф-купе', 'собрать кухонный модуль']) {
      const [good, better, best] = buildSmartVariants(...FURNITURE, text)!.variants;
      expect(better.estimatedPrice).toBeGreaterThan(good.estimatedPrice);
      expect(best.estimatedPrice).toBeGreaterThan(better.estimatedPrice);
    }
  });

  it('база решения — основная работа, а не сопутствующие операции', () => {
    // Сборка ОДНОГО шкафа с двумя зеркальными дверями: двери — не второй шкаф.
    const wardrobe = makeVariant({
      works: [
        { name: 'Сборка крупной мебели', qty: 1, unit: 'шт.', unitPrice: 400_000, total: 400_000 },
        { name: 'Установка зеркальных дверей', qty: 2, unit: 'шт.', unitPrice: 40_000, total: 80_000 },
      ],
      materials: [],
      estimatedPrice: 480_000,
    });
    expect(solutionBaseQuantity(wardrobe)).toBe(1);
    expect(applyQuantity([wardrobe], 1)[0].estimatedPrice).toBe(480_000);
  });
});

describe('разборка мебели — уровни одного объёма', () => {
  const FURNITURE = ['furniture', 'Сборка и ремонт мебели'] as const;

  it('разборка комода — небольшая мебель, а не шкаф-купе', () => {
    const res = buildSmartVariants(...FURNITURE, 'разобрать комод')!;
    expect(res.problemName).toBe('Разборка небольшой мебели');
  });

  it('разборка дешевле сборки того же предмета', () => {
    // Раньше разборка комода стоила 280 000 — дороже его сборки (180 000):
    // правило «разборка ≈ 70% сборки» применили к цене шкафа, а не комода.
    const assemble = buildSmartVariants(...FURNITURE, 'собрать комод')!;
    const disassemble = buildSmartVariants(...FURNITURE, 'разобрать комод')!;
    const tier = (r: typeof assemble, t: string) => r!.variants.find((v) => v.tier === t)!.estimatedPrice;
    expect(tier(disassemble, 'GOOD')).toBeLessThan(tier(assemble, 'GOOD'));
  });

  it('шкаф-купе и кухонный модуль разбираются по своим проблемам', () => {
    expect(buildSmartVariants(...FURNITURE, 'разобрать шкаф-купе')!.problemName).toBe('Разборка шкафа / шкафа-купе');
    expect(buildSmartVariants(...FURNITURE, 'разобрать кухонный модуль')!.problemName).toBe('Разборка кухни (по модулям)');
    expect(buildSmartVariants(...FURNITURE, 'демонтаж кухонного гарнитура')!.problemName).toBe('Разборка кухни (по модулям)');
  });

  it('без глагола — сборка, а не разборка', () => {
    // «Навесной шкаф на кухню» почти всегда означает установку: слова про
    // предмет у сборки и разборки одинаковые, а сборка стоит раньше.
    expect(buildSmartVariants(...FURNITURE, 'навесной шкаф на кухню')!.problemName).toBe('Сборка кухни (по модулям)');
  });

  it('навесной шкаф — кухня, а не шкаф-купе', () => {
    expect(buildSmartVariants(...FURNITURE, 'собрать навесной шкаф')!.problemName).toBe('Сборка кухни (по модулям)');
  });

  it('разные глаголы разборки понимаются одинаково', () => {
    expect(buildSmartVariants(...FURNITURE, 'убрать комод')!.problemName).toBe('Разборка небольшой мебели');
    expect(buildSmartVariants(...FURNITURE, 'снять навесной шкаф')!.problemName).toBe('Разборка кухни (по модулям)');
    expect(buildSmartVariants(...FURNITURE, 'разобрать навесной шкаф')!.problemName).toBe('Разборка кухни (по модулям)');
    expect(buildSmartVariants(...FURNITURE, 'разбираю шкаф-купе')!.problemName).toBe('Разборка шкафа / шкафа-купе');
  });

  it('«собрать» и «разобрать» не путаются', () => {
    expect(buildSmartVariants(...FURNITURE, 'собрать кухонный модуль')!.problemName).toBe('Сборка кухни (по модулям)');
    expect(buildSmartVariants(...FURNITURE, 'разобрать кухонный модуль')!.problemName).toBe('Разборка кухни (по модулям)');
  });

  it('гарнитур разбирается по числу модулей', () => {
    const one = buildSmartVariants(...FURNITURE, 'разобрать кухонный модуль', null, { quantity: 1 })!;
    const eight = buildSmartVariants(...FURNITURE, 'разобрать кухонный гарнитур', null, { quantity: 8 })!;
    const better = (r: typeof one) => r!.variants.find((v) => v.tier === 'BETTER')!.estimatedPrice;
    expect(better(eight)).toBeGreaterThan(better(one) * 5);
  });

  it('в каждой проблеме разборки уровни рассчитаны на один объём и идут по возрастанию цены', () => {
    for (const text of ['разобрать комод', 'разобрать шкаф-купе', 'разобрать кухонный модуль']) {
      const variants = buildSmartVariants(...FURNITURE, text)!.variants;
      expect(new Set(variants.map((v) => solutionBaseQuantity(v))).size).toBe(1);
      const [good, better, best] = variants;
      expect(better.estimatedPrice).toBeGreaterThan(good.estimatedPrice);
      expect(best.estimatedPrice).toBeGreaterThan(better.estimatedPrice);
    }
  });
});

describe('площадь и метраж — объём клиента доходит до цены', () => {
  const byArea = (unit: string, qty: number) =>
    makeVariant({
      works: [
        { name: 'Выезд мастера', qty: 1, unit: 'выезд', unitPrice: 30_000, total: 30_000 },
        { name: 'Покраска (2 слоя)', qty, unit, unitPrice: 15_000, total: qty * 15_000 },
      ],
      materials: [{ name: 'Краска интерьерная (10 л)', qty: 1, unit: 'ведро', unitPrice: 150_000, total: 150_000 }],
      estimatedPrice: 30_000 + qty * 15_000 + 150_000,
    });

  it('площадь доводит работу по м² до названной, выезд не меняется', () => {
    const [v] = applyQuantity([byArea('м²', 30)], null, { value: 60, unit: 'м²' });
    expect(v.works[1].qty).toBe(60);
    expect(v.works[0].total).toBe(30_000);
    // Краску покупают вёдрами: на 60 м² — два ведра
    expect(v.materials[0].qty).toBe(2);
  });

  it('площадь комнаты по полу пересчитывается в площадь стен', () => {
    const [v] = applyQuantity([byArea(WALL_AREA_UNIT, 30)], null, { value: 16, unit: 'м²', basis: 'room' });
    expect(v.works[1].qty).toBe(wallAreaFromFloor(16));
    // В комнате 16 м² стен около 40 м², а не 16
    expect(wallAreaFromFloor(16)).toBeGreaterThanOrEqual(38);
    expect(wallAreaFromFloor(16)).toBeLessThanOrEqual(44);
  });

  it('площадь самой стены не пересчитывается', () => {
    const [v] = applyQuantity([byArea(WALL_AREA_UNIT, 30)], null, { value: 12, unit: 'м²', basis: 'surface' });
    expect(v.works[1].qty).toBe(12);
  });

  it('квартира считается несколькими комнатами — у неё есть внутренние стены', () => {
    // Одна «коробка» 60 м² дала бы ~80 м² стен; у трёх комнат их ~135
    expect(wallAreaFromFloor(60)).toBeGreaterThan(120);
  });

  it('метраж не трогает работы по площади, площадь — штучные работы', () => {
    const area = byArea('м²', 30);
    expect(applyQuantity([area], null, { value: 5, unit: 'м.п.' })[0].estimatedPrice).toBe(area.estimatedPrice);
    const piece = makeVariant();
    expect(applyQuantity([piece], null, { value: 20, unit: 'м²' })[0].estimatedPrice).toBe(piece.estimatedPrice);
  });

  it('разовые строки заказа не множатся: три розетки на новой линии — один автомат', () => {
    const base = makeVariant({
      works: [
        { name: 'Выезд электрика', qty: 1, unit: 'выезд', unitPrice: 40_000, total: 40_000 },
        { name: 'Замена розетки', qty: 1, unit: 'шт.', unitPrice: 35_000, total: 35_000 },
        { name: 'Установка автомата в щиток', qty: 1, unit: 'заказ', unitPrice: 40_000, total: 40_000 },
      ],
      materials: [],
      estimatedPrice: 115_000,
    });
    const [v] = applyQuantity([base], 3);
    expect(v.works[1].qty).toBe(3);
    expect(v.works[2].qty).toBe(1);
  });
});

describe('каталог — уровни одной проблемы описывают один объём работ', () => {
  // Уровни — это качество исполнения, а не объём: клиенту с одной розеткой
  // не предлагают «Премиум» на четыре. Протечка — осознанное исключение:
  // очаг один, но «Премиум» меняет участок трубы до 3 м вместо точечного ремонта.
  const ESCALATION = new Set(['Протечка / прорыв трубы']);
  type Solution = Parameters<typeof calculateSolutionPrice>[0];
  const base = (s: Solution) => {
    const main = mainWorkLine({ works: s.works.map((w) => ({ ...w, total: w.qty * w.unitPrice })) });
    return main ? `${main.qty} ${volumeClassOf(main.unit)}` : 'нет основной работы';
  };

  for (const cat of PRICING_CATALOG) {
    for (const pr of cat.problems) {
      it(`${cat.slug} / ${pr.problemName}`, () => {
        const totals = pr.solutions.map((s) => calculateSolutionPrice(s).total);
        // Цена растёт строго от «Хорошего» к «Премиуму»
        expect(totals).toEqual([...totals].sort((a, b) => a - b));
        expect(new Set(totals).size).toBe(totals.length);
        if (!ESCALATION.has(pr.problemName)) expect(new Set(pr.solutions.map(base)).size).toBe(1);
      });
    }
  }
});

describe('подбор проблемы — разные работы не смешиваются', () => {
  const cases: [string, string, string][] = [
    ['electrical', 'почистить кондиционер', 'Обслуживание / ремонт кондиционера'],
    ['electrical', 'кондиционер не холодит', 'Обслуживание / ремонт кондиционера'],
    ['electrical', 'установить кондиционер в спальне', 'Установка кондиционера'],
    ['electrical', 'повесить люстру', 'Установка люстры / светильника'],
    ['electrical', 'не горит свет в коридоре', 'Проблемы с освещением'],
    ['electrical', 'сделать точечные светильники', 'Монтаж точечного освещения'],
    ['electrical', 'выбивает автомат', 'Замена автомата / УЗО'],
    ['electrical', 'собрать новый щиток', 'Ревизия / замена электрощитка'],
    ['construction', 'дырка в стене', 'Заделка трещин и отверстий в стене'],
    ['construction', 'выровнять стены', 'Штукатурка / выравнивание стен'],
    ['construction', 'вздулся ламинат', 'Ремонт участка пола'],
    ['construction', 'постелить ламинат в комнате', 'Укладка пола'],
    ['construction', 'натяжной потолок в зал', 'Натяжной потолок'],
    ['construction', 'потолок из гипсокартона', 'Потолок из гипсокартона'],
    ['construction', 'побелить потолок', 'Ремонт / покраска потолка'],
    ['painting', 'отходят обои на стыках', 'Подклейка обоев'],
    ['painting', 'поклеить обои в комнате', 'Поклейка обоев'],
    ['painting', 'отвалилась плитка в ванной', 'Замена отдельных плиток'],
    ['painting', 'положить плитку на кухне', 'Укладка плитки'],
    ['windows-doors', 'дует из окна', 'Ремонт / регулировка окна'],
    ['windows-doors', 'разбилось стекло в окне', 'Замена стеклопакета'],
    ['windows-doors', 'сломался замок', 'Замена / ремонт замка'],
    ['windows-doors', 'скрипит дверь', 'Ремонт / регулировка двери'],
    ['windows-doors', 'установить межкомнатную дверь', 'Установка межкомнатной двери'],
    ['furniture', 'провисла дверца шкафа', 'Замена петель / ручек мебели'],
    ['furniture', 'не выдвигается ящик', 'Ремонт ящиков (направляющие)'],
    ['furniture', 'шатается шкаф', 'Ремонт корпуса мебели'],
    ['carpentry', 'починить забор', 'Ремонт деревянного забора / перил'],
    ['carpentry', 'построить навес во дворе', 'Строительство навеса / беседки / террасы'],
    ['garden-outdoor', 'покосить траву на участке', 'Покос газона / уход за участком'],
    ['garden-outdoor', 'обрезать деревья', 'Обрезка деревьев и кустов'],
  ];
  for (const [slug, text, expected] of cases) {
    it(`«${text}» → ${expected}`, () => {
      expect(findProblemByDescription(slug, text)?.problemName).toBe(expected);
    });
  }
});
