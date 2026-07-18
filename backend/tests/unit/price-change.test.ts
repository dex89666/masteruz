// ============================================
// MasterUz — Изменение цены по ходу работ
// Проверяем: лимиты, обязательное согласие клиента,
// пересчёт денег, расчёт по факту при отказе.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mockOrder = { findUnique: vi.fn(), update: vi.fn() };
  const mockPcr = { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
  const mockUser = { findUnique: vi.fn(), update: vi.fn() };
  const mockBalanceTx = { create: vi.fn() };
  const prisma = {
    order: mockOrder,
    priceChangeRequest: mockPcr,
    user: mockUser,
    balanceTransaction: mockBalanceTx,
    auditLog: { create: vi.fn() },
    // Поддерживаем обе формы: $transaction([...]) и $transaction(async tx => ...)
    $transaction: vi.fn((ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops(prisma))),
  };
  return { prisma };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/services/auditService.js', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../../src/services/fraudDetectionService.js', () => ({
  recordFraudSignal: vi.fn(),
}));

vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: {
    notifyPriceChangeCreated: vi.fn().mockResolvedValue(undefined),
    notifyPriceChangeModerated: vi.fn().mockResolvedValue(undefined),
    notifyPriceChangeResponded: vi.fn().mockResolvedValue(undefined),
  },
}));

// Конфиг платформы: лимит +20% за раз, +50% суммарно, комиссия с выезда 0%.
vi.mock('../../src/services/platformConfigService.js', () => ({
  PLATFORM_CONFIG_KEYS: {
    priceChangeLimitPct: 'price_change_limit_pct',
    priceChangeMaxTotalPct: 'price_change_max_total_pct',
    visitFeeCommissionRate: 'visit_fee_commission_rate',
  },
  getConfigNumber: vi.fn(async (key: string) => {
    if (key === 'price_change_limit_pct') return 20;
    if (key === 'price_change_max_total_pct') return 50;
    if (key === 'visit_fee_commission_rate') return 0;
    return 0;
  }),
  getTieredEffectiveCommissionRate: vi.fn(async () => 15),
}));

import { prisma } from '../../src/config/database.js';
import { priceChangeService } from '../../src/modules/orders/price-change.service.js';
import { recordFraudSignal } from '../../src/services/fraudDetectionService.js';
import { notificationService } from '../../src/services/notificationService.js';

const db = prisma as any;

const MASTER = 'master-1';
const CLIENT = 'client-1';
const ORDER_ID = 'order-1';

// Заказ: работы 1 000 000 + выезд 100 000 = 1 100 000. Депозит 330 000.
function baseOrder(overrides: any = {}) {
  return {
    id: ORDER_ID,
    clientId: CLIENT,
    masterId: MASTER,
    status: 'IN_PROGRESS',
    price: 1_000_000,
    visitFee: 100_000,
    depositAmount: 330_000,
    escrowAmount: 330_000,
    remainingAmount: 770_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.priceChangeRequest.findFirst.mockResolvedValue(null);
  db.priceChangeRequest.create.mockImplementation(async ({ data }: any) => ({ id: 'pcr-1', ...data }));
  db.priceChangeRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'pcr-1', ...data }));
  db.order.update.mockImplementation(async ({ data }: any) => ({ id: ORDER_ID, ...data }));
  db.user.findUnique.mockResolvedValue({ balance: 500_000 });
});

