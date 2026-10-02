// ============================================
// MasterUz — Unit Tests: Click / Payme / Telegram Stars отключены
// Онлайн-оплата только через Hamkorbank (UzQR)
// ============================================

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import paymentsRoutes from '../../src/modules/payments/payments.routes.js';

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRoutes);

describe('Старые платёжные провайдеры', () => {
  for (const path of ['/create', '/balance-topup', '/registration-fee', '/telegram-stars', '/subscribe/rpc', '/subscribe/cards']) {
    it(`POST ${path} → 410`, async () => {
      const res = await request(app).post(`/api/payments${path}`).send({ provider: 'PAYME', amount: 50000 });
      expect(res.status).toBe(410);
      expect(res.body.error.message).toMatch(/UzQR/);
    });
  }
});
