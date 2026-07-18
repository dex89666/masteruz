import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Payme webhook integration', () => {
  const merchantKey = process.env.PAYME_SANDBOX_MERCHANT_KEY || 'test_key';
  const ip = (process.env.PAYME_WEBHOOK_WHITELIST || '127.0.0.1').split(',')[0];
  const auth = 'Basic ' + Buffer.from(`Paycom:${merchantKey}`).toString('base64');

  it('отклоняет без Basic Auth (JSON-RPC -32504, HTTP 200)', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/payme')
      .set('X-Forwarded-For', ip)
      .send({ method: 'CheckPerformTransaction', id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32504);
  });

  it('с корректной авторизацией и отсутствующим платежом → ошибка -31050', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/payme')
      .set('Authorization', auth)
      .set('X-Forwarded-For', ip)
      .send({ method: 'CheckPerformTransaction', params: { account: { payment_id: 'not-exist' }, amount: 100 }, id: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe(-31050);
  });
});