describe('propose — предложение новой цены', () => {
  it('рост в пределах лимита (+20%) → PENDING (ждёт клиента)', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());

    const res = await priceChangeService.propose(MASTER, ORDER_ID, {
      newPrice: 1_200_000, // +20% — ровно на лимите
      reason: 'Дополнительная разводка труб',
    });

    expect(res.status).toBe('PENDING');
    expect(res.newPrice).toBe(1_200_000);
  });

  it('рост выше лимита (+30%) → MODERATION (сначала админ)', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());

    const res = await priceChangeService.propose(MASTER, ORDER_ID, {
      newPrice: 1_300_000, // +30% > 20%
      reason: 'Требуется замена стояка',
    });

    expect(res.status).toBe('MODERATION');
  });

  it('ЛЮБОЕ снижение цены → MODERATION + фрод-сигнал (защита от обхода)', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());

    const res = await priceChangeService.propose(MASTER, ORDER_ID, {
      newPrice: 700_000, // −30%
      reason: 'Часть работ не потребовалась',
    });

    expect(res.status).toBe('MODERATION');
    expect(recordFraudSignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: MASTER, signal: 'PRICE_DECREASE_REQUEST' })
    );
  });

  it('суммарный рост выше +50% от изначальной цены → отказ', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder({ price: 1_400_000 }));
    // Первая заявка хранит изначальную цену 1 000 000
    db.priceChangeRequest.findFirst
      .mockResolvedValueOnce(null) // нет активной заявки
      .mockResolvedValueOnce({ oldPrice: 1_000_000 }); // первая заявка

    await expect(
      priceChangeService.propose(MASTER, ORDER_ID, {
        newPrice: 1_600_000, // +60% от изначальной 1 000 000
        reason: 'Ещё работы',
      })
    ).rejects.toThrow(/Суммарный рост/);
  });

  it('чужой мастер не может менять цену', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder({ masterId: 'other-master' }));

    await expect(
      priceChangeService.propose(MASTER, ORDER_ID, { newPrice: 1_100_000, reason: 'Причина' })
    ).rejects.toThrow(/не назначены/);
  });

  it('нельзя менять цену в неподходящем статусе', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder({ status: 'COMPLETED' }));

    await expect(
      priceChangeService.propose(MASTER, ORDER_ID, { newPrice: 1_100_000, reason: 'Причина' })
    ).rejects.toThrow(/Нельзя менять цену/);
  });

  it('нельзя создать вторую активную заявку', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());
    db.priceChangeRequest.findFirst.mockResolvedValueOnce({ id: 'pcr-existing', status: 'PENDING' });

    await expect(
      priceChangeService.propose(MASTER, ORDER_ID, { newPrice: 1_100_000, reason: 'Причина' })
    ).rejects.toThrow(/уже есть активная заявка/);
  });

  it('требует причину изменения', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());

    await expect(
      priceChangeService.propose(MASTER, ORDER_ID, { newPrice: 1_100_000, reason: '  ' })
    ).rejects.toThrow(/причину/);
  });
});

describe('approve — клиент подтверждает новую цену', () => {
  it('пересчитывает цену, комиссию и остаток; депозит не трогает', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1',
      kind: 'PRICE_CHANGE',
      status: 'PENDING',
      oldPrice: 1_000_000,
      newPrice: 1_200_000,
      order: baseOrder(),
    });

    const { order } = await priceChangeService.approve(CLIENT, 'pcr-1');

    // total = 1 200 000 работ + 100 000 выезд = 1 300 000
    // остаток = 1 300 000 − депозит 330 000 = 970 000
    expect(order.price).toBe(1_200_000);
    expect(order.remainingAmount).toBe(970_000);
    // комиссия 15% с работ + 0% с выезда
    expect(order.commissionAmount).toBe(180_000);
  });

  it('при снижении цены ниже депозита остаток = 0, переплата возвращается клиенту', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1',
      kind: 'PRICE_CHANGE',
      status: 'PENDING',
      oldPrice: 1_000_000,
      newPrice: 100_000, // total = 200 000 < депозита 330 000
      order: baseOrder(),
    });

    const { order } = await priceChangeService.approve(CLIENT, 'pcr-1');

    expect(order.remainingAmount).toBe(0);
    // Депозит и эскроу ужимаются до фактической суммы 200 000
    expect(order.depositAmount).toBe(200_000);
    expect(order.escrowAmount).toBe(200_000);

    // Клиенту возвращено 330 000 − 200 000 = 130 000
    const refund = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(refund.type).toBe('REFUND');
    expect(refund.amount).toBe(130_000);
    expect(refund.balanceAfter).toBe(630_000); // 500 000 + 130 000
  });

  it('если итог больше депозита — возврата нет', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 1_200_000,
      order: baseOrder(),
    });

    await priceChangeService.approve(CLIENT, 'pcr-1');

    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('чужой клиент не может подтвердить', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 1_200_000,
      order: baseOrder({ clientId: 'other-client' }),
    });

    await expect(priceChangeService.approve(CLIENT, 'pcr-1')).rejects.toThrow(/не ваш заказ/);
  });

  it('нельзя подтвердить заявку на модерации', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'MODERATION',
      oldPrice: 1_000_000, newPrice: 1_500_000,
      order: baseOrder(),
    });

    await expect(priceChangeService.approve(CLIENT, 'pcr-1')).rejects.toThrow(/недоступна/);
  });
});

