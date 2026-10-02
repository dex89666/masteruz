// ============================================
// MasterUz — Unit Tests: Hamkorbank (UzQR) — mock QR и защита вебхука
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/modules/payments/hamkor/uzqr.service.js', () => ({
  uzQrService: { handleNotification: vi.fn().mockResolvedValue({ result: 'completed' }) },
}));
import express from 'express';
import request from 'supertest';
import { config } from '../../src/config/index.js';
import hamkorRoutes from '../../src/modules/payments/hamkor/hamkor.routes.js';
import { signHamkorPayload } from '../../src/modules/payments/hamkor/hamkor.webhook.js';
import { buildCreateQrRequest, createDynamicQr } from '../../src/modules/payments/hamkor/hamkor.client.js';

const SECRET = 'test-hamkor-secret';
const PATH = '/api/v1/payments/hamkor-webhook';

// Тот же порядок middleware, что в app.ts
function makeApp() {
  const app = express();
  app.use(PATH, express.raw({ type: () => true, limit: '1mb' }));
  app.use(express.json());
  app.use('/api/v1/payments', hamkorRoutes);
  return app;
}

const body = JSON.stringify({ order_id: 'order-1', transaction_id: 'tx-1', status: 'PAID', amount: 15000000 });

describe('Hamkorbank webhook', () => {
  beforeEach(() => {
    config.hamkor.webhookSecret = SECRET;
    config.hamkor.webhookIps = [];
    config.hamkor.signatureHeader = 'X-Signature';
  });

  it('принимает запрос с верной подписью', async () => {
    const res = await request(makeApp())
      .post(PATH)
      .set('Content-Type', 'application/json')
      .set('X-Signature', signHamkorPayload(Buffer.from(body), SECRET))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, received: true, result: 'completed' });
  });

  it('подписанное, но неполное уведомление → 400', async () => {
    const partial = JSON.stringify({ order_id: 'order-1', status: 'PAID' });
    const res = await request(makeApp())
      .post(PATH)
      .set('Content-Type', 'application/json')
      .set('X-Signature', signHamkorPayload(Buffer.from(partial), SECRET))
      .send(partial);
    expect(res.status).toBe(400);
  });

  it('отклоняет без подписи и с чужой подписью', async () => {
    const app = makeApp();
    const noSig = await request(app).post(PATH).set('Content-Type', 'application/json').send(body);
    expect(noSig.status).toBe(401);
    const wrong = await request(app)
      .post(PATH)
      .set('Content-Type', 'application/json')
      .set('X-Signature', signHamkorPayload(Buffer.from(body), 'other-secret'))
      .send(body);
    expect(wrong.status).toBe(401);
  });

  it('отклоняет изменённое тело при старой подписи', async () => {
    const sig = signHamkorPayload(Buffer.from(body), SECRET);
    const tampered = body.replace('15000000', '99000000');
    const res = await request(makeApp())
      .post(PATH)
      .set('Content-Type', 'application/json')
      .set('X-Signature', sig)
      .send(tampered);
    expect(res.status).toBe(401);
  });

  it('без настроенного секрета вебхук закрыт', async () => {
    config.hamkor.webhookSecret = '';
    const res = await request(makeApp()).post(PATH).set('Content-Type', 'application/json').send(body);
    expect(res.status).toBe(503);
  });

  it('IP не из списка банка → 403', async () => {
    config.hamkor.webhookIps = ['10.20.30.40'];
    const res = await request(makeApp())
      .post(PATH)
      .set('Content-Type', 'application/json')
      .set('X-Signature', signHamkorPayload(Buffer.from(body), SECRET))
      .send(body);
    expect(res.status).toBe(403);
  });
});

describe('Hamkorbank динамический QR (mock)', () => {
  beforeEach(() => {
    config.hamkor.mock = true;
  });

  it('собирает запрос: сумма в тийинах, order_id, UZS', () => {
    const req = buildCreateQrRequest({ amount: 150000, orderId: 'order-1' });
    expect(req).toMatchObject({ order_id: 'order-1', amount: 15000000, currency: 'UZS' });
  });

  it('отклоняет нулевую, отрицательную сумму, больше 2 знаков после запятой и мусорный order_id', () => {
    for (const amount of [0, -5, 10.555, NaN]) {
      expect(() => buildCreateQrRequest({ amount, orderId: 'order-1' })).toThrow();
    }
    expect(() => buildCreateQrRequest({ amount: 1000, orderId: "1'; DROP" })).toThrow();
  });

  it('mock возвращает QR без запроса в банк', async () => {
    const qr = await createDynamicQr({ amount: 150000, orderId: 'order-1' });
    expect(qr.mock).toBe(true);
    expect(qr.qrId).toMatch(/^mock-/);
    expect(qr.qrPayload).toContain('order-1');
    expect(new Date(qr.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('боевой режим до подключения банка не запускается', async () => {
    config.hamkor.mock = false;
    await expect(createDynamicQr({ amount: 150000, orderId: 'order-1' })).rejects.toThrow(/ещё не подключена/);
  });
});
