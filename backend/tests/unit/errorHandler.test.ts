// ============================================
// MasterUz — Unit Tests: Error Handler Middleware
// Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { ApiError } from '../../src/utils/ApiError.js';
import { ZodError, ZodIssue } from 'zod';

// Мокаем конфиг
vi.mock('../../src/config/index.js', () => ({
  config: { env: 'test' },
}));

import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe('errorHandler middleware', () => {
  const req = {} as any;
  const next = vi.fn();

  it('обрабатывает ApiError → возвращает statusCode и message', () => {
    const res = createMockRes();
    const err = ApiError.badRequest('Неверные данные');
    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Неверные данные');
  });

  it('обрабатывает ApiError 404', () => {
    const res = createMockRes();
    errorHandler(ApiError.notFound('Не найдено'), req, res, next);
    expect(res.statusCode).toBe(404);
  });

  it('обрабатывает ZodError → 400 с details', () => {
    const res = createMockRes();
    const zodErr = new ZodError([
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['title'], message: 'Expected string' } as ZodIssue,
    ]);
    errorHandler(zodErr, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Ошибка валидации');
    expect(res.body.error.details).toHaveLength(1);
    expect(res.body.error.details[0].field).toBe('title');
  });

  it('обрабатывает неожиданную ошибку → 500', () => {
    const res = createMockRes();
    errorHandler(new Error('Crash'), req, res, next);
    expect(res.statusCode).toBe(500);
  });
});

describe('notFoundHandler', () => {
  it('возвращает 404 JSON', () => {
    const req = {} as any;
    const res = createMockRes();
    notFoundHandler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Маршрут не найден');
  });
});