describe('reject + settlement — клиент отказался от новой цены', () => {
  it('отказ от PRICE_CHANGE не переводит заказ в спор', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 1_200_000,
      orderId: ORDER_ID, order: baseOrder(),
    });

    const res = await priceChangeService.reject(CLIENT, 'pcr-1', 'Слишком дорого');
    expect(res.status).toBe('REJECTED');
    // Заказ не в споре — мастер должен заявить фактический объём
    const orderUpdate = db.order.update.mock.calls[0][0];
    expect(orderUpdate.data.status).toBeUndefined();
  });

  it('мастер заявляет фактический объём только после отказа клиента', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());
    db.priceChangeRequest.findFirst.mockResolvedValueOnce(null); // нет отказа

    await expect(
      priceChangeService.proposeSettlement(MASTER, ORDER_ID, { completedAmount: 400_000, reason: 'Сделано' })
    ).rejects.toThrow(/только после отказа/);
  });

  it('расчёт по факту → MODERATION + фрод-сигнал (защита от сговора)', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());
    db.priceChangeRequest.findFirst
      .mockResolvedValueOnce({ id: 'pcr-rejected', status: 'REJECTED' }) // отказ клиента есть
      .mockResolvedValueOnce(null); // нет активной заявки

    const res = await priceChangeService.proposeSettlement(MASTER, ORDER_ID, {
      completedAmount: 400_000,
      reason: 'Демонтаж выполнен, монтаж не начат',
    });

    // Подтверждения клиента недостаточно — сначала админ.
    expect(res.status).toBe('MODERATION');
    expect(recordFraudSignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: MASTER, signal: 'SETTLEMENT_UNDERDECLARE' })
    );
  });

  it('нельзя заявить объём больше согласованной цены', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());
    db.priceChangeRequest.findFirst
      .mockResolvedValueOnce({ id: 'pcr-rejected', status: 'REJECTED' }) // отказ есть
      .mockResolvedValueOnce(null); // нет активной

    await expect(
      priceChangeService.proposeSettlement(MASTER, ORDER_ID, { completedAmount: 1_500_000, reason: 'Сделано' })
    ).rejects.toThrow(/не может превышать/);
  });

  it('подтверждение расчёта → выезд + фактический объём, заказ на оплату остатка', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-2', kind: 'SETTLEMENT', status: 'PENDING',
      oldPrice: 1_000_000,
      newPrice: 400_000, // фактически выполнено
      order: baseOrder(),
    });

    const { order } = await priceChangeService.approve(CLIENT, 'pcr-2');

    // total = 400 000 работ + 100 000 выезд = 500 000
    expect(order.price).toBe(400_000);
    // остаток = 500 000 − депозит 330 000 = 170 000
    expect(order.remainingAmount).toBe(170_000);
    expect(order.status).toBe('AWAITING_REMAINDER');
  });

  it('выезд оплачивается даже при нулевом объёме работ, остальное возвращается', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-2', kind: 'SETTLEMENT', status: 'PENDING',
      oldPrice: 1_000_000,
      newPrice: 0, // работы не выполнялись
      order: baseOrder(),
    });

    const { order } = await priceChangeService.approve(CLIENT, 'pcr-2');

    // total = 0 работ + 100 000 выезд = 100 000 — выезд удержан обязательно.
    expect(order.price).toBe(0);
    expect(order.remainingAmount).toBe(0);
    expect(order.depositAmount).toBe(100_000);

    // Клиенту возвращается 330 000 − 100 000 = 230 000
    const refund = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(refund.type).toBe('REFUND');
    expect(refund.amount).toBe(230_000);
  });

  it('несогласие с расчётом → заказ в спор (решает админ)', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-2', kind: 'SETTLEMENT', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 400_000,
      orderId: ORDER_ID, order: baseOrder(),
    });

    await priceChangeService.reject(CLIENT, 'pcr-2', 'Ничего не сделал');

    const orderUpdate = db.order.update.mock.calls[0][0];
    expect(orderUpdate.data.status).toBe('DISPUTED');
    expect(orderUpdate.data.disputeReason).toMatch(/не согласен/);
  });
});

