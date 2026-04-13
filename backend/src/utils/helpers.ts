// ============================================
// MasterUz — Вспомогательные утилиты
// Агент 3 (Бэкенд-разработчик)
// ============================================

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { config } from '../config/index.js';

// Конфигурация Decimal.js: 20 знаков, округление к ближайшему чётному (банковское)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Проверка суперадмина по username (из env SUPER_ADMIN_USERNAMES)
 */
export function isSuperAdmin(username: string | null | undefined): boolean {
  if (!username) return false;
  return config.superAdminUsernames.includes(username);
}

/**
 * Генерация уникального реферального кода
 */
export function generateReferralCode(): string {
  return `MUZ${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Безопасная пагинация — ограничением limit сверху (защита от DoS)
 */
export function clampPagination(rawPage: unknown, rawLimit: unknown, maxLimit = 100): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(Math.max(1, Number(rawLimit) || 20), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Расчёт расстояния между двумя точками (формула Haversine)
 * Возвращает расстояние в километрах
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Радиус Земли в км
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ═══════════════════════════════════════════
// Decimal.js утилиты для денежных расчётов
// ═══════════════════════════════════════════

/**
 * Расчёт комиссии платформы (Decimal.js — без float-ошибок)
 * @param price  — цена заказа (сум)
 * @param rate   — процент комиссии (15 = 15%)
 * @returns число, округлённое до 2 знаков
 */
export function calculateCommission(price: number, rate: number): number {
  return new Decimal(price).mul(rate).div(100).toDecimalPlaces(2).toNumber();
}

/**
 * Безопасное сложение денежных сумм
 */
export function moneyAdd(a: number, b: number): number {
  return new Decimal(a).plus(b).toDecimalPlaces(2).toNumber();
}

/**
 * Безопасное вычитание денежных сумм
 */
export function moneySub(a: number, b: number): number {
  return new Decimal(a).minus(b).toDecimalPlaces(2).toNumber();
}

/**
 * Безопасное умножение (для urgentMultiplier и т.д.)
 */
export function moneyMul(a: number, b: number): number {
  return new Decimal(a).mul(b).toDecimalPlaces(2).toNumber();
}

/**
 * Безопасное деление (для split 50/50 и т.д.)
 */
export function moneyDiv(a: number, b: number): number {
  if (b === 0) return 0;
  return new Decimal(a).div(b).toDecimalPlaces(2).toNumber();
}

/**
 * Пагинация — вычисление skip/take для Prisma
 */
export function getPagination(page: number = 1, limit: number = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Форматирование ответа с пагинацией
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/**
 * Генерация UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Безопасное парсинг числа из строки
 */
export function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Конвертация Prisma Decimal → number (безопасная)
 * Prisma возвращает Decimal-объекты для полей типа Decimal.
 * Эта утилита делает Number() только если значение не является уже number.
 */
export function toNum(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toNumber === 'function') return value.toNumber();
  return Number(value) || 0;
}
