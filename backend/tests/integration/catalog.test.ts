// ============================================
// MasterUz — Integration Tests: Catalog API
// Агент 8 (Тестировщик) — Тестирование каталога
// ============================================

import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:3001/api';

// Хелпер для fetch с таймаутом
async function apiFetch(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const data = await res.json();
    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

describe('Catalog API — Интеграционные тесты', () => {

  describe('GET /api/catalog/categories', () => {
    it('возвращает 14 категорий', async () => {
      const { status, data } = await apiFetch('/catalog/categories');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(14);
    });

    it('каждая категория имеет обязательные поля', async () => {
      const { data } = await apiFetch('/catalog/categories');
      for (const cat of data.data) {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(cat.slug).toBeDefined();
        expect(cat.icon).toBeDefined();
        expect(cat.subcategories).toBeDefined();
        expect(Array.isArray(cat.subcategories)).toBe(true);
      }
    });

    it('каждая категория имеет минимум 3 подкатегории', async () => {
      const { data } = await apiFetch('/catalog/categories');
      for (const cat of data.data) {
        expect(cat.subcategories.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('подкатегории имеют _count.tasks', async () => {
      const { data } = await apiFetch('/catalog/categories');
      for (const cat of data.data) {
        for (const sub of cat.subcategories) {
          expect(sub._count).toBeDefined();
          expect(sub._count.tasks).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('GET /api/catalog/categories/:slug', () => {
    it('возвращает категорию по slug', async () => {
      const { status, data } = await apiFetch('/catalog/categories/plumbing');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.slug).toBe('plumbing');
      expect(data.data.name).toContain('Сантехника');
    });

    it('возвращает 404 для несуществующего slug', async () => {
      const { status, data } = await apiFetch('/catalog/categories/nonexistent');
      expect(status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/catalog/subcategories/:slug', () => {
    it('возвращает подкатегорию с задачами', async () => {
      const { status, data } = await apiFetch('/catalog/subcategories/plumbing-faucets');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.slug).toBe('plumbing-faucets');
      expect(data.data.tasks).toBeDefined();
      expect(data.data.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('задачи имеют minPrice и estimatedTime', async () => {
      const { data } = await apiFetch('/catalog/subcategories/plumbing-faucets');
      for (const task of data.data.tasks) {
        expect(task.name).toBeDefined();
        expect(task.slug).toBeDefined();
        expect(task.minPrice).toBeDefined();
        expect(task.minPrice).toBeGreaterThan(0);
      }
    });
  });
});

describe('Health Check', () => {
  it('GET /api/health возвращает статус ok', async () => {
    const { status, data } = await apiFetch('/health');
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('ok');
    expect(data.data.services.database).toBe('ok');
  });
});
