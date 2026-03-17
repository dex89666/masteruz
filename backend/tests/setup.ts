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
