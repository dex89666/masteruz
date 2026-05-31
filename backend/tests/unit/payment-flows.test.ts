// ============================================
// MasterUz — Тесты платёжных потоков
// Покрытие: Telegram Stars (P0), Click webhook,
//           Payme webhook, создание платежей, double-spend
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

  const prisma = {
    payment: mockPayment,
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
      masterRegistrationFee: 400000,
      defaultReferralMasterBonusRate: 5,
      defaultReferralClientDiscountRate: 3,
    },
    click: { serviceId: 'test-service', secretKey: 'test-secret', merchantId: 'test-merchant' },
    payme: { merchantId: 'test-payme', secretKey: 'test-payme-key' },
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

  it('createRegistrationPayment — повторная оплата → conflict', async () => {
    db.masterProfile.findUnique.mockResolvedValueOnce({ registrationPaid: true });

    await expect(
      service.createRegistrationPayment('user-1', 'CLICK' as any),
    ).rejects.toThrow('уже оплачен');
  });

  it('createRegistrationPayment — профиль не найден → notFound', async () => {
    db.masterProfile.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createRegistrationPayment('user-1', 'CLICK' as any),
    ).rejects.toThrow('не найден');
  });

  it('createCommissionPayment — заказ не найден → notFound', async () => {
    db.order.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createCommissionPayment('user-1', 'order-999', 'CLICK' as any),
    ).rejects.toThrow('не найден');
  });
});

// ─── Click webhook ───────────────────────────

describe('Click webhook — верификация подписи', () => {
  it('отсутствие обязательных полей → badRequest', async () => {
    await expect(service.handleClickWebhook({})).rejects.toThrow();
  });

  it('невалидная подпись → badRequest', async () => {
    await expect(
      service.handleClickWebhook({
        click_trans_id: '123',
        merchant_trans_id: 'pay-1',
        amount: 50000,
        sign_string: 'fake_signature',
        sign_time: '2026-01-01',
        error: '0',
        action: '0',
      }),
    ).rejects.toThrow('Invalid signature');
  });

  it('платёж уже COMPLETED → идемпотентность', async () => {
    const crypto = await import('crypto');
    const signSource = `123test-servicetest-secretpay-1500000${''}`;
    const validSign = crypto.createHash('md5').update(signSource).digest('hex');

    db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', status: 'COMPLETED', userId: 'u1' });

    const result = await service.handleClickWebhook({
      click_trans_id: '123',
      merchant_trans_id: 'pay-1',
      amount: 50000,
      sign_string: validSign,
      sign_time: '',
      error: '0',
      action: '0',
    });

    expect(result.success).toBe(true);
    expect(db.payment.update).not.toHaveBeenCalled();
  });
});

// ─── Payme webhook ───────────────────────────

describe('Payme webhook — методы', () => {
  it('CheckPerformTransaction — платёж не найден', async () => {
    db.payment.findUnique.mockResolvedValueOnce(null);

    const result = await service.handlePaymeWebhook({
      method: 'CheckPerformTransaction',
      params: { account: { payment_id: 'pay-not-exist' }, amount: 5000000 },
    });

    expect(result.error?.code).toBe(-31050);
  });

  it('CheckPerformTransaction — неверная сумма', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1' });

    const result = await service.handlePaymeWebhook({
      method: 'CheckPerformTransaction',
      params: { account: { payment_id: 'pay-1' }, amount: 9999999 },
    });

    expect(result.error?.code).toBe(-31001);
  });

  it('CheckPerformTransaction — корректная сумма → allow', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1' });

    const result = await service.handlePaymeWebhook({
      method: 'CheckPerformTransaction',
      params: { account: { payment_id: 'pay-1' }, amount: 5000000 },
    });

    expect(result.result?.allow).toBe(true);
  });

  it('неизвестный метод → ошибка', async () => {
    const result = await service.handlePaymeWebhook({
      method: 'UnknownMethod',
      params: {},
    });

    expect(result.error?.code).toBe(-32601);
  });

  it('PerformTransaction → COMPLETED + аудит', async () => {
    db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', status: 'PROCESSING', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' }); // existing
    db.payment.updateMany.mockResolvedValueOnce({ count: 1 }); // атомарный захват
    // onPaymentCompleted chain
    db.payment.findUnique
      .mockResolvedValueOnce({ type: 'BALANCE_TOPUP' })
      .mockResolvedValueOnce({ userId: 'u1', amount: 50000, provider: 'PAYME' });

    const result = await service.handlePaymeWebhook({
      method: 'PerformTransaction',
      params: { id: 'payme-tx-1' },
    });

    expect(result.result?.state).toBe(2);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_completed',
        details: expect.objectContaining({ provider: 'PAYME' }),
      }),
    );
  });

  it('CancelTransaction → REFUNDED + аудит', async () => {
    db.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: 'REFUNDED', userId: 'u1', amount: 50000 });

    const result = await service.handlePaymeWebhook({
      method: 'CancelTransaction',
      params: { id: 'payme-tx-1' },
    });

    expect(result.result?.state).toBe(-1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_refunded',
        entityType: 'payment',
      }),
    );
  });
});
