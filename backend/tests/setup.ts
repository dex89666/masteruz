// ============================================
// MasterUz — Test Setup
// ============================================

import { vi } from 'vitest';

// Мокаем env-переменные
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-32chars-minimum!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min!';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TELEGRAM_BOT_TOKEN = 'test:bot_token';
process.env.PORT = '3001';

// Payme sandbox — для тестов Merchant/Subscribe API
process.env.PAYME_SANDBOX_MERCHANT_ID = process.env.PAYME_SANDBOX_MERCHANT_ID || 'test_merchant';
process.env.PAYME_SANDBOX_MERCHANT_KEY = process.env.PAYME_SANDBOX_MERCHANT_KEY || 'test_key';
process.env.PAYME_MERCHANT_ID = process.env.PAYME_MERCHANT_ID || 'test_merchant';
process.env.PAYME_MERCHANT_KEY = process.env.PAYME_MERCHANT_KEY || 'test_key';
process.env.PAYME_USE_SANDBOX = process.env.PAYME_USE_SANDBOX || 'true';
process.env.PAYME_WEBHOOK_WHITELIST = process.env.PAYME_WEBHOOK_WHITELIST || '127.0.0.1,::1,::ffff:127.0.0.1';

// Мокаем pino logger
vi.mock('../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));
