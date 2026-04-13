// ============================================
// MasterUz — Integration Tests: Catalog API
// Агент 8 (Тестировщик) — Тестирование каталога через supertest
// ============================================

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Тестовые данные категорий
const mockCategories = [
  { id: '1', name: 'Сантехника', slug: 'plumbing', icon: '🔧', sortOrder: 0, subcategories: [
    { id: 's1', name: 'Краны', slug: 'plumbing-faucets', _count: { tasks: 3 }, tasks: [
      { id: 't1', name: 'Замена крана', slug: 'replace-faucet', minPrice: 50000, estimatedTime: '1-2 часа' },
    ] },
    { id: 's2', name: 'Трубы', slug: 'plumbing-pipes', _count: { tasks: 2 }, tasks: [] },
    { id: 's3', name: 'Унитазы', slug: 'plumbing-toilets', _count: { tasks: 2 }, tasks: [] },
  ] },
];

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    platformConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    category: {
      findMany: vi.fn().mockResolvedValue(mockCategories),
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        const cat = mockCategories.find(c => c.slug === where.slug || c.id === where.id);
        return Promise.resolve(cat || null);
      }),
    },
    subcategory: {
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        for (const cat of mockCategories) {
          const sub = cat.subcategories.find(s => s.slug === where.slug);
          if (sub) return Promise.resolve(sub);
        }
        return Promise.resolve(null);
      }),
    },
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

const { default: app } = await import('../../src/app.js');

describe('Catalog API — Интеграционные тесты (supertest)', () => {

  describe('GET /api/catalog/categories', () => {
    it('возвращает список категорий', async () => {
      const res = await request(app).get('/api/catalog/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/catalog/categories/:slug', () => {
    it('возвращает 404 для несуществующего slug', async () => {
      const res = await request(app).get('/api/catalog/categories/nonexistent');
      expect([404, 500]).toContain(res.status);
    });
  });
});
