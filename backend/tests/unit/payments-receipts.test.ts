import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { db } from '../../src/services/db.service';
import { logger } from '../../src/utils/logger';
import { auditService } from '../../src/services/auditService';
import { config } from '../../src/config/index';

vi.mock('../../src/services/auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

describe('PaymentsService — receipts.create (фискализация)', () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    // credentials для фискализации
    (config.payme as any).sandboxMerchantId = 'test_merchant';
    (config.payme as any).sandboxMerchantKey = 'test_key';
    (config.payme as any).useSandbox = true;
  });

  describe('createReceipt()', () => {
    it('успешно отправляет receipts.create к Payme (X-Auth, sandbox URL)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { receipt: { _id: 'r-1' } } }) });
      global.fetch = mockFetch as any;

      await service.createReceipt({ id: 'pay-123', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' } as any);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test.paycom.uz'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Auth': expect.stringContaining('test_merchant:'),
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"method":"receipts.create"'),
        })
      );
    });

    it('обрабатывает ошибку от Payme без отката (логирует non-OK)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Internal Server Error' });
      global.fetch = mockFetch as any;

      await expect(
        service.createReceipt({ id: 'pay-123', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' } as any)
      ).resolves.not.toThrow();

      expect(logger.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('non-OK response'));
    });

    it('отправляет корректные позиции товаров (title/count/price в тийинах)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: {} }) });
      global.fetch = mockFetch as any;

      await service.createReceipt({ id: 'pay-123', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' } as any);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.method).toBe('receipts.create');
      expect(callBody.params.amount).toBe(5000000); // 50 000 сум → тийины
      expect(callBody.params.detail.items[0]).toMatchObject({
        title: expect.any(String),
        count: 1,
        price: 5000000,
      });
      expect(callBody.params.account.order_id).toBe('pay-123');
    });
  });

  describe('PerformTransaction с фискализацией', () => {
    it('фискализирует чек как часть PerformTransaction', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 1, createTime: new Date() });
      db.paymentTransaction.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.findUnique
        .mockResolvedValueOnce({ id: 'pay-1', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP', orderId: null })
        .mockResolvedValueOnce({ type: 'BALANCE_TOPUP' })
        .mockResolvedValueOnce({ userId: 'u1', amount: 50000, provider: 'PAYME', type: 'BALANCE_TOPUP', orderId: null });

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: {} }) });
      global.fetch = mockFetch as any;

      const result = await service.handlePaymeWebhook({ method: 'PerformTransaction', params: { id: 'payme-tx-1' }, id: 1 });

      expect(result?.result?.state).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('paycom.uz'),
        expect.objectContaining({ body: expect.stringContaining('receipts.create') })
      );
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment_completed' }));
    });

    it('не откатывает PerformTransaction при ошибке фискализации', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 1, createTime: new Date() });
      db.paymentTransaction.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.findUnique
        .mockResolvedValueOnce({ id: 'pay-1', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP', orderId: null })
        .mockResolvedValueOnce({ type: 'BALANCE_TOPUP' })
        .mockResolvedValueOnce({ userId: 'u1', amount: 50000, provider: 'PAYME', type: 'BALANCE_TOPUP', orderId: null });

      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad request' });
      global.fetch = mockFetch as any;

      const result = await service.handlePaymeWebhook({ method: 'PerformTransaction', params: { id: 'payme-tx-1' }, id: 1 });

      expect(result?.result?.state).toBe(2);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment_completed' }));
    });
  });

  describe('Sandbox vs Production URL', () => {
    it('sandbox URL при useSandbox=true', async () => {
      (config.payme as any).useSandbox = true;
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: {} }) });
      global.fetch = mockFetch as any;

      await service.createReceipt({ id: 'pay-123', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' } as any);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('test.paycom.uz'), expect.any(Object));
    });

    it('production URL при useSandbox=false', async () => {
      (config.payme as any).useSandbox = false;
      (config.payme as any).merchantId = 'prod_merchant';
      (config.payme as any).merchantKey = 'prod_key';
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: {} }) });
      global.fetch = mockFetch as any;

      await service.createReceipt({ id: 'pay-123', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' } as any);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('checkout.paycom.uz');
      expect(url).not.toContain('test.paycom.uz');
    });
  });
});
