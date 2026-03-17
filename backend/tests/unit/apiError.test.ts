// ============================================
// MasterUz — Unit Tests: ApiError
// Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/utils/ApiError.js';

describe('ApiError', () => {
  it('badRequest → 400', () => {
    const err = ApiError.badRequest('Ошибка');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Ошибка');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('unauthorized → 401', () => {
    const err = ApiError.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Не авторизован');
  });

  it('forbidden → 403', () => {
    const err = ApiError.forbidden('Нет доступа');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Нет доступа');
  });

  it('notFound → 404', () => {
    const err = ApiError.notFound();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Не найдено');
  });

  it('conflict → 409', () => {
    const err = ApiError.conflict('Дубликат');
    expect(err.statusCode).toBe(409);
  });

  it('tooMany → 429', () => {
    const err = ApiError.tooMany();
    expect(err.statusCode).toBe(429);
  });

  it('internal → 500, isOperational=false', () => {
    const err = ApiError.internal();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  it('имеет stack trace', () => {
    const err = ApiError.badRequest('test');
    expect(err.stack).toBeDefined();
  });
});
