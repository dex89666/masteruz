// ============================================
// MasterUz — Unit Tests: Validate Middleware (Zod)
// Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../src/middleware/validate.js';

const testSchema = z.object({
  name: z.string().min(2),
  age: z.number().positive(),
});

describe('validateBody', () => {
  it('пропускает валидный body', () => {
    const req = { body: { name: 'Тест', age: 25 } } as any;
    const next = vi.fn();
    validateBody(testSchema)(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(); // без ошибки
    expect(req.body.name).toBe('Тест');
  });

  it('вызывает next(error) для невалидного body', () => {
    const req = { body: { name: 'A', age: -5 } } as any;
    const next = vi.fn();
    validateBody(testSchema)(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});

describe('validateQuery', () => {
  const querySchema = z.object({
    page: z.string().default('1'),
  });

  it('пропускает валидный query', () => {
    const req = { query: { page: '2' } } as any;
    const next = vi.fn();
    validateQuery(querySchema)(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('устанавливает default если query пустой', () => {
    const req = { query: {} } as any;
    const next = vi.fn();
    validateQuery(querySchema)(req, {} as any, next);
    expect(req.query.page).toBe('1');
  });
});

describe('validateParams', () => {
  const paramsSchema = z.object({
    id: z.string().uuid(),
  });

  it('пропускает валидный UUID', () => {
    const req = { params: { id: '123e4567-e89b-12d3-a456-426614174000' } } as any;
    const next = vi.fn();
    validateParams(paramsSchema)(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('отклоняет невалидный UUID', () => {
    const req = { params: { id: 'not-uuid' } } as any;
    const next = vi.fn();
    validateParams(paramsSchema)(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});
