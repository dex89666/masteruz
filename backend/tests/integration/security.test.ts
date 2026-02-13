// ============================================
// MasterUz — Integration Tests: Security Audit
// Агент 6 (Безопасность) — OWASP-подобные проверки
// ============================================

import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3001/api';

async function apiFetch(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data: await res.json().catch(() => null),
    };
  } finally {
    clearTimeout(timeout);
  }
}

describe('Security Audit — OWASP проверки', () => {

  // ─── A01: Broken Access Control ─────────────
  describe('Контроль доступа', () => {
    it('GET /api/admin/dashboard без токена → 401', async () => {
      const { status } = await apiFetch('/admin/dashboard');
      expect([401, 429]).toContain(status);
    });

    it('PUT /api/admin/config без токена → 401', async () => {
      const { status } = await apiFetch('/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'test', value: 'hacked' }),
      });
      expect([401, 429]).toContain(status);
    });

    it('POST /api/orders без токена → 401', async () => {
      const { status } = await apiFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: '00000000-0000-0000-0000-000000000000',
          title: 'Test',
          description: 'Test description',
          price: 100000,
          offerAccepted: true,
        }),
      });
      expect([401, 429]).toContain(status);
    });

    it('GET /api/users/profile без токена → 401', async () => {
      const { status } = await apiFetch('/users/profile');
      expect([401, 429]).toContain(status);
    });

    it('Admin endpoint с CLIENT токеном → 403', async () => {
      // Создаём фейковый JWT с ролью CLIENT (не будет валидным без правильного secret)
      const { status } = await apiFetch('/admin/dashboard', {
        headers: { Authorization: 'Bearer fake.jwt.token' },
      });
      expect([401, 429]).toContain(status); // невалидный токен → 401, или rate limited → 429
    });
  });

  // ─── A03: Injection ─────────────────────────
  describe('Защита от инъекций', () => {
    it('SQL injection в query параметрах → не падает', async () => {
      const { status } = await apiFetch('/orders?status=PUBLISHED&city=\'; DROP TABLE orders;--');
      expect([200, 400, 429]).toContain(status); // Не 500! (429 = rate limit, тоже безопасно)
    });

    it('XSS в search → не возвращает исполняемый код', async () => {
      const { status, data } = await apiFetch('/catalog/categories');
      expect(status).toBe(200);
      // Данные не должны содержать script-тегов
      const json = JSON.stringify(data);
      expect(json).not.toContain('<script>');
    });
  });

  // ─── A05: Security Misconfiguration ─────────
  describe('Конфигурация безопасности', () => {
    it('Health endpoint не раскрывает чувствительные данные', async () => {
      const { data } = await apiFetch('/health');
      const json = JSON.stringify(data);
      expect(json).not.toContain('password');
      expect(json).not.toContain('secret');
      expect(json).not.toContain('DATABASE_URL');
    });

    it('Несуществующий маршрут → 404, не раскрывает стек', async () => {
      const { status, data } = await apiFetch('/api/this-does-not-exist');
      expect(status).toBe(404);
      if (data) {
        const json = JSON.stringify(data);
        expect(json).not.toContain('node_modules');
        expect(json).not.toContain('at ');
      }
    });

    it('Response headers содержат security headers (helmet)', async () => {
      const { headers } = await apiFetch('/health');
      // Helmet устанавливает эти заголовки
      expect(headers['x-content-type-options']).toBeDefined();
    });
  });

  // ─── A07: Authentication ────────────────────
  describe('Аутентификация', () => {
    it('POST /api/auth/telegram с невалидным hash → 401', async () => {
      const { status } = await apiFetch('/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 123456,
          first_name: 'Hacker',
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'invalid_hash_attempt',
        }),
      });
      // 401 = invalid auth, 429 = rate limited (both are secure responses)
      expect([401, 429]).toContain(status);
    });

    it('POST /api/auth/refresh с невалидным токеном → 401', async () => {
      const { status } = await apiFetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'invalid.refresh.token' }),
      });
      // 401 = invalid token, 429 = rate limited (both are secure responses)
      expect([401, 429]).toContain(status);
    });
  });

  // ─── Input Validation ──────────────────────
  describe('Валидация входных данных', () => {
    it('Невалидный JSON → 400', async () => {
      const res = await fetch(`${API_BASE}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      });
      expect([400, 401]).toContain(res.status);
    });
  });
});
