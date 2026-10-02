// ============================================
// MasterUz — Unit Tests: оплата по QR (UzQR, Hamkorbank)
// Создание QR, проверки назначения, идемпотентное проведение, сверка суммы
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const prisma = {
    payment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { findUnique: vi.fn() },
    masterProfile: { findUnique: vi.fn() },
  };
  return { prisma };
});
vi.mock('../../src/config/index.js', () => ({
  config: {
    platform: { masterRegistrationFee: 400000 },
    hamkor: { enabled: true, mock: true, merchantId: 'M1', terminalId: 'T1', qrTtlSeconds: 900 },
  },
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/auditService.js', () => ({ auditService: { log: vi.fn() } }));
vi.mock('../../src/utils/telegramBot.js', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('../../src/modules/payments/payments.service.js', () => ({
  paymentsService: { onPaymentCompleted: vi.fn() },
}));

import { prisma } from '../../src/config/database.js';
import { config } from '../../src/config/index.js';
import { uzQrService } from '../../src/modules/payments/hamkor/uzqr.service.js';
import { paymentsService } from '../../src/modules/payments/payments.service.js';
import { sendTelegramMessage } from '../../src/utils/telegramBot.js';
import { auditService } from '../../src/services/auditService.js';

const db = prisma as any;
const PAY_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  (config as any).hamkor.enabled = true;
  db.payment.create.mockImplementation(({ data }: any) => Promise.resolve({ id: PAY_ID, ...data }));
  db.payment.updateMany.mockResolvedValue({ count: 0 });
});

describe('createUzQrOrder', () => {
  it('пополнение: платёж HAMKOR PENDING + ссылка QR', async () => {
    const qr = await uzQrService.createUzQrOrder('u1', { type: 'BALANCE_TOPUP', amount: 50000 });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP', provider: 'HAMKOR', status: 'PENDING' }),
    });
    expect(qr).toMatchObject({ paymentId: PAY_ID, amount: 50000, mock: true });
    expect(qr.qrUrl).toContain(PAY_ID);
    expect(qr.qrUrl).toContain('amount=5000000'); // тийины
  });

  it('старый открытый QR того же назначения гасится', async () => {
    await uzQrService.createUzQrOrder('u1', { type: 'BALANCE_TOPUP', amount: 50000 });
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: 'u1', type: 'BALANCE_TOPUP', provider: 'HAMKOR', status: 'PENDING' }),
      data: { status: 'FAILED' },
    });
  });

  it('пополнение вне 10 000 – 100 000 000 сум → ошибка', async () => {
    await expect(uzQrService.createUzQrOrder('u1', { type: 'BALANCE_TOPUP', amount: 9999 })).rejects.toThrow();
    await expect(uzQrService.createUzQrOrder('u1', { type: 'BALANCE_TOPUP', amount: 100_000_001 })).rejects.toThrow();
  });

  it('комиссию по чужому заказу не оплатить', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o1', masterId: 'other', commissionAmount: 15000, commissionPaid: false });
    await expect(uzQrService.createUzQrOrder('u1', { type: 'ORDER_COMMISSION', orderId: 'o1' })).rejects.toThrow(/мастер/);
  });

  it('уже оплаченная комиссия → conflict', async () => {
    db.order.findUnique.mockResolvedValue({ id: 'o1', masterId: 'u1', commissionAmount: 15000, commissionPaid: true });
    await expect(uzQrService.createUzQrOrder('u1', { type: 'ORDER_COMMISSION', orderId: 'o1' })).rejects.toThrow(/уже оплачена/);
  });

  it('регистрационный взнос — сумма из настроек', async () => {
    db.masterProfile.findUnique.mockResolvedValue({ registrationPaid: false });
    const qr = await uzQrService.createUzQrOrder('u1', { type: 'REGISTRATION_FEE' });
    expect(qr.amount).toBe(400000);
  });

  it('при выключенном HAMKOR_ENABLED — 410, платёж не создаётся', async () => {
    (config as any).hamkor.enabled = false;
    await expect(uzQrService.createUzQrOrder('u1', { type: 'BALANCE_TOPUP', amount: 50000 })).rejects.toMatchObject({ statusCode: 410 });
    expect(db.payment.create).not.toHaveBeenCalled();
  });
});

describe('handleNotification', () => {
  const pending = { id: PAY_ID, userId: 'u1', provider: 'HAMKOR', amount: 50000, type: 'BALANCE_TOPUP', status: 'PENDING' };
  const paid = { paymentId: PAY_ID, bankTxId: 'tx-1', status: 'PAID' as const, amountTiyin: 5000000 };

  it('оплата: COMPLETED, зачисление, аудит, сообщение в Telegram', async () => {
    db.payment.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({ amount: 50000, type: 'BALANCE_TOPUP', user: { telegramId: 123n } });
    db.payment.updateMany.mockResolvedValue({ count: 1 });

    const r = await uzQrService.handleNotification(paid);
    expect(r.result).toBe('completed');
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: PAY_ID }),
      data: { status: 'COMPLETED', providerTxId: 'tx-1' },
    });
    expect(paymentsService.onPaymentCompleted).toHaveBeenCalledWith(PAY_ID);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_COMPLETED' }));
    expect(sendTelegramMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: '123' }));
  });

  it('повторное уведомление ничего не зачисляет второй раз', async () => {
    db.payment.findUnique.mockResolvedValue({ ...pending, status: 'COMPLETED' });
    db.payment.updateMany.mockResolvedValue({ count: 0 });
    const r = await uzQrService.handleNotification(paid);
    expect(r.result).toBe('already_completed');
    expect(paymentsService.onPaymentCompleted).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('сумма не совпадает — не проводим, пишем в аудит', async () => {
    db.payment.findUnique.mockResolvedValue(pending);
    const r = await uzQrService.handleNotification({ ...paid, amountTiyin: 100 });
    expect(r.result).toBe('amount_mismatch');
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_AMOUNT_MISMATCH' }));
  });

  it('неизвестный платёж или чужой провайдер — игнор', async () => {
    db.payment.findUnique.mockResolvedValue({ ...pending, provider: 'PAYME' });
    expect((await uzQrService.handleNotification(paid)).result).toBe('unknown_payment');
  });

  it('отказ банка → FAILED', async () => {
    db.payment.findUnique.mockResolvedValue(pending);
    const r = await uzQrService.handleNotification({ ...paid, status: 'FAILED' });
    expect(r.result).toBe('failed');
    expect(db.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED' } }));
    expect(paymentsService.onPaymentCompleted).not.toHaveBeenCalled();
  });
});

describe('getPaymentStatus', () => {
  it('чужой платёж не показываем', async () => {
    db.payment.findUnique.mockResolvedValue({ userId: 'other', provider: 'HAMKOR', status: 'PENDING', amount: 1, type: 'BALANCE_TOPUP' });
    await expect(uzQrService.getPaymentStatus('u1', PAY_ID)).rejects.toThrow(/не найден/);
  });
});
