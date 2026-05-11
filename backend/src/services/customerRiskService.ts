// ============================================
// MasterUz — Customer Risk Score Service
// Iteration 2: скоринг клиентов 0..100 (низкий → высокий риск)
// ============================================
//
// Архитектура:
//  • riskScore хранится в users.risk_score, дефолт 50 (нейтрально).
//  • Пересчёт — event-driven: после ключевых событий (отмена, спор,
//    отзыв мастера, завершение заказа) вызываем recalculate(clientId).
//  • Формула — взвешенная сумма факторов с экспоненциальным затуханием
//    по времени (старые события весят меньше).
//  • riskFactors хранит снапшот: какие события и с каким весом учли.
// ============================================

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Конфигурация ────────────────────────────────────────────────────────

const BASE_SCORE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

/** Окно учёта истории — события старше игнорируются */
const LOOKBACK_DAYS = 365;

/** Полупериод затухания веса события (дней). За 90 дней вес × 0.5 */
const HALF_LIFE_DAYS = 90;

/** Веса факторов (плюс = повышает риск, минус = понижает) */
const W = {
  // Хорошее поведение
  ORDER_COMPLETED: -3,
  GOOD_MASTER_REVIEW: -4,           // mаster ставит overall 5 без флагов
  NEUTRAL_MASTER_REVIEW: -1,        // overall 4
  // Плохое поведение
  CANCELLED_BEFORE_ACCEPT: 0,       // нормально, не учитываем
  CANCELLED_AFTER_ACCEPT: 8,
  CANCELLED_IN_PROGRESS: 18,
  DISPUTED: 6,                      // открытие спора само по себе
  LOW_MASTER_REVIEW: 10,            // overall 1-2
  FLAG_RUDE: 8,
  FLAG_NO_SHOW: 12,
  FLAG_HAGGLED_HARD: 4,
  FLAG_CHANGED_SCOPE: 5,
  FLAG_DELAYED_PAYMENT: 7,
} as const;

// ─── Типы ────────────────────────────────────────────────────────────────

export interface RiskFactor {
  type: string;
  weight: number;
  decayed: number;
  at: string; // ISO date
  ref?: string; // orderId / reviewId
}

export interface RiskSnapshot {
  score: number;
  band: 'low' | 'normal' | 'caution' | 'high';
  factors: RiskFactor[];
  computedAt: string;
  totals: {
    completed: number;
    cancelledByClient: number;
    disputes: number;
    masterReviews: number;
  };
}

// ─── Вспомогательные ─────────────────────────────────────────────────────

function decay(weight: number, ageDays: number): number {
  // exp(-ln2 * age / halflife) — классический полураспад
  const factor = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  return weight * factor;
}

function ageDays(at: Date, now = Date.now()): number {
  return Math.max(0, (now - at.getTime()) / 86_400_000);
}

function bandOf(score: number): RiskSnapshot['band'] {
  if (score <= 30) return 'low';
  if (score <= 60) return 'normal';
  if (score <= 80) return 'caution';
  return 'high';
}

// ─── Главная функция ─────────────────────────────────────────────────────

