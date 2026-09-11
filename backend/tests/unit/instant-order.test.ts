// ============================================
// MasterUz — Instant Order (ФотоЗаказ)
// ============================================
// Основной путь создания заказа через AI: клиент выбирает вариант,
// система считает цену с комиссией, блокирует эскроу и фиксирует
// снимок прогноза AI для самообучения.
//
// Покрываем то, что дороже всего сломать: денежную арифметику,
// защиту оферты и корректность снимка прогноза.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mk = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(),
  });
  const prisma: any = {
    aiOrderTemplate: mk(), category: mk(), order: mk(),
    user: mk(), platformConfig: mk(), balanceTransaction: mk(),
  };
  prisma.$transaction = vi.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  return { prisma };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: { notifyMastersNewOrder: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../src/services/auditService.js', () => ({ auditService: { log: vi.fn() } }));
vi.mock('../../src/services/eventBus.js', () => ({ eventBus: { emit: vi.fn() } }));
vi.mock('../../src/modules/balance/balance.service.js', () => ({
  balanceService: {
    getBalance: vi.fn().mockResolvedValue(5_000_000),
    holdFunds: vi.fn().mockResolvedValue({ balance: 0 }),
  },
}));
vi.mock('../../src/services/platformConfigService.js', () => ({
  PLATFORM_CONFIG_KEYS: {},
  // Ступень комиссии 15% — проверяем именно арифметику, а не подбор ставки
  getTieredCommissionRate: vi.fn().mockResolvedValue(15),
  getConfigNumber: vi.fn().mockResolvedValue(0),
}));

import { prisma } from '../../src/config/database.js';
import { balanceService } from '../../src/modules/balance/balance.service.js';
import {
  instantOrderService,
  extractUnitQuantity,
  computeEstimateConfidence,
  decideEscalation,
  priceSpreadRatio,
  resolveUnitQuantity,
  extractMeasure,
} from '../../src/modules/instant-order/instant-order.service.js';
import { buildAiContext } from '../../src/modules/instant-order/vision-pipeline.js';

const db = prisma as any;
const CLIENT = 'client-1';

const BASE_INPUT = {
  templateId: 'tpl-1',
  title: 'Замена смесителя',
  description: 'Течёт кран на кухне',
  address: 'Ташкент, Чиланзар',
  images: ['data:image/jpeg;base64,xxx'],
  offerAccepted: true,
};

/** Шаблон AI: цена работ 400 000, уверенность 0.9. */
function template(over: any = {}) {
  return {
    id: 'tpl-1',
    categoryId: 'cat-1',
    estimatedPrice: 400_000,
    confidence: 0.9,
    tier: 'BETTER',
    taskIds: [],
    materials: [],
    estimatedDays: 1,
    imageAnalysis: { ai: { model: 'gpt-4o', needsOnSite: false } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.aiOrderTemplate.findUnique.mockResolvedValue(template());
  db.category.findUnique.mockResolvedValue({ id: 'cat-1', isActive: true, name: 'Сантехника' });
  // visit_fee = 100 000, комиссия с выезда 15%, срочность +40%
  db.platformConfig.findUnique.mockImplementation(async ({ where }: any) => {
    const map: Record<string, string> = {
      visit_fee: '100000',
      visit_fee_commission_rate: '15',
      urgency_multiplier: '40',
    };
    return map[where.key] ? { key: where.key, value: map[where.key] } : null;
  });
  db.order.create.mockImplementation(async ({ data }: any) => ({ id: 'order-1', ...data }));
  (balanceService.getBalance as any).mockResolvedValue(5_000_000);
});

describe('защита оферты', () => {
  it('не создаёт заказ без принятия оферты', async () => {
    await expect(
      instantOrderService.createFromTemplate(CLIENT, { ...BASE_INPUT, offerAccepted: false }),
    ).rejects.toThrow(/оферт/i);

    expect(db.order.create).not.toHaveBeenCalled();
  });
});

describe('денежная арифметика', () => {
  it('считает цену, комиссию и эскроу без срочности', async () => {
    const order = await instantOrderService.createFromTemplate(CLIENT, BASE_INPUT);

    expect(order.price).toBe(400_000);            // цена работ из шаблона
    expect(order.visitFee).toBe(100_000);
    // комиссия: 15% с работ (60 000) + 15% с выезда (15 000)
    expect(order.commissionAmount).toBe(75_000);
    // в эскроу блокируется полная сумма: работы + выезд
    expect(order.escrowAmount).toBe(500_000);
  });

  it('срочность поднимает цену и эскроу', async () => {
    const order = await instantOrderService.createFromTemplate(CLIENT, {
      ...BASE_INPUT, isUrgent: true,
    });

    expect(order.price).toBe(560_000);            // 400 000 × 1.4
    expect(order.urgentMultiplier).toBeCloseTo(1.4, 5);
    expect(order.escrowAmount).toBe(660_000);     // 560 000 + 100 000
  });

  it('не создаёт заказ при нехватке средств на балансе', async () => {
    (balanceService.getBalance as any).mockResolvedValue(100_000);

    await expect(
      instantOrderService.createFromTemplate(CLIENT, BASE_INPUT),
    ).rejects.toThrow(/Недостаточно средств/);

    expect(db.order.create).not.toHaveBeenCalled();
  });

  it('средства блокируются в эскроу на сумму заказа', async () => {
    await instantOrderService.createFromTemplate(CLIENT, BASE_INPUT);

    expect(balanceService.holdFunds).toHaveBeenCalledWith(CLIENT, 500_000, expect.anything());
  });
});

describe('снимок прогноза AI (самообучение)', () => {
  it('фиксирует прогноз БЕЗ надбавки за срочность', async () => {
    // Множитель срочности — наша наценка, к качеству модели отношения не имеет.
    // Если записать 560 000, метрика точности будет завышена на ровном месте.
    const order = await instantOrderService.createFromTemplate(CLIENT, {
      ...BASE_INPUT, isUrgent: true,
    });

    expect(order.aiPredictedPrice).toBe(400_000);
    expect(order.price).toBe(560_000);
  });

  it('сохраняет модель, уверенность и категорию прогноза', async () => {
    const order = await instantOrderService.createFromTemplate(CLIENT, BASE_INPUT);

    expect(order.aiPredictedCategoryId).toBe('cat-1');
    expect(order.aiConfidence).toBe(0.9);
    expect(order.aiModel).toBe('gpt-4o');
    expect(order.aiNeedsOnSite).toBe(false);
    expect(order.aiPredictedAt).toBeInstanceOf(Date);
  });

  it('не падает, если в шаблоне нет метаданных анализа', async () => {
    db.aiOrderTemplate.findUnique.mockResolvedValue(template({ imageAnalysis: null }));

    const order = await instantOrderService.createFromTemplate(CLIENT, BASE_INPUT);

    expect(order.aiModel).toBeNull();
    expect(order.aiNeedsOnSite).toBeNull();
    expect(order.aiPredictedPrice).toBe(400_000);   // цена всё равно зафиксирована
  });
});

describe('валидация входа', () => {
  it('отклоняет несуществующий шаблон', async () => {
    db.aiOrderTemplate.findUnique.mockResolvedValue(null);

    await expect(
      instantOrderService.createFromTemplate(CLIENT, BASE_INPUT),
    ).rejects.toThrow(/не найден/);
  });

  it('отклоняет неактивную категорию', async () => {
    db.category.findUnique.mockResolvedValue({ id: 'cat-1', isActive: false });

    await expect(
      instantOrderService.createFromTemplate(CLIENT, BASE_INPUT),
    ).rejects.toThrow();
  });
});

describe('пометки AI-заказа', () => {
  it('заказ помечается как созданный через ФотоЗаказ', async () => {
    const order = await instantOrderService.createFromTemplate(CLIENT, BASE_INPUT);

    expect(order.isInstantAiOrder).toBe(true);
    expect(order.source).toBe('INSTANT_AI');
    expect(order.aiTemplateId).toBe('tpl-1');
  });
});

describe('количество единиц работы', () => {
  it('считает количество рядом с предметом', () => {
    expect(extractUnitQuantity('заменить 3 розетки')).toBe(3);
    expect(extractUnitQuantity('поменять 2 новые дверцы')).toBe(2);
    expect(extractUnitQuantity('нужно 5 шт')).toBe(5);
    expect(extractUnitQuantity('две розетки не работают')).toBe(2);
  });

  it('игнорирует числа, не относящиеся к количеству работ', () => {
    // Главная причина завышенных смет: любое число в тексте раньше
    // умножало цену — «уже 2 дня» превращалось в две протечки.
    expect(extractUnitQuantity('течёт кран уже 2 дня')).toBeNull();
    expect(extractUnitQuantity('живу на 5 этаже, сломался замок')).toBeNull();
    expect(extractUnitQuantity('труба диаметром 20 мм подтекает')).toBeNull();
    expect(extractUnitQuantity('перезвоните после 18:00')).toBeNull();
  });

  it('без чисел возвращает null', () => {
    expect(extractUnitQuantity('не работает розетка')).toBeNull();
    expect(extractUnitQuantity('')).toBeNull();
  });

  it('ограничивает количество разумным потолком', () => {
    expect(extractUnitQuantity('99 розеток')).toBeLessThanOrEqual(20);
  });
});

describe('уверенность в смете', () => {
  it('следует за уверенностью AI, а не за уровнем варианта', () => {
    const high = computeEstimateConfidence({ aiTopConfidence: 95, matchedCatalog: true, quantityKnown: true });
    const low = computeEstimateConfidence({ aiTopConfidence: 55, matchedCatalog: true, quantityKnown: true });
    expect(high).toBeGreaterThan(low);
  });

  it('fallback-путь менее уверен, чем каталожный', () => {
    const catalog = computeEstimateConfidence({ aiTopConfidence: 80, matchedCatalog: true, quantityKnown: true });
    const fallback = computeEstimateConfidence({ aiTopConfidence: 80, matchedCatalog: false, quantityKnown: true });
    expect(fallback).toBeLessThan(catalog);
  });

  it('похожий закрытый заказ в истории повышает уверенность', () => {
    const bare = computeEstimateConfidence({ aiTopConfidence: 75, matchedCatalog: true, quantityKnown: true });
    const supported = computeEstimateConfidence({
      aiTopConfidence: 75, matchedCatalog: true, quantityKnown: true, ragTopSimilarity: 0.86,
    });
    expect(supported).toBeGreaterThan(bare);
  });

  it('без AI-анализа уверенность заметно ниже', () => {
    const manual = computeEstimateConfidence({ aiTopConfidence: null, matchedCatalog: true, quantityKnown: true });
    expect(manual).toBeLessThan(0.7);
  });

  it('всегда остаётся в границах 0.35..0.95', () => {
    const max = computeEstimateConfidence({
      aiTopConfidence: 100, matchedCatalog: true, quantityKnown: true, ragTopSimilarity: 1, knowledgeTopSimilarity: 1,
    });
    const min = computeEstimateConfidence({
      aiTopConfidence: 0, matchedCatalog: false, quantityKnown: false,
    });
    expect(max).toBeLessThanOrEqual(0.95);
    expect(min).toBeGreaterThanOrEqual(0.35);
  });
});

describe('ширина ценового разброса', () => {
  it('считает разброс относительно середины диапазона', () => {
    // 80–150 тыс: середина 115, разброс 70 / 115 ≈ 0.61
    expect(priceSpreadRatio({ min: 80_000, max: 150_000 })).toBeCloseTo(0.61, 1);
    // 100–110 тыс: узкий диапазон
    expect(priceSpreadRatio({ min: 100_000, max: 110_000 })).toBeCloseTo(0.095, 2);
  });

  it('на отсутствующем или битом диапазоне возвращает null', () => {
    expect(priceSpreadRatio(null)).toBeNull();
    expect(priceSpreadRatio({ min: 0, max: 100 })).toBeNull();
    expect(priceSpreadRatio({ min: 500, max: 100 })).toBeNull();
  });
});

describe('лестница эскалации', () => {
  it('уверенность + узкий разброс → фиксированная цена', () => {
    expect(decideEscalation({ confidence: 90, priceSpread: 0.2, modelSaysOnSite: false })).toBe('AUTO');
  });

  it('уверенность есть, но разброс широкий → не фиксируем цену', () => {
    // Классический случай: модель уверена, что это покраска, но 600 тыс это
    // или 1,2 млн — не знает. Обещать одну цифру здесь нельзя.
    expect(decideEscalation({ confidence: 92, priceSpread: 0.9, modelSaysOnSite: false })).toBe('ON_SITE');
  });

  it('средняя уверенность → уточняющий вопрос, а не сразу выезд', () => {
    expect(decideEscalation({ confidence: 70, priceSpread: 0.4, modelSaysOnSite: false })).toBe('CONFIRM');
  });

  it('требование обмера при очень узком диапазоне считается перестраховкой', () => {
    expect(decideEscalation({ confidence: 88, priceSpread: 0.1, modelSaysOnSite: true })).toBe('AUTO');
  });

  it('требование обмера при заметном разбросе уважается', () => {
    expect(decideEscalation({ confidence: 88, priceSpread: 0.25, modelSaysOnSite: true })).toBe('CONFIRM');
    expect(decideEscalation({ confidence: 70, priceSpread: 0.5, modelSaysOnSite: true })).toBe('ON_SITE');
  });

  it('без цены фиксировать нечего', () => {
    expect(decideEscalation({ confidence: 95, priceSpread: null, modelSaysOnSite: false })).toBe('CONFIRM');
    expect(decideEscalation({ confidence: 95, priceSpread: null, modelSaysOnSite: true })).toBe('ON_SITE');
  });

  it('низкая уверенность отправляет на выезд', () => {
    expect(decideEscalation({ confidence: 40, priceSpread: 0.2, modelSaysOnSite: false })).toBe('ON_SITE');
  });

  describe('когда цену считает прайс-реестр', () => {
    // В контракте «спецификация» модель не называет цену вовсе, поэтому
    // диапазона от неё нет. Без отдельной ветки отсутствие диапазона читалось
    // бы как «цены нет», и мгновенную смету не получал бы никто.
    it('уверенное распознавание даёт смету сразу, хотя диапазона от модели нет', () => {
      expect(
        decideEscalation({ confidence: 90, priceSpread: null, modelSaysOnSite: false, hasSpecPrice: true }),
      ).toBe('AUTO');
    });

    it('средняя уверенность — уточняющий вопрос', () => {
      expect(
        decideEscalation({ confidence: 70, priceSpread: null, modelSaysOnSite: false, hasSpecPrice: true }),
      ).toBe('CONFIRM');
    });

    it('низкая уверенность — выезд, даже когда цена считается по прайсу', () => {
      expect(
        decideEscalation({ confidence: 45, priceSpread: null, modelSaysOnSite: false, hasSpecPrice: true }),
      ).toBe('ON_SITE');
    });

    it('требование обмера не даёт зафиксировать цену', () => {
      expect(
        decideEscalation({ confidence: 90, priceSpread: null, modelSaysOnSite: true, hasSpecPrice: true }),
      ).toBe('CONFIRM');
      expect(
        decideEscalation({ confidence: 65, priceSpread: null, modelSaysOnSite: true, hasSpecPrice: true }),
      ).toBe('ON_SITE');
    });

    it('без анализа категории решение не принимается', () => {
      expect(
        decideEscalation({ confidence: null, priceSpread: null, modelSaysOnSite: false, hasSpecPrice: true }),
      ).toBe('CONFIRM');
    });
  });
});

describe('контекст от Vision', () => {
  it('собирает резюме, объекты на фото и материалы', () => {
    const ctx = buildAiContext({
      summary: 'Течёт смеситель на кухне',
      visualTags: ['смеситель grohe', 'гибкая подводка'],
      materials: ['прокладка'],
    } as any);

    expect(ctx).toContain('Течёт смеситель');
    expect(ctx).toContain('смеситель grohe');
    expect(ctx).toContain('прокладка');
  });

  it('без анализа возвращает пустую строку', () => {
    expect(buildAiContext(null)).toBe('');
  });
});

describe('кухня по модулям — количество', () => {
  it('понимает количество модулей и секций', () => {
    expect(extractUnitQuantity('собрать один кухонный модуль')).toBe(1);
    expect(extractUnitQuantity('кухня из 6 модулей')).toBe(6);
    expect(extractUnitQuantity('две секции')).toBe(2);
  });

  it('берёт количество из пересказа модели, если клиент его не назвал', () => {
    // Клиент прислал чертёж одного модуля и спросил «как собрать?» — число
    // не написано, оно на картинке.
    const ai = { summary: 'Необходимо собрать один кухонный модуль по предоставленной схеме.' } as any;
    expect(resolveUnitQuantity('Как собрать?', ai)).toBe(1);
  });

  it('слова клиента важнее пересказа модели', () => {
    const ai = { summary: 'Собрать один кухонный модуль' } as any;
    expect(resolveUnitQuantity('собрать 3 модуля', ai)).toBe(3);
  });

  it('без текста и анализа количества нет', () => {
    expect(resolveUnitQuantity('', null)).toBeNull();
  });
});

describe('extractMeasure — площадь и метраж из слов клиента', () => {
  it.each([
    ['покрасить 20 м²', 20, 'м²'],
    ['поклеить обои, 18 кв.м', 18, 'м²'],
    ['уборка квартиры 65 квадратов', 65, 'м²'],
    ['комната 4 на 5 м', 20, 'м²'],
    ['покос 6 соток', 600, 'м²'],
    ['забор 12 метров', 12, 'м.п.'],
    ['плинтус 7,5 м.п.', 7.5, 'м.п.'],
  ])('«%s» → %s %s', (text, value, unit) => {
    expect(extractMeasure(text)).toMatchObject({ value, unit });
  });

  it('не принимает за метраж миллиметры, минуты, мешки и «кв.» квартиры', () => {
    expect(extractMeasure('саморезы 5 мм')).toBeNull();
    expect(extractMeasure('приехать через 30 мин')).toBeNull();
    expect(extractMeasure('3 мешка смеси')).toBeNull();
    expect(extractMeasure('3 кв. мне нужно отремонтировать')).toBeNull();
    expect(extractMeasure('поменять розетку')).toBeNull();
  });

  it('площадь комнаты — это пол, площадь стены — сама поверхность', () => {
    expect(extractMeasure('поклеить обои в спальне 16 квадратов')?.basis).toBe('room');
    expect(extractMeasure('комната 16 м², покрасить стены')?.basis).toBe('room');
    expect(extractMeasure('покрасить стену 12 м²')?.basis).toBe('surface');
    expect(extractMeasure('стена 3 на 4 м')?.basis).toBe('surface');
    expect(extractMeasure('покрасить 3 на 4 м')?.basis).toBe('room');
  });
});
