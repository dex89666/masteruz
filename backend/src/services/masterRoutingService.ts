// ============================================
// MasterUz — Master Routing Engine
// Итерация 3: композитный скоринг мастеров для умной рассылки
// ============================================
//
// Идея:
//  Раньше — все мастера получали уведомление одновременно («спам-фан-аут»).
//  Теперь — каждому мастеру считается композитный скор 0..100, и рассылка
//  идёт волнами: топ-3 первыми, затем 4-10, затем остальные.
//
// Скор складывается из:
//   • distance      0..25  — ближе = выше (экспоненциальное затухание)
//   • rating        0..20  — рейтинг мастера / 5 × 20
//   • experience    0..15  — log от completedOrders (cap 100)
//   • specialization 0..15 — прямая категория 15, родитель/потомок 10, иначе 0
//   • freshness     0..10  — онлайн сейчас 10, был <1ч 7, <6ч 4, <24ч 2
//   • priceFit      0..10  — близость hourlyRate к среднему рынку (нейтрально 5)
//   • urgencyBoost  0..5   — срочный заказ + мастер онлайн
//
// Чистая функция: всё нужное передаём аргументами, DB-вызовов внутри нет.
// ============================================

import { logger } from '../utils/logger.js';
import { calculateDistance } from '../utils/helpers.js';

// ─── Типы ────────────────────────────────────────────────────────────────

export interface RoutingMasterInput {
  id: string;
  telegramId?: string | bigint | null;
  profile?: { latitude: number | null; longitude: number | null; city: string | null } | null;
  masterProfile?: {
    rating: number;
    completedOrders: number;
    isOnline: boolean;
    lastSeenAt: Date | null;
    maxDistanceKm: number;
    hourlyRate: { toNumber: () => number } | number | null;
    masterCategories?: { categoryId: string }[];
  } | null;
}

export interface RoutingOrderContext {
  id: string;
  categoryId: string;
  parentCategoryId: string | null;
  childCategoryIds: string[];   // прямые дети order.categoryId
  latitude: number | null;
  longitude: number | null;
  isUrgent: boolean;
  estimatedPrice: number | null;  // order.price (или фиксированная цена)
}

export interface ScoreBreakdown {
  distance: number;       // 0..25
  rating: number;         // 0..20
  experience: number;     // 0..15
  specialization: number; // 0..15
  freshness: number;      // 0..10
  priceFit: number;       // 0..10
  urgencyBoost: number;   // 0..5
}

export interface RankedMaster {
  masterId: string;
  telegramId: bigint | null;
  score: number;              // 0..100
  distanceKm: number | null;
  breakdown: ScoreBreakdown;
}

// ─── Константы скоринга ──────────────────────────────────────────────────

const DEFAULT_MAX_DISTANCE_KM = 30;
const NEW_MASTER_ORDERS_THRESHOLD = 5;   // < 5 заказов = новичок → нейтральный рейтинг
const NEUTRAL_RATING = 4.0;
const MAX_EXPERIENCE_ORDERS = 100;
const MARKET_HOURLY_RATE = 80_000;       // ориентир, сум/час (нейтрально)

// ─── Подсчёт факторов ────────────────────────────────────────────────────

/** Расстояние: экспоненциальное затухание. d=0 → 25, d=maxKm → ≈9, d=2*maxKm → ≈3 */
function scoreDistance(distanceKm: number | null, maxKm: number): number {
  if (distanceKm === null) return 8;        // координаты неизвестны — нейтрально-низко
  if (distanceKm <= 0) return 25;
  const ratio = distanceKm / Math.max(1, maxKm);
  return Math.round(25 * Math.exp(-ratio));
}

/** Рейтинг 0..5 → 0..20. Новичкам — нейтрально (рейтинг ≈4). */
function scoreRating(rating: number, completedOrders: number): number {
  const effective = completedOrders < NEW_MASTER_ORDERS_THRESHOLD ? NEUTRAL_RATING : rating;
  return Math.round((Math.max(0, Math.min(5, effective)) / 5) * 20);
}

/** Опыт: log-шкала. 0 заказов → 0, 10 → ~7, 50 → ~12, 100+ → 15 */
function scoreExperience(completedOrders: number): number {
  if (completedOrders <= 0) return 0;
  const clamped = Math.min(completedOrders, MAX_EXPERIENCE_ORDERS);
  return Math.round((Math.log(1 + clamped) / Math.log(1 + MAX_EXPERIENCE_ORDERS)) * 15);
}

/** Совпадение специализации: прямая=15, родитель/потомок=10, иначе=0 */
function scoreSpecialization(
  masterCategoryIds: string[],
  orderCategoryId: string,
  parentCategoryId: string | null,
  childCategoryIds: string[],
): number {
  if (masterCategoryIds.includes(orderCategoryId)) return 15;
  const relatives = [parentCategoryId, ...childCategoryIds].filter(Boolean) as string[];
  if (masterCategoryIds.some((id) => relatives.includes(id))) return 10;
  return 0;
}

/** Свежесть: онлайн сейчас=10, <1ч=7, <6ч=4, <24ч=2, иначе 0 */
function scoreFreshness(isOnline: boolean, lastSeenAt: Date | null): number {
  if (isOnline) return 10;
  if (!lastSeenAt) return 0;
  const minutesAgo = (Date.now() - lastSeenAt.getTime()) / 60_000;
  if (minutesAgo < 60) return 7;
  if (minutesAgo < 360) return 4;
  if (minutesAgo < 1440) return 2;
  return 0;
}

/**
 * Совпадение цены: 10 = идеально, 0 = очень далеко.
 * Если у мастера нет hourlyRate — нейтрально 5.
 * Если у заказа нет estimatedPrice — нейтрально 5.
 */