describe('уведомления', () => {
  it('создание заявки → уведомление отправлено', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());

    await priceChangeService.propose(MASTER, ORDER_ID, {
      newPrice: 1_200_000,
      reason: 'Дополнительные работы',
    });

    expect(notificationService.notifyPriceChangeCreated).toHaveBeenCalledWith('pcr-1');
  });

  it('подтверждение клиентом → уведомление мастеру (approved=true)', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 1_200_000,
      order: baseOrder(),
    });

    await priceChangeService.approve(CLIENT, 'pcr-1');

    expect(notificationService.notifyPriceChangeResponded).toHaveBeenCalledWith('pcr-1', true);
  });

  it('отклонение клиентом → уведомление мастеру (approved=false)', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', kind: 'PRICE_CHANGE', status: 'PENDING',
      oldPrice: 1_000_000, newPrice: 1_200_000,
      orderId: ORDER_ID, order: baseOrder(),
    });

    await priceChangeService.reject(CLIENT, 'pcr-1');

    expect(notificationService.notifyPriceChangeResponded).toHaveBeenCalledWith('pcr-1', false);
  });

  it('решение модератора → уведомление с флагом решения', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', status: 'MODERATION', orderId: ORDER_ID, newPrice: 1_500_000,
    });

    await priceChangeService.moderate('admin-1', 'pcr-1', false, 'Накрутка');

    expect(notificationService.notifyPriceChangeModerated).toHaveBeenCalledWith('pcr-1', false);
  });

  it('ошибка уведомления не ломает основную операцию', async () => {
    db.order.findUnique.mockResolvedValueOnce(baseOrder());
    (notificationService.notifyPriceChangeCreated as any).mockRejectedValueOnce(new Error('telegram down'));

    // Заявка всё равно должна создаться
    const res = await priceChangeService.propose(MASTER, ORDER_ID, {
      newPrice: 1_200_000,
      reason: 'Дополнительные работы',
    });

    expect(res.status).toBe('PENDING');
  });
});

describe('moderate — админ пропускает заявку выше лимита', () => {
  it('одобрение админом → уходит клиенту (PENDING)', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', status: 'MODERATION', orderId: ORDER_ID, newPrice: 1_500_000,
    });

    const res = await priceChangeService.moderate('admin-1', 'pcr-1', true, 'Обосновано');
    expect(res.status).toBe('PENDING');
  });

  it('отклонение админом → CANCELLED', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({
      id: 'pcr-1', status: 'MODERATION', orderId: ORDER_ID, newPrice: 1_500_000,
    });

    const res = await priceChangeService.moderate('admin-1', 'pcr-1', false, 'Накрутка');
    expect(res.status).toBe('CANCELLED');
  });

  it('нельзя модерировать заявку не на модерации', async () => {
    db.priceChangeRequest.findUnique.mockResolvedValueOnce({ id: 'pcr-1', status: 'PENDING' });

    await expect(priceChangeService.moderate('admin-1', 'pcr-1', true)).rejects.toThrow(/не на модерации/);
  });
});