export async function recalculateRiskScore(clientId: string): Promise<RiskSnapshot> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  const factors: RiskFactor[] = [];

  // 1. Все заказы клиента в окне
  const orders = await prisma.order.findMany({
    where: { clientId, createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      cancelledAt: true,
      cancelledBy: true,
      disputeReason: true,
      updatedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  let completed = 0;
  let cancelledByClient = 0;
  let disputes = 0;

  for (const o of orders) {
    // Завершённые
    if (o.status === 'COMPLETED' && o.completedAt) {
      completed++;
      const a = ageDays(o.completedAt);
      factors.push({
        type: 'ORDER_COMPLETED',
        weight: W.ORDER_COMPLETED,
        decayed: decay(W.ORDER_COMPLETED, a),
        at: o.completedAt.toISOString(),
        ref: o.id,
      });
    }
    // Отмены клиентом
    if (o.status === 'CANCELLED' && o.cancelledBy === 'CLIENT' && o.cancelledAt) {
      cancelledByClient++;
      const weight = W.CANCELLED_AFTER_ACCEPT;
      const a = ageDays(o.cancelledAt);
      factors.push({
        type: 'CANCELLED_AFTER_ACCEPT',
        weight,
        decayed: decay(weight, a),
        at: o.cancelledAt.toISOString(),
        ref: o.id,
      });
    }
    // Споры (трекаем по disputeReason — он ставится при открытии)
    if (o.disputeReason) {
      disputes++;
      const a = ageDays(o.updatedAt);
      factors.push({
        type: 'DISPUTED',
        weight: W.DISPUTED,
        decayed: decay(W.DISPUTED, a),
        at: o.updatedAt.toISOString(),
        ref: o.id,
      });
    }
  }

  // 2. Отзывы мастеров о клиенте
  const reviews = await prisma.masterReviewClient.findMany({
    where: { clientId, createdAt: { gte: since } },
  });

  for (const r of reviews) {
    const a = ageDays(r.createdAt);

    // Базовая оценка
    let baseW = 0;
    let baseType = '';
    if (r.overall >= 5) {
      baseW = W.GOOD_MASTER_REVIEW;
      baseType = 'GOOD_MASTER_REVIEW';
    } else if (r.overall === 4) {
      baseW = W.NEUTRAL_MASTER_REVIEW;
      baseType = 'NEUTRAL_MASTER_REVIEW';
    } else if (r.overall <= 2) {
      baseW = W.LOW_MASTER_REVIEW;
      baseType = 'LOW_MASTER_REVIEW';
    }
    if (baseW !== 0) {
      factors.push({
        type: baseType,
        weight: baseW,
        decayed: decay(baseW, a),
        at: r.createdAt.toISOString(),
        ref: r.id,
      });
    }

    // Флаги
    const flagMap: Array<[boolean, keyof typeof W, string]> = [
      [r.wasRude, 'FLAG_RUDE', 'FLAG_RUDE'],
      [r.wasNoShow, 'FLAG_NO_SHOW', 'FLAG_NO_SHOW'],
      [r.haggledHard, 'FLAG_HAGGLED_HARD', 'FLAG_HAGGLED_HARD'],
      [r.changedScope, 'FLAG_CHANGED_SCOPE', 'FLAG_CHANGED_SCOPE'],
      [r.delayedPayment, 'FLAG_DELAYED_PAYMENT', 'FLAG_DELAYED_PAYMENT'],
    ];
    for (const [on, key, type] of flagMap) {
      if (!on) continue;
      const w = W[key];
      factors.push({
        type,
        weight: w,
        decayed: decay(w, a),
        at: r.createdAt.toISOString(),
        ref: r.id,
      });
    }
  }

  // 3. Считаем итоговый score
  const total = factors.reduce((sum, f) => sum + f.decayed, 0);
  const score = Math.round(Math.max(MIN_SCORE, Math.min(MAX_SCORE, BASE_SCORE + total)));

  const snapshot: RiskSnapshot = {
    score,
    band: bandOf(score),
    factors,
    computedAt: new Date().toISOString(),
    totals: {
      completed,
      cancelledByClient,
      disputes,
      masterReviews: reviews.length,
    },
  };

  // 4. Сохраняем в БД
  await prisma.user.update({
    where: { id: clientId },
    data: {
      riskScore: score,
      riskUpdatedAt: new Date(),
      riskFactors: snapshot as any,
    },
  });

  logger.info(
    { clientId, score, band: snapshot.band, factorCount: factors.length },
    'Customer Risk Score: пересчитан'
  );

  return snapshot;
}

// ─── Безопасная обёртка для триггеров событий ────────────────────────────
// Не должна ронять основную операцию: ошибка скоринга = log + продолжаем.
export async function safeRecalculate(clientId: string | null | undefined): Promise<void> {
  if (!clientId) return;
  try {
    await recalculateRiskScore(clientId);
  } catch (err: any) {
    logger.error(
      { clientId, err: err?.message, stack: err?.stack?.substring(0, 300) },
      'Customer Risk Score: ошибка пересчёта (проигнорирована)'
    );
  }
}

// ─── Получение текущего скора без пересчёта ──────────────────────────────
export async function getRiskScore(clientId: string): Promise<{
  score: number;
  band: RiskSnapshot['band'];
  updatedAt: Date | null;
}> {
  const u = await prisma.user.findUnique({
    where: { id: clientId },
    select: { riskScore: true, riskUpdatedAt: true },
  });
  const score = u?.riskScore ?? BASE_SCORE;
  return {
    score,
    band: bandOf(score),
    updatedAt: u?.riskUpdatedAt ?? null,
  };
}
