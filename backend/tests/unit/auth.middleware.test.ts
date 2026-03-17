// ============================================
// MasterUz — Unit Tests: Auth Middleware
// Агент 6 (Безопасность) + Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Мокаем конфиг
vi.mock('../../src/config/index.js', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-32chars-minimum!',
      expiresIn: '7d',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '30d',
    },
  },
}));

// Мокаем prisma
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { authenticate, authorize, optionalAuth } from '../../src/middleware/auth.js';

function createMockReq(authHeader?: string): any {
  return {
    headers: {
      authorization: authHeader,
    },
    user: undefined,
  };
}

const mockRes = {} as any;

describe('authenticate middleware', () => {
  it('отклоняет запрос без токена', () => {
    const req = createMockReq();
    const next = vi.fn();
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('отклоняет запрос с невалидным токеном', () => {
    const req = createMockReq('Bearer invalidtoken');
    const next = vi.fn();
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('принимает валидный JWT и устанавливает req.user', () => {
    const payload = { userId: 'user-1', telegramId: 123456, role: 'CLIENT' };
    const token = jwt.sign(payload, 'test-jwt-secret-32chars-minimum!', { expiresIn: '1h' });
    const req = createMockReq(`Bearer ${token}`);
    const next = vi.fn();
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(); // без аргументов (нет ошибки)
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('user-1');
    expect(req.user.role).toBe('CLIENT');
  });

  it('отклоняет истёкший токен', () => {
    const payload = { userId: 'user-1', telegramId: 123456, role: 'CLIENT' };
    const token = jwt.sign(payload, 'test-jwt-secret-32chars-minimum!', { expiresIn: '-1s' });
    const req = createMockReq(`Bearer ${token}`);
    const next = vi.fn();
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('отклоняет запрос без "Bearer " префикса', () => {
    const req = createMockReq('Token abc123');
    const next = vi.fn();
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('authorize middleware', () => {
  it('пропускает пользователя с разрешённой ролью', () => {
    const req = { user: { userId: '1', telegramId: 123, role: 'ADMIN' } } as any;
    const next = vi.fn();
    authorize('ADMIN', 'MANAGER')(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(); // без ошибки
  });

  it('отклоняет пользователя с неподходящей ролью', () => {
    const req = { user: { userId: '1', telegramId: 123, role: 'CLIENT' } } as any;
    const next = vi.fn();
    authorize('ADMIN', 'MANAGER')(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('отклоняет неавторизованный запрос', () => {
    const req = { user: undefined } as any;
    const next = vi.fn();
    authorize('ADMIN')(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('optionalAuth middleware', () => {
  it('не устанавливает user если нет токена', () => {
    const req = createMockReq();
    const next = vi.fn();
    optionalAuth(req, mockRes, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('устанавливает user если есть валидный токен', () => {
    const payload = { userId: 'user-1', telegramId: 123, role: 'MASTER' };
    const token = jwt.sign(payload, 'test-jwt-secret-32chars-minimum!');
    const req = createMockReq(`Bearer ${token}`);
    const next = vi.fn();
    optionalAuth(req, mockRes, next);
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('MASTER');
  });

  it('игнорирует невалидный токен без ошибки', () => {
    const req = createMockReq('Bearer invalidtoken');
    const next = vi.fn();
    optionalAuth(req, mockRes, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(); // без ошибки
  });
});
