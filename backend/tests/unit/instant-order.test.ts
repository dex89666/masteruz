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
import { instantOrderService } from '../../src/modules/instant-order/instant-order.service.js';

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
