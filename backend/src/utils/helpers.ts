// ============================================
// MasterUz — Вспомогательные утилиты
// Агент 3 (Бэкенд-разработчик)
// ============================================

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Генерация уникального реферального кода
 */
export function generateReferralCode(): string {
  return `MUZ${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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

/**
 * Расчёт комиссии платформы
 */
export function calculateCommission(price: number, rate: number): number {
  return Math.round((price * rate) / 100 * 100) / 100;
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
