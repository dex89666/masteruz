// ============================================
// MasterUz — Баланс и эскроу
// ============================================
// Здесь живут деньги платформы. Существующие тесты (financial-transactions,
// order-lifecycle) мокают balanceService целиком и проверяют лишь ФАКТ вызова —
// сама логика движения средств до сих пор не была покрыта.
//
// Проверяем то, что дороже всего сломать: невозможность уйти в минус,
// отсутствие двойных выплат при гонке и корректность сумм.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mk = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(),
  });
  const prisma: any = { user: mk(), order: mk(), balanceTransaction: mk() };
  prisma.$transaction = vi.fn((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prisma));
  return { prisma };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../../src/config/database.js';
import { balanceService } from '../../src/modules/balance/balance.service.js';

const db = prisma as any;
const CLIENT = 'client-1';
const MASTER = 'master-1';
const ORDER = 'order-1';

beforeEach(() => {
  vi.clearAllMocks();
  db.balanceTransaction.create.mockResolvedValue({ id: 'tx-1' });
  db.user.update.mockResolvedValue({});
});

describe('holdFunds — блокировка средств под заказ', () => {
  it('списывает сумму и пишет транзакцию ESCROW_HOLD', async () => {
    db.user.findUnique.mockResolvedValue({ balance: 500_000 });
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const res = await balanceService.holdFunds(CLIENT, 200_000, ORDER);

    expect(res.balance).toBe(300_000);
    const tx = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(tx.type).toBe('ESCROW_HOLD');
    expect(tx.amount).toBe(-200_000);
    expect(tx.balanceBefore).toBe(500_000);
    expect(tx.balanceAfter).toBe(300_000);
  });

  it('не даёт заблокировать больше, чем на балансе', async () => {
    db.user.findUnique.mockResolvedValue({ balance: 50_000 });

    await expect(
      balanceService.holdFunds(CLIENT, 200_000, ORDER),
    ).rejects.toThrow(/Недостаточно средств/);

    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('баланс не уходит в минус при гонке двух заказов', async () => {
    // Проверка прошла, но параллельный заказ успел списать средства первым:
    // условный updateMany не находит строку с достаточным балансом.
    db.user.findUnique.mockResolvedValue({ balance: 200_000 });
    db.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      balanceService.holdFunds(CLIENT, 200_000, ORDER),
    ).rejects.toThrow(/Недостаточно средств/);

    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('списание идёт условным запросом, а не слепым UPDATE', async () => {
    db.user.findUnique.mockResolvedValue({ balance: 500_000 });
    db.user.updateMany.mockResolvedValue({ count: 1 });

    await balanceService.holdFunds(CLIENT, 200_000, ORDER);

    // Именно это условие защищает от отрицательного баланса
    const call = db.user.updateMany.mock.calls[0][0];
    expect(call.where.balance.gte).toBe(200_000);
    expect(call.data.balance.decrement).toBe(200_000);
  });

  it('отклоняет нулевую и отрицательную сумму', async () => {
    await expect(balanceService.holdFunds(CLIENT, 0, ORDER)).rejects.toThrow();
    await expect(balanceService.holdFunds(CLIENT, -100, ORDER)).rejects.toThrow();
  });
});

describe('releaseFunds — выплата мастеру после завершения', () => {
  beforeEach(() => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 500_000, clientId: CLIENT, masterId: MASTER,
      price: 400_000, commissionAmount: 60_000, visitFee: 100_000,
    });
  });

  it('мастер получает эскроу за вычетом комиссии', async () => {
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUnique.mockResolvedValue({ balance: 0 });

    const res = await balanceService.releaseFunds(ORDER);

    expect(res.masterPayout).toBe(440_000);   // 500 000 − 60 000
    expect(res.commission).toBe(60_000);
  });

  it('повторная выплата предотвращена при гонке', async () => {
    // Эскроу уже обнулён параллельным вызовом
    db.order.updateMany.mockResolvedValue({ count: 0 });

    const res = await balanceService.releaseFunds(ORDER);

    expect(res.masterPayout).toBe(0);
    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('не выплачивает, если мастер не назначен', async () => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 500_000, clientId: CLIENT, masterId: null,
      price: 400_000, commissionAmount: 60_000,
    });

    await expect(balanceService.releaseFunds(ORDER)).rejects.toThrow(/Мастер не назначен/);
  });

  it('не выплачивает при нулевом эскроу', async () => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 0, clientId: CLIENT, masterId: MASTER,
      price: 400_000, commissionAmount: 60_000,
    });

    await expect(balanceService.releaseFunds(ORDER)).rejects.toThrow(/Нет заблокированных средств/);
  });

  it('эскроу обнуляется вместе с отметкой об оплате комиссии', async () => {
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUnique.mockResolvedValue({ balance: 0 });

    await balanceService.releaseFunds(ORDER);

    const call = db.order.updateMany.mock.calls[0][0];
    expect(call.where.escrowAmount.gt).toBe(0);   // захват только незакрытого эскроу
    expect(call.data.escrowAmount).toBe(0);
    expect(call.data.commissionPaid).toBe(true);
  });
});

describe('refundFunds — возврат клиенту при отмене', () => {
  it('возвращает эскроу на баланс клиента', async () => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 300_000, clientId: CLIENT,
    });
    db.order.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUnique.mockResolvedValue({ balance: 100_000 });

    await balanceService.refundFunds(ORDER);

    const tx = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(tx.type).toBe('REFUND');
    expect(tx.amount).toBe(300_000);
    expect(tx.balanceAfter).toBe(400_000);   // 100 000 + 300 000
  });

  it('двойной возврат предотвращён при гонке авто- и ручной отмены', async () => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 300_000, clientId: CLIENT,
    });
    db.order.updateMany.mockResolvedValue({ count: 0 });   // уже вернули

    await balanceService.refundFunds(ORDER);

    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });

  it('ничего не делает при нулевом эскроу', async () => {
    db.order.findUnique.mockResolvedValue({
      id: ORDER, escrowAmount: 0, clientId: CLIENT,
    });

    await balanceService.refundFunds(ORDER);

    expect(db.order.updateMany).not.toHaveBeenCalled();
    expect(db.balanceTransaction.create).not.toHaveBeenCalled();
  });
});

describe('topUp — пополнение баланса', () => {
  it('зачисляет сумму и фиксирует транзакцию', async () => {
    db.user.findUnique.mockResolvedValue({ balance: 50_000 });

    await balanceService.topUp(CLIENT, 150_000, 'Пополнение через PAYME');

    const tx = db.balanceTransaction.create.mock.calls[0][0].data;
    expect(tx.type).toBe('TOPUP');
    expect(tx.amount).toBe(150_000);
    expect(tx.balanceBefore).toBe(50_000);
    expect(tx.balanceAfter).toBe(200_000);
  });
});
