// ============================================
// MasterUz — Unit Tests: Helpers / Utilities
// Агент 8 (Тестировщик)
// ============================================

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateCommission,
  generateReferralCode,
  getPagination,
  paginatedResponse,
  parseNumber,
} from '../../src/utils/helpers.js';

describe('helpers.ts', () => {
  // ──── calculateDistance (Haversine) ────────────
  describe('calculateDistance', () => {
    it('должен вернуть 0 для одной и той же точки', () => {
      const d = calculateDistance(41.2995, 69.2401, 41.2995, 69.2401);
      expect(d).toBe(0);
    });

    it('должен рассчитать расстояние между Ташкентом и Самаркандом (~275 км)', () => {
      const d = calculateDistance(41.2995, 69.2401, 39.6542, 66.9597);
      expect(d).toBeGreaterThan(250);
      expect(d).toBeLessThan(310);
    });

    it('должен рассчитать расстояние между Ташкентом и Бухарой (~550 км)', () => {
      const d = calculateDistance(41.2995, 69.2401, 39.7745, 64.4226);
      expect(d).toBeGreaterThan(400);
      expect(d).toBeLessThan(600);
    });

    it('должен быть коммутативным (A→B = B→A)', () => {
      const d1 = calculateDistance(41.2995, 69.2401, 39.6542, 66.9597);
      const d2 = calculateDistance(39.6542, 66.9597, 41.2995, 69.2401);
      expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });

    it('должен вернуть корректное расстояние для коротких дистанций (5 км)', () => {
      // Точки в районе Ташкента (~5 км друг от друга)
      const d = calculateDistance(41.2995, 69.2401, 41.3400, 69.2800);
      expect(d).toBeGreaterThan(3);
      expect(d).toBeLessThan(8);
    });
  });

  // ──── calculateCommission ─────────────────────
  describe('calculateCommission', () => {
    it('15% от 100 000 = 15 000', () => {
      expect(calculateCommission(100000, 15)).toBe(15000);
    });

    it('10% от 500 000 = 50 000', () => {
      expect(calculateCommission(500000, 10)).toBe(50000);
    });

    it('0% от любой суммы = 0', () => {
      expect(calculateCommission(1000000, 0)).toBe(0);
    });

    it('100% от суммы = вся сумма', () => {
      expect(calculateCommission(250000, 100)).toBe(250000);
    });

    it('дробная комиссия округляется корректно', () => {
      const comm = calculateCommission(333333, 15);
      // 333333 * 15 / 100 = 49999.95
      expect(comm).toBeCloseTo(49999.95, 2);
    });
  });

  // ──── generateReferralCode ────────────────────
  describe('generateReferralCode', () => {
    it('должен генерировать код начинающийся с MUZ', () => {
      const code = generateReferralCode();
      expect(code).toMatch(/^MUZ[A-F0-9]{8}$/);
    });

    it('должен генерировать уникальные коды', () => {
      const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
      expect(codes.size).toBe(100);
    });

    it('длина кода должна быть 11 символов', () => {
      expect(generateReferralCode().length).toBe(11);
    });
  });

  // ──── getPagination ──────────────────────────
  describe('getPagination', () => {
    it('page=1, limit=20 → skip=0, take=20', () => {
      const p = getPagination(1, 20);
      expect(p.skip).toBe(0);
      expect(p.take).toBe(20);
      expect(p.page).toBe(1);
      expect(p.limit).toBe(20);
    });

    it('page=3, limit=10 → skip=20, take=10', () => {
      const p = getPagination(3, 10);
      expect(p.skip).toBe(20);
      expect(p.take).toBe(10);
    });

    it('page < 1 → force page=1', () => {
      const p = getPagination(-5, 20);
      expect(p.page).toBe(1);
      expect(p.skip).toBe(0);
    });

    it('limit > 100 → cap at 100', () => {
      const p = getPagination(1, 500);
      expect(p.limit).toBe(100);
      expect(p.take).toBe(100);
    });

    it('limit < 1 → force to 1', () => {
      const p = getPagination(1, -10);
      expect(p.limit).toBe(1);
    });
  });

  // ──── paginatedResponse ──────────────────────
  describe('paginatedResponse', () => {
    it('корректные поля пагинации', () => {
      const result = paginatedResponse(['a', 'b'], 50, 1, 20);
      expect(result.data).toEqual(['a', 'b']);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('последняя страница → hasNext=false', () => {
      const result = paginatedResponse([], 20, 1, 20);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('вторая страница → hasPrev=true', () => {
      const result = paginatedResponse([], 50, 2, 20);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  // ──── parseNumber ─────────────────────────────
  describe('parseNumber', () => {
    it('число → возвращает как есть', () => {
      expect(parseNumber(42, 0)).toBe(42);
    });

    it('строка "123" → 123', () => {
      expect(parseNumber('123', 0)).toBe(123);
    });

    it('невалидная строка → default', () => {
      expect(parseNumber('abc', 99)).toBe(99);
    });

    it('null → default', () => {
      expect(parseNumber(null, 10)).toBe(10);
    });

    it('undefined → default', () => {
      expect(parseNumber(undefined, 10)).toBe(10);
    });
  });
});
