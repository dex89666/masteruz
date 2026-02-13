// ============================================
// MasterUz — Unit Tests: Order Validation Schemas
// Агент 8 (Тестировщик) — Валидация заказов
// ============================================

import { describe, it, expect } from 'vitest';
import { createOrderSchema, orderResponseSchema, listOrdersSchema } from '../../src/modules/orders/orders.schema.js';

describe('orders.schema.ts — Валидация', () => {

  describe('createOrderSchema', () => {
    const validOrder = {
      categoryId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Ремонт крана',
      description: 'Течёт кран на кухне, нужно заменить',
      price: 200000,
      offerAccepted: true,
    };

    it('принимает валидный заказ', () => {
      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('отклоняет заказ без принятия оферты', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, offerAccepted: false });
      expect(result.success).toBe(false);
    });

    it('отклоняет слишком короткий title (< 3 символов)', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, title: 'OK' });
      expect(result.success).toBe(false);
    });

    it('отклоняет слишком короткое описание (< 10 символов)', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, description: 'Крат' });
      expect(result.success).toBe(false);
    });

    it('отклоняет отрицательную цену', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, price: -100 });
      expect(result.success).toBe(false);
    });

    it('отклоняет нулевую цену', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, price: 0 });
      expect(result.success).toBe(false);
    });

    it('отклоняет невалидный UUID для categoryId', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, categoryId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('принимает опциональные координаты', () => {
      const result = createOrderSchema.safeParse({
        ...validOrder,
        latitude: 41.2995,
        longitude: 69.2401,
        address: 'Ташкент, Чиланзарский район',
      });
      expect(result.success).toBe(true);
    });

    it('отклоняет широту вне диапазона', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, latitude: 95.0 });
      expect(result.success).toBe(false);
    });

    it('отклоняет долготу вне диапазона', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, longitude: 200.0 });
      expect(result.success).toBe(false);
    });

    it('принимает массив taskIds', () => {
      const result = createOrderSchema.safeParse({
        ...validOrder,
        taskIds: ['123e4567-e89b-12d3-a456-426614174000'],
      });
      expect(result.success).toBe(true);
    });

    it('принимает срочный заказ', () => {
      const result = createOrderSchema.safeParse({ ...validOrder, isUrgent: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isUrgent).toBe(true);
      }
    });

    it('isUrgent по умолчанию false', () => {
      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isUrgent).toBe(false);
      }
    });
  });

  describe('orderResponseSchema', () => {
    it('принимает отклик с ценой', () => {
      const result = orderResponseSchema.safeParse({ priceOffer: 150000, message: 'Могу сделать за 150к' });
      expect(result.success).toBe(true);
    });

    it('принимает отклик без цены', () => {
      const result = orderResponseSchema.safeParse({ message: 'Готов помочь' });
      expect(result.success).toBe(true);
    });

    it('принимает пустой отклик', () => {
      const result = orderResponseSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('отклоняет слишком длинное сообщение (> 500)', () => {
      const result = orderResponseSchema.safeParse({ message: 'x'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('отклоняет отрицательную цену', () => {
      const result = orderResponseSchema.safeParse({ priceOffer: -50000 });
      expect(result.success).toBe(false);
    });
  });

  describe('listOrdersSchema', () => {
    it('принимает пустой query', () => {
      const result = listOrdersSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('парсит page и limit из строк', () => {
      const result = listOrdersSchema.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it('принимает фильтр sortBy', () => {
      const result = listOrdersSchema.safeParse({ sortBy: 'price', sortOrder: 'asc' });
      expect(result.success).toBe(true);
    });

    it('отклоняет невалидный sortBy', () => {
      const result = listOrdersSchema.safeParse({ sortBy: 'invalid' });
      expect(result.success).toBe(false);
    });
  });
});
