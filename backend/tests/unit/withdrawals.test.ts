// ============================================
// MasterUz — Вывод средств мастером
// Здесь движутся реальные деньги: проверяем, что нельзя
// вывести больше, чем есть, и что возврат происходит ровно один раз.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mkModel = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(),
  });
  const prisma: any = {
    user: mkModel(),
    linkedCard: mkModel(),
    withdrawalRequest: mkModel(),
    balanceTransaction: mkModel(),
    auditLog: mkModel(),
  };
  prisma.$transaction = vi.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  return { prisma };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/auditService.js', () => ({ auditService: { log: vi.fn() } }));
vi.mock('../../src/services/alertRouter.js', () => ({
  alertRouter: { dispatch: vi.fn().mockResolvedValue({ sent: 0 }) },
}));
vi.mock('../../src/services/platformConfigService.js', () => ({
  PLATFORM_CONFIG_KEYS: {
    withdrawalMinAmount: 'withdrawal_min_amount',
    withdrawalCommissionRate: 'withdrawal_commission_rate',
    withdrawalEnabled: 'withdrawal_enabled',
  },
  getConfigNumber: vi.fn(async (k: string) =>
    k === 'withdrawal_min_amount' ? 50_000 : 0),
  getConfigBool: vi.fn(async () => true),
}));

import { prisma } from '../../src/config/database.js';
import { withdrawalsService } from '../../src/modules/withdrawals/withdrawals.service.js';

const db = prisma as any;
const USER = 'master-1';
const CARD = '11111111-1111-1111-1111-111111111111';

function card(over: any = {}) {
  return { id: CARD, userId: USER, cardNumber: '8600 **** **** 1234',
           cardHolder: 'IVAN IVANOV', provider: 'UZCARD', isActive: true, ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.linkedCard.findUnique.mockResolvedValue(card());
  db.withdrawalRequest.findFirst.mockResolvedValue(null);       // нет активных заявок
  db.user.updateMany.mockResolvedValue({ count: 1 });           // списание удалось
  db.user.findUnique.mockResolvedValue({ balance: 700_000 });
  db.balanceTransaction.create.mockResolvedValue({});
  db.withdrawalRequest.create.mockImplementation(async ({ data }: any) => ({ id: 'wr-1', ...data }));
});

describe('создание заявки', () => {
  it('успешно списывает баланс и создаёт заявку', async () => {
    const res = await withdrawalsService.create(USER, { amount: 200_000, cardId: CARD });

    expect(res.amount).toBe(200_000);
    expect(res.payoutAmount).toBe(200_000);   // комиссия 0
    expect(res.cardNumber).toBe('8600 **** **** 1234');

    // Списание — условным updateMany с проверкой достаточности внутри запроса
    const call = db.user.updateMany.mock.calls[0][0];
    expect(call.where.balance.gte).toBe(200_000);
    expect(call.data.balance.decrement).toBe(200_000);
  });

  it('не даёт вывести больше, чем на балансе', async () => {
    db.user.updateMany.mockResolvedValueOnce({ count: 0 }); // условие не выполнилось
    db.user.findUnique.mockResolvedValueOnce({ balance: 10_000 });

    await expect(
      withdrawalsService.create(USER, { amount: 900_000, cardId: CARD }),
    ).rejects.toThrow(/Недостаточно средств/);
  });

  it('отклоняет сумму ниже минимальной', async () => {
    await expect(
      withdrawalsService.create(USER, { amount: 10_000, cardId: CARD }),
    ).rejects.toThrow(/Минимальная сумма/);
  });

  it('запрещает вторую активную заявку', async () => {
    db.withdrawalRequest.findFirst.mockResolvedValueOnce({ id: 'wr-old', status: 'PENDING' });
    await expect(
      withdrawalsService.create(USER, { amount: 200_000, cardId: CARD }),
    ).rejects.toThrow(/уже есть заявка/);
  });

  it('нельзя вывести на чужую карту', async () => {
    db.linkedCard.findUnique.mockResolvedValueOnce(card({ userId: 'other-user' }));
    await expect(
      withdrawalsService.create(USER, { amount: 200_000, cardId: CARD }),
    ).rejects.toThrow(/Карта не найдена/);
  });

  it('нельзя вывести на неактивную карту', async () => {
    db.linkedCard.findUnique.mockResolvedValueOnce(card({ isActive: false }));
    await expect(
      withdrawalsService.create(USER, { amount: 200_000, cardId: CARD }),
    ).rejects.toThrow(/неактивна/);
  });

  it('удерживает комиссию, если она настроена', async () => {
    const cfg = await import('../../src/services/platformConfigService.js');
    (cfg.getConfigNumber as any).mockImplementation(async (k: string) =>
      k === 'withdrawal_min_amount' ? 50_000 : 10);   // 10%

    const res = await withdrawalsService.create(USER, { amount: 200_000, cardId: CARD });
    expect(res.commission).toBe(20_000);
    expect(res.payoutAmount).toBe(180_000);
  });
});