function scorePriceFit(hourlyRate: number | null, orderPrice: number | null): number {
  if (!hourlyRate || hourlyRate <= 0 || !orderPrice || orderPrice <= 0) return 5;
  // Эвристика: считаем, что заказ ≈ 2 часа работы. masterPrice = hourlyRate × 2.
  const masterExpected = hourlyRate * 2;
  const ratio = orderPrice / masterExpected;
  // ratio ≈ 1 идеально, далеко в обе стороны — плохо
  if (ratio >= 0.7 && ratio <= 1.5) return 10;
  if (ratio >= 0.5 && ratio <= 2.0) return 7;
  if (ratio >= 0.3 && ratio <= 3.0) return 4;
  return 2;
}

/** Бонус срочности: онлайн мастер срочнику — приоритет */
function scoreUrgencyBoost(isUrgent: boolean, isOnline: boolean): number {
  return isUrgent && isOnline ? 5 : 0;
}

// ─── Извлечение hourlyRate из Prisma Decimal ─────────────────────────────

function toHourlyRate(raw: RoutingMasterInput['masterProfile']): number | null {
  const r = raw?.hourlyRate;
  if (r === null || r === undefined) return null;
  if (typeof r === 'number') return r;
  if (typeof r === 'object' && 'toNumber' in r) return r.toNumber();
  return null;
}

// ─── Главная функция: ранжирование ───────────────────────────────────────

/**
 * Считает композитный скор и сортирует мастеров от лучшего к худшему.
 * Чистая функция: без побочных эффектов и DB-вызовов.
 */
export function rankMasters(
  masters: RoutingMasterInput[],
  order: RoutingOrderContext,
): RankedMaster[] {
  const orderHasGeo = order.latitude !== null && order.longitude !== null;

  const ranked = masters.map((m): RankedMaster => {
    const mp = m.masterProfile;
    const maxKm = mp?.maxDistanceKm || DEFAULT_MAX_DISTANCE_KM;

    let distanceKm: number | null = null;
    if (orderHasGeo && m.profile?.latitude && m.profile?.longitude) {
      distanceKm = Math.round(
        calculateDistance(order.latitude!, order.longitude!, m.profile.latitude, m.profile.longitude) * 10,
      ) / 10;
    }

    const masterCategoryIds = (mp?.masterCategories ?? []).map((c) => c.categoryId);
    const hourlyRate = toHourlyRate(mp);

    const breakdown: ScoreBreakdown = {
      distance: scoreDistance(distanceKm, maxKm),
      rating: scoreRating(mp?.rating ?? 0, mp?.completedOrders ?? 0),
      experience: scoreExperience(mp?.completedOrders ?? 0),
      specialization: scoreSpecialization(
        masterCategoryIds,
        order.categoryId,
        order.parentCategoryId,
        order.childCategoryIds,
      ),
      freshness: scoreFreshness(mp?.isOnline ?? false, mp?.lastSeenAt ?? null),
      priceFit: scorePriceFit(hourlyRate, order.estimatedPrice),
      urgencyBoost: scoreUrgencyBoost(order.isUrgent, mp?.isOnline ?? false),
    };

    const score =
      breakdown.distance +
      breakdown.rating +
      breakdown.experience +
      breakdown.specialization +
      breakdown.freshness +
      breakdown.priceFit +
      breakdown.urgencyBoost;

    const tg = m.telegramId;
    const telegramId: bigint | null =
      tg === null || tg === undefined ? null : typeof tg === 'bigint' ? tg : BigInt(tg);

    return {
      masterId: m.id,
      telegramId,
      score,
      distanceKm,
      breakdown,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

// ─── Волновая нарезка ────────────────────────────────────────────────────

export interface DispatchWave {
  wave: 1 | 2 | 3;
  delayMs: number;
  masters: RankedMaster[];
}

/**
 * Делит ранжированный список на волны рассылки:
 *  • Волна 1 (мгновенно): top-3 — самые подходящие
 *  • Волна 2 (+2 минуты): следующие 7 (позиции 4-10)
 *  • Волна 3 (+5 минут): все остальные
 *
 * Для срочных заказов — волны сжимаются: 1=top-5 сразу, 2=через 30с, 3=через 90с.
 */
export function splitIntoWaves(ranked: RankedMaster[], isUrgent: boolean): DispatchWave[] {
  if (ranked.length === 0) return [];

  if (isUrgent) {
    return [
      { wave: 1, delayMs: 0, masters: ranked.slice(0, 5) },
      { wave: 2, delayMs: 30_000, masters: ranked.slice(5, 15) },
      { wave: 3, delayMs: 90_000, masters: ranked.slice(15) },
    ].filter((w) => w.masters.length > 0) as DispatchWave[];
  }

  return [
    { wave: 1, delayMs: 0, masters: ranked.slice(0, 3) },
    { wave: 2, delayMs: 120_000, masters: ranked.slice(3, 10) },
    { wave: 3, delayMs: 300_000, masters: ranked.slice(10) },
  ].filter((w) => w.masters.length > 0) as DispatchWave[];
}

// ─── Логирование для отладки ─────────────────────────────────────────────

export function logRoutingDecision(orderId: string, ranked: RankedMaster[]): void {
  const top5 = ranked.slice(0, 5).map((r) => ({
    masterId: r.masterId,
    score: r.score,
    distanceKm: r.distanceKm,
    breakdown: r.breakdown,
  }));
  logger.info(
    { orderId, total: ranked.length, top5 },
    'masterRouting: ранжирование завершено',
  );
}
