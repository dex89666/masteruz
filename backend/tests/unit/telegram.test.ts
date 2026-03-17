// ============================================
// MasterUz — Unit Tests: Telegram Auth Verification
// Агент 6 (Безопасность) + Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Мокаем конфиг перед импортом
vi.mock('../../src/config/index.js', () => ({
  config: {
    telegram: {
      botToken: 'TEST_BOT_TOKEN_123:ABC',
    },
  },
}));

import { verifyTelegramAuth, verifyTelegramMiniApp } from '../../src/utils/telegram.js';

describe('telegram.ts — Верификация авторизации', () => {

  describe('verifyTelegramAuth', () => {
    it('должен отклонить данные с устаревшим auth_date (>24ч)', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 100000; // > 24 часов
      const result = verifyTelegramAuth({
        id: 123456,
        first_name: 'Test',
        auth_date: oldTimestamp,
        hash: 'fakehash',
      });
      expect(result).toBe(false);
    });

    it('должен отклонить данные с неверным hash', () => {
      const result = verifyTelegramAuth({
        id: 123456,
        first_name: 'Test',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'invalidhash123',
      });
      expect(result).toBe(false);
    });

    it('должен принять валидные данные с корректным hash', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const data: Record<string, any> = {
        id: 123456,
        first_name: 'TestUser',
        auth_date: authDate,
      };

      // Генерируем корректный hash
      const dataCheckString = Object.keys(data)
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join('\n');

      const secretKey = crypto
        .createHash('sha256')
        .update('TEST_BOT_TOKEN_123:ABC')
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      const result = verifyTelegramAuth({
        ...data as any,
        hash,
      });
      expect(result).toBe(true);
    });
  });

  describe('verifyTelegramMiniApp', () => {
    it('должен вернуть null для пустой строки', () => {
      expect(verifyTelegramMiniApp('')).toBeNull();
    });

    it('должен вернуть null если нет hash', () => {
      expect(verifyTelegramMiniApp('user=test&auth_date=123')).toBeNull();
    });

    it('должен вернуть null для невалидного hash', () => {
      const result = verifyTelegramMiniApp('user=%7B%22id%22%3A123%7D&auth_date=123&hash=wronghash');
      expect(result).toBeNull();
    });

    it('должен принять валидные Mini App данные', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const user = JSON.stringify({ id: 123456, first_name: 'Test', username: 'test' });

      const params = new URLSearchParams();
      params.set('user', user);
      params.set('auth_date', String(authDate));

      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update('TEST_BOT_TOKEN_123:ABC')
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      params.set('hash', hash);

      const result = verifyTelegramMiniApp(params.toString());
      expect(result).not.toBeNull();
      expect(result?.user?.id).toBe(123456);
      expect(result?.user?.first_name).toBe('Test');
      expect(result?.auth_date).toBe(authDate);
    });
  });
});
