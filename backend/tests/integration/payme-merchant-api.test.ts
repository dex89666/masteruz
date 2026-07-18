import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/services/db.service';

// Basic Auth Payme: base64("Paycom:<merchantKey>"). Секрет — merchantKey (пароль).
function paymeAuth(merchantKey: string) {
  return 'Basic ' + Buffer.from(`Paycom:${merchantKey}`).toString('base64');
}

describe('Payme Merchant API — интеграционные тесты', () => {
  const merchantKey = process.env.PAYME_SANDBOX_MERCHANT_KEY || 'test_key';
  const baseAuth = paymeAuth(merchantKey);
  const whitelistedIP = (process.env.PAYME_WEBHOOK_WHITELIST || '127.0.0.1').split(',')[0];

  const post = (body: any, auth = baseAuth, ip = whitelistedIP) =>
    request(app)
      .post('/api/payments/webhook/payme')
      .set('Authorization', auth)
      .set('X-Forwarded-For', ip)
      .send(body);

  describe('Авторизация и сеть', () => {
    it('отклоняет запрос без Basic Auth (JSON-RPC -32504)', async () => {
      const res = await request(app)
        .post('/api/payments/webhook/payme')
        .set('X-Forwarded-For', whitelistedIP)
        .send({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.error.code).toBe(-32504);
    });

    it('отклоняет запрос с неверным ключом (JSON-RPC -32504)', async () => {
      const res = await post(
        { method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 },
        paymeAuth('wrong-key')
      );
      expect(res.status).toBe(200);
      expect(res.body.error.code).toBe(-32504);
    });

    it('отклоняет запрос с неверным IP (403)', async () => {
      const res = await post(
        { method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 },
        baseAuth,
        '192.168.1.1'
      );
      expect(res.status).toBe(403);
    });

    it('эхо id запроса в ответе', async () => {
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'PENDING' });
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 42 });
      expect(res.body.id).toBe(42);
      expect(res.body.jsonrpc).toBe('2.0');
    });
  });

  describe('CheckPerformTransaction', () => {
    it('одобряет платёж с корректной суммой', async () => {
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'PENDING' });
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 });
      expect(res.status).toBe(200);
      expect(res.body.result.allow).toBe(true);
    });

    it('отклоняет неверную сумму (-31001)', async () => {
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'PENDING' });
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 9999999 }, id: 1 });
      expect(res.body.error.code).toBe(-31001);
    });

    it('возвращает ошибку если платёж не найден (-31050, data=payment_id)', async () => {
      db.payment.findUnique.mockResolvedValueOnce(null);
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'nope' }, amount: 5000000 }, id: 1 });
      expect(res.body.error.code).toBe(-31050);
      expect(res.body.error.data).toBe('payment_id');
    });

    it('отклоняет уже оплаченный платёж (-31008)', async () => {
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'COMPLETED' });
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 });
      expect(res.body.error.code).toBe(-31008);
    });
  });

  describe('CreateTransaction', () => {
    it('создаёт транзакцию (state=1)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce(null); // нет существующей
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'PENDING' });
      db.paymentTransaction.findFirst.mockResolvedValueOnce(null); // нет активной
      const createTime = new Date();
      db.paymentTransaction.create.mockResolvedValueOnce({ id: 'tx-1', createTime });
      db.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: 'PROCESSING' });

      const res = await post({
        method: 'CreateTransaction',
        params: { id: 'payme-tx-1', account: { payment_id: 'pay-1' }, amount: 5000000, time: createTime.getTime() },
        id: 1,
      });

      expect(res.body.result.state).toBe(1);
      expect(res.body.result.transaction).toBe('tx-1');
      expect(res.body.result.create_time).toBeDefined();
    });

    it('идемпотентна: повторный запрос возвращает существующую транзакцию', async () => {
      const createTime = new Date();
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-existing', state: 1, createTime });

      const res = await post({
        method: 'CreateTransaction',
        params: { id: 'payme-tx-1', account: { payment_id: 'pay-1' }, amount: 5000000, time: createTime.getTime() },
        id: 1,
      });

      expect(res.body.result.transaction).toBe('tx-existing');
      expect(res.body.result.state).toBe(1);
    });

    it('запрещает вторую активную транзакцию для того же платежа (-31008)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      db.payment.findUnique.mockResolvedValueOnce({ id: 'pay-1', amount: 50000, userId: 'u1', status: 'PROCESSING' });
      db.paymentTransaction.findFirst.mockResolvedValueOnce({ id: 'tx-other', state: 1 });

      const res = await post({
        method: 'CreateTransaction',
        params: { id: 'payme-tx-2', account: { payment_id: 'pay-1' }, amount: 5000000, time: Date.now() },
        id: 1,
      });

      expect(res.body.error.code).toBe(-31008);
    });
  });

  describe('PerformTransaction', () => {
    it('проводит транзакцию (state=2) и возвращает perform_time', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 1, createTime: new Date() });
      db.paymentTransaction.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.updateMany.mockResolvedValueOnce({ count: 1 });
      db.payment.findUnique
        .mockResolvedValueOnce({ id: 'pay-1', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP', orderId: null })
        .mockResolvedValueOnce({ type: 'BALANCE_TOPUP' })
        .mockResolvedValueOnce({ userId: 'u1', amount: 50000, provider: 'PAYME' });

      const res = await post({ method: 'PerformTransaction', params: { id: 'payme-tx-1' }, id: 1 });

      expect(res.body.result.state).toBe(2);
      expect(res.body.result.perform_time).toBeDefined();
    });

    it('идемпотентна: уже проведённая транзакция возвращает state=2', async () => {
      const performTime = new Date();
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 2, performTime });

      const res = await post({ method: 'PerformTransaction', params: { id: 'payme-tx-1' }, id: 1 });

      expect(res.body.result.state).toBe(2);
      expect(res.body.result.perform_time).toBe(performTime.getTime());
    });

    it('возвращает ошибку если транзакция не найдена (-31003)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      const res = await post({ method: 'PerformTransaction', params: { id: 'nope' }, id: 1 });
      expect(res.body.error.code).toBe(-31003);
    });
  });

  describe('CancelTransaction', () => {
    it('отменяет непроведённую транзакцию (state=-1)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 1 });
      db.paymentTransaction.update.mockResolvedValueOnce({ id: 'tx-1', state: -1 });
      db.payment.update.mockResolvedValueOnce({ id: 'pay-1', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' });

      const res = await post({ method: 'CancelTransaction', params: { id: 'payme-tx-1', reason: 1 }, id: 1 });

      expect(res.body.result.state).toBe(-1);
      expect(res.body.result.cancel_time).toBeDefined();
    });

    it('отменяет проведённую транзакцию как возврат (state=-2)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: 2 });
      db.paymentTransaction.update.mockResolvedValueOnce({ id: 'tx-1', state: -2 });
      db.payment.update.mockResolvedValueOnce({ id: 'pay-1', userId: 'u1', amount: 50000, type: 'BALANCE_TOPUP' });

      const res = await post({ method: 'CancelTransaction', params: { id: 'payme-tx-1', reason: 5 }, id: 1 });

      expect(res.body.result.state).toBe(-2);
    });

    it('идемпотентна: уже отменённая транзакция', async () => {
      const cancelTime = new Date();
      db.paymentTransaction.findUnique.mockResolvedValueOnce({ id: 'tx-1', paymentId: 'pay-1', state: -1, cancelTime });
      const res = await post({ method: 'CancelTransaction', params: { id: 'payme-tx-1', reason: 1 }, id: 1 });
      expect(res.body.result.state).toBe(-1);
      expect(res.body.result.cancel_time).toBe(cancelTime.getTime());
    });
  });

  describe('CheckTransaction', () => {
    it('возвращает состояние транзакции', async () => {
      const createTime = new Date();
      db.paymentTransaction.findUnique.mockResolvedValueOnce({
        id: 'tx-1', paymentId: 'pay-1', state: 1, createTime, performTime: null, cancelTime: null, reason: null,
      });
      const res = await post({ method: 'CheckTransaction', params: { id: 'payme-tx-1' }, id: 1 });
      expect(res.body.result.state).toBe(1);
      expect(res.body.result.create_time).toBe(createTime.getTime());
      expect(res.body.result.perform_time).toBe(0);
      expect(res.body.result.cancel_time).toBe(0);
    });

    it('ошибка если транзакция не найдена (-31003)', async () => {
      db.paymentTransaction.findUnique.mockResolvedValueOnce(null);
      const res = await post({ method: 'CheckTransaction', params: { id: 'nope' }, id: 1 });
      expect(res.body.error.code).toBe(-31003);
    });
  });

  describe('GetStatement', () => {
    it('возвращает список транзакций за период', async () => {
      const t = new Date();
      db.paymentTransaction.findMany.mockResolvedValueOnce([
        { id: 'tx-1', paymeId: 'payme-tx-1', paymentId: 'pay-1', amount: 5000000, state: 2, reason: null, createTime: t, performTime: t, cancelTime: null },
      ]);
      const res = await post({ method: 'GetStatement', params: { from: t.getTime() - 1000, to: t.getTime() + 1000 }, id: 1 });
      expect(Array.isArray(res.body.result.transactions)).toBe(true);
      expect(res.body.result.transactions[0].transaction).toBe('tx-1');
      expect(res.body.result.transactions[0].account.payment_id).toBe('pay-1');
    });
  });

  describe('Обработка ошибок', () => {
    it('неизвестный метод (-32601)', async () => {
      const res = await post({ method: 'InvalidMethod', params: {}, id: 1 });
      expect(res.body.error.code).toBe(-32601);
    });

    it('исключение БД → 500', async () => {
      db.payment.findUnique.mockImplementation(() => { throw new Error('DB error'); });
      const res = await post({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'pay-1' }, amount: 5000000 }, id: 1 });
      expect(res.status).toBe(500);
      db.payment.findUnique.mockImplementation(undefined as any);
    });
  });
});