describe('отмена и отклонение — возврат денег', () => {
  beforeEach(() => {
    db.withdrawalRequest.updateMany.mockResolvedValue({ count: 1 });
    db.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'wr-1', userId: USER, amount: 200_000, status: 'PENDING',
    });
    db.user.update.mockResolvedValue({});
  });

  it('мастер отзывает заявку → сумма возвращается', async () => {
    db.user.findUnique.mockResolvedValue({ balance: 500_000 });

    await withdrawalsService.cancel(USER, 'wr-1');

    const tx = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(tx.type).toBe('WITHDRAWAL_REFUND');
    expect(tx.amount).toBe(200_000);
    expect(tx.balanceAfter).toBe(700_000);   // 500 000 + 200 000
  });

  it('нельзя отозвать чужую заявку', async () => {
    db.withdrawalRequest.findUnique.mockResolvedValueOnce({
      id: 'wr-1', userId: 'someone-else', amount: 200_000, status: 'PENDING',
    });
    await expect(withdrawalsService.cancel(USER, 'wr-1')).rejects.toThrow(/не ваша заявка/);
  });

  it('нельзя отозвать заявку, уже взятую в работу', async () => {
    db.withdrawalRequest.findUnique.mockResolvedValueOnce({
      id: 'wr-1', userId: USER, amount: 200_000, status: 'PROCESSING',
    });
    await expect(withdrawalsService.cancel(USER, 'wr-1')).rejects.toThrow(/нельзя отозвать/);
  });

  it('деньги не возвращаются дважды при гонке', async () => {
    // Параллельный запрос уже закрыл заявку → условный захват не сработал
    db.withdrawalRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      withdrawalsService.reject('admin-1', 'wr-1', 'дубль'),
    ).rejects.toThrow(/уже обработана/);

    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('отклонение требует причину', async () => {
    await expect(withdrawalsService.reject('admin-1', 'wr-1', '  ')).rejects.toThrow(/причину/);
  });
});

describe('выполнение заявки', () => {
  it('баланс НЕ трогается повторно — он списан при создании', async () => {
    db.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'wr-1', userId: USER, amount: 200_000, payoutAmount: 200_000,
      status: 'PROCESSING', cardNumber: '8600 **** **** 1234',
    });
    db.withdrawalRequest.update.mockResolvedValue({ id: 'wr-1', status: 'COMPLETED' });

    await withdrawalsService.markCompleted('admin-1', 'wr-1', 'поручение №123');

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('нельзя выполнить уже закрытую заявку', async () => {
    db.withdrawalRequest.findUnique.mockResolvedValue({
      id: 'wr-1', userId: USER, amount: 200_000, status: 'COMPLETED',
    });
    await expect(
      withdrawalsService.markCompleted('admin-1', 'wr-1'),
    ).rejects.toThrow(/уже закрыта/);
  });
});
