// ============================================
// MasterUz — Integration Tests: Security Audit
// Агент 6 (Безопасность) — OWASP-подобные проверки через supertest
// ============================================

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Мокаем зависимости, которые нужны app.ts при импорте
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    order: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null) },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    $connect: vi.fn(),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    del: vi.fn(),
  })),
}));

// Ленивый импорт app после моков
const { default: app } = await import('../../src/app.js');

describe('Security Audit — OWASP проверки (supertest)', () => {

  // ─── A01: Broken Access Control ─────────────
  describe('Контроль доступа', () => {
    it('GET /api/admin/dashboard без токена → 401', async () => {
      const res = await request(app).get('/api/admin/dashboard');
      expect([401, 429]).toContain(res.status);
    });

    it('PUT /api/admin/config без токена → 401', async () => {
      const res = await request(app)
        .put('/api/admin/config')
        .send({ key: 'test', value: 'hacked' });
      expect([401, 429]).toContain(res.status);
    });

    it('POST /api/orders без токена → 401', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          categoryId: '00000000-0000-0000-0000-000000000000',
          title: 'Test',
          description: 'Test description',
          price: 100000,
          offerAccepted: true,
        });
      expect([401, 429]).toContain(res.status);
    });

    it('GET /api/users/profile без токена → 401', async () => {
      const res = await request(app).get('/api/users/profile');
      expect([401, 429]).toContain(res.status);
    });

    it('Admin endpoint с невалидным токеном → 401', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer fake.jwt.token');
      expect([401, 429]).toContain(res.status);
    });
  });

  // ─── A03: Injection ─────────────────────────
  describe('Защита от инъекций', () => {
    it('SQL injection в query параметрах → не 500', async () => {
      const res = await request(app).get("/api/orders?status=PUBLISHED&city='; DROP TABLE orders;--");
      expect(res.status).not.toBe(500);
    });
  });

  // ─── A05: Security Misconfiguration ─────────
  describe('Конфигурация безопасности', () => {
    it('Health endpoint не раскрывает чувствительные данные', async () => {
      const res = await request(app).get('/api/health');
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('password');
      expect(json).not.toContain('secret');
      expect(json).not.toContain('DATABASE_URL');
    });

    it('Несуществующий маршрут → 404, не раскрывает стек', async () => {
      const res = await request(app).get('/api/this-does-not-exist');
      expect(res.status).toBe(404);
      if (res.body) {
        const json = JSON.stringify(res.body);
        expect(json).not.toContain('node_modules');
        expect(json).not.toContain('at ');
      }
    });

    it('Response headers содержат security headers (helmet)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBeDefined();
    });
  });

  // ─── A07: Authentication ────────────────────
  describe('Аутентификация', () => {
    it('POST /api/auth/telegram с невалидным hash → 401', async () => {
      const res = await request(app)
        .post('/api/auth/telegram')
        .send({
          id: 123456,
          first_name: 'Hacker',
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'invalid_hash_attempt',
        });
      expect([401, 429]).toContain(res.status);
    });

    it('POST /api/auth/refresh с невалидным токеном → 401', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' });
      expect([401, 429]).toContain(res.status);
    });
  });

  // ─── Input Validation ──────────────────────
  describe('Валидация входных данных', () => {
    it('Невалидный JSON → 400', async () => {
      const res = await request(app)
        .post('/api/auth/telegram')
        .set('Content-Type', 'application/json')
        .send('{invalid json}');
      expect([400, 401]).toContain(res.status);
    });
  });
});
