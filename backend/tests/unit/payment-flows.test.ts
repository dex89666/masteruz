// ============================================
// MasterUz — Тесты платёжных потоков
// Покрытие: Telegram Stars (P0), создание платежей, double-spend
// (вебхуки Click/Payme удалены — провайдеры отключены)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Моки (vi.mock поднимается наверх — нельзя ссылаться на переменные) ──

vi.mock('../../src/config/database.js', () => {
  const mockPayment = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const mockOrder = { findUnique: vi.fn(), update: vi.fn() };
  const mockMasterProfile = { findUnique: vi.fn(), update: vi.fn() };
  const mockUser = { findUnique: vi.fn(), update: vi.fn() };
  const mockBalanceTx = { create: vi.fn() };
  const mockAuditLog = { create: vi.fn() };
  const mockPaymentTransaction = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };

  const prisma = {
    payment: mockPayment,
    paymentTransaction: mockPaymentTransaction,
    order: mockOrder,
    masterProfile: mockMasterProfile,
    user: mockUser,
    balanceTransaction: mockBalanceTx,
    auditLog: mockAuditLog,
    $transaction: vi.fn((fn: any) => fn(prisma)),
  };
  return { prisma };
});

vi.mock('../../src/config/index.js', () => ({
  config: {
    superAdminUsernames: [],
    platform: {
      defaultCommissionRate: 15,
      defaultReferralMasterBonusRate: 5,
      defaultReferralClientDiscountRate: 3,
    },
    click: { serviceId: 'test-service', secretKey: 'test-secret', merchantId: 'test-merchant' },
    payme: {
      merchantId: 'test-payme',
      merchantKey: 'test-payme-key',
      sandboxMerchantId: 'test-payme',
      sandboxMerchantKey: 'test-payme-key',
      useSandbox: true,
      transactionTimeoutMs: 43200000,
      fiscal: { ikpuCode: '', packageCode: '', vatPercent: 0, receiptType: 0 },
    },
  },
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: { notifyMasterAssigned: vi.fn() },
}));
vi.mock('../../src/services/auditService.js', () => ({
  auditService: { log: vi.fn() },
}));
vi.mock('../../src/services/eventBus.js', () => ({
  eventBus: { emit: vi.fn() },
}));
vi.mock('../../src/modules/balance/balance.service.js', () => ({
  balanceService: { topUp: vi.fn() },
}));

import { prisma } from '../../src/config/database.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { auditService } from '../../src/services/auditService.js';

const db = prisma as any;
const service = new PaymentsService();

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Telegram Stars ──────────────────────────

describe('Telegram Stars — P0 верификация', () => {
  const validPayment = {
    id: 'pay-1',
    userId: 'user-1',
    status: 'PENDING',
    amount: 50000,
    type: 'BALANCE_TOPUP',
    provider: 'TELEGRAM_STARS',
  };

  it('успешный платёж → COMPLETED + аудит', async () => {
    db.payment.findUnique.mockResolvedValueOnce(validPayment); // existing
    db.payment.findFirst.mockResolvedValueOnce(null); // нет дубликата
    db.payment.updateMany.mockResolvedValueOnce({ count: 1 }); // атомарный захват
    db.payment.findUnique.mockResolvedValueOnce({ ...validPayment, status: 'COMPLETED', providerTxId: 'tg-tx-1' }); // payment после claim
    // onPaymentCompleted → findUnique для type
    db.payment.findUnique.mockResolvedValueOnce({ type: 'BALANCE_TOPUP' });
    // onBalanceTopUpPaid → findUnique для суммы
    db.payment.findUnique.mockResolvedValueOnce({ userId: 'user-1', amount: 50000, provider: 'TELEGRAM_STARS' });

    const result = await service.handleTelegramStarsPayment('user-1', 'pay-1', 'tg-tx-1');

    expect(result.status).toBe('COMPLETED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'payment_completed',
        entityType: 'payment',
        entityId: 'pay-1',
        details: expect.objectContaining({ provider: 'TELEGRAM_STARS' }),
      }),
    );
  });

  it('чужой платёж → forbidden', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ ...validPayment, userId: 'other-user' });

    await expect(
      service.handleTelegramStarsPayment('user-1', 'pay-1', 'tg-tx-1'),
    ).rejects.toThrow('Нет доступа к этому платежу');
  });

  it('двойная трата → conflict', async () => {
    db.payment.findUnique.mockResolvedValueOnce(validPayment);
    db.payment.findFirst.mockResolvedValueOnce({ id: 'pay-old', providerTxId: 'tg-tx-1' }); // дубликат

    await expect(
      service.handleTelegramStarsPayment('user-1', 'pay-1', 'tg-tx-1'),
    ).rejects.toThrow('уже использован');
  });

  it('повторное завершение готового платежа → идемпотентность', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ ...validPayment, status: 'COMPLETED' });

    const result = await service.handleTelegramStarsPayment('user-1', 'pay-1', 'tg-tx-1');
    expect(result.status).toBe('COMPLETED');
    expect(db.payment.update).not.toHaveBeenCalled();
  });

  it('не-PENDING статус → conflict', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ ...validPayment, status: 'FAILED' });

    await expect(
      service.handleTelegramStarsPayment('user-1', 'pay-1', 'tg-tx-1'),
    ).rejects.toThrow('FAILED');
  });

  it('пустые параметры → badRequest', async () => {
    await expect(
      service.handleTelegramStarsPayment('user-1', '', 'tg-tx-1'),
    ).rejects.toThrow('обязательны');

    await expect(
      service.handleTelegramStarsPayment('user-1', 'pay-1', ''),
    ).rejects.toThrow('обязательны');
  });

  it('несуществующий платёж → notFound', async () => {
    db.payment.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.handleTelegramStarsPayment('user-1', 'pay-999', 'tg-tx-1'),
    ).rejects.toThrow('не найден');
  });
});

// ─── Создание платежей ───────────────────────

describe('Создание платежа — валидация', () => {
  it('createBalanceTopupPayment — минимум 10 000 сум', async () => {
    await expect(
      service.createBalanceTopupPayment('user-1', 5000, 'CLICK' as any),
    ).rejects.toThrow('Минимальная сумма');
  });

  it('createBalanceTopupPayment — максимум 100 000 000 сум', async () => {
    await expect(
      service.createBalanceTopupPayment('user-1', 200_000_000, 'CLICK' as any),
    ).rejects.toThrow('Максимальная сумма');
  });

  it('createBalanceTopupPayment — неподдерживаемый провайдер', async () => {
    db.payment.create.mockResolvedValueOnce({ id: 'pay-test' });

    await expect(
      service.createBalanceTopupPayment('user-1', 50000, 'BITCOIN' as any),
    ).rejects.toThrow('Неподдерживаемый');
  });

  it('createCommissionPayment — заказ не найден → notFound', async () => {
    db.order.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createCommissionPayment('user-1', 'order-999', 'CLICK' as any),
    ).rejects.toThrow('не найден');
  });
});
