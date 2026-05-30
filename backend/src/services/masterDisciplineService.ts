/**
 * Дисциплина мастера: предупреждения и автоблокировки.
 *
 * Бизнес-правило:
 *  • Мастер может отменить ACCEPTED-заказ без штрафа (контактов он ещё не видел).
 *  • Если же мастер уже нажал «Выехал» (IN_TRANSIT и далее) и видел контакты
 *    клиента — за отмену ему начисляется штраф 15% от стоимости работ
 *    плюс предупреждение. На 4-м предупреждении — блок на 5 дней,
 *    счётчик предупреждений сбрасывается.
 *
 * Все операции изолированы здесь, чтобы orders.service не разбухал и логика
 * блокировки была переиспользуема (middleware, админ-панель).
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const WARNING_THRESHOLD = 4;
export const BLOCK_DURATION_DAYS = 5;
export const PENALTY_RATE_AFTER_TRANSIT = 0.15;

export interface IssueWarningInput {
  userId: string;
  orderId?: string;
  reason: 'CANCEL_AFTER_TRANSIT';
  penaltyAmount: number;
}

export interface IssueWarningResult {
  warningNo: number;          // 1..4 в текущем цикле
  warningCount: number;        // итоговое значение в users.warning_count после операции
  blockedUntil: Date | null;   // если этот warning спровоцировал блок
  threshold: number;
}

/**
 * Атомарно: повышает warning_count, при достижении порога — блокирует на 5 дней
 * и сбрасывает счётчик в 0. Создаёт запись в master_warnings.
 *
 * Принимает Prisma-транзакцию, если нужно встроить в существующую транзакцию.
 */
export async function issueMasterWarning(
  input: IssueWarningInput,
  tx?: typeof prisma,
): Promise<IssueWarningResult> {
  const db = tx ?? prisma;

  const now = new Date();
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { warningCount: true, blockedUntil: true },
  });
  if (!user) {
    throw new Error(`issueMasterWarning: user ${input.userId} not found`);
  }

  const nextNo = user.warningCount + 1;
  const reachesThreshold = nextNo >= WARNING_THRESHOLD;
  const blockUntil = reachesThreshold
    ? new Date(now.getTime() + BLOCK_DURATION_DAYS * 24 * 60 * 60 * 1000)
    : null;

  await db.user.update({
    where: { id: input.userId },
    data: {
      warningCount: reachesThreshold ? 0 : nextNo,
      lastWarningAt: now,
      blockedUntil: blockUntil ?? user.blockedUntil,
    },
  });

  await db.masterWarning.create({
    data: {
      userId: input.userId,
      orderId: input.orderId ?? null,
      reason: input.reason,
      penaltyAmount: input.penaltyAmount,
      warningNo: nextNo,
      blockedUntil: blockUntil,
    },
  });

  logger.warn(
    {
      userId: input.userId,
      orderId: input.orderId,
      warningNo: nextNo,
      threshold: WARNING_THRESHOLD,
      blockedUntil: blockUntil?.toISOString() ?? null,
      penaltyAmount: input.penaltyAmount,
    },
    reachesThreshold
      ? 'masterDiscipline: BLOCK — порог достигнут'
      : 'masterDiscipline: warning выдан',
  );

  return {
    warningNo: nextNo,
    warningCount: reachesThreshold ? 0 : nextNo,
    blockedUntil: blockUntil,
    threshold: WARNING_THRESHOLD,
  };
}

/**
 * Проверяет, заблокирован ли пользователь сейчас. Возвращает оставшееся время
 * блокировки в миллисекундах (>0) или null, если не заблокирован.
 */
export function getBlockRemainingMs(blockedUntil: Date | null | undefined): number | null {
  if (!blockedUntil) return null;
  const ms = blockedUntil.getTime() - Date.now();
  return ms > 0 ? ms : null;
}

/**
 * Полная сводка для UI «Моя дисциплина» — счётчик, блок, последние warnings.
 */
export async function getMasterDisciplineSummary(userId: string) {
  const [user, recent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { warningCount: true, blockedUntil: true, lastWarningAt: true },
    }),
    prisma.masterWarning.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  if (!user) return null;
  const remainingMs = getBlockRemainingMs(user.blockedUntil);
  return {
    warningCount: user.warningCount,
    threshold: WARNING_THRESHOLD,
    isBlocked: remainingMs !== null,
    blockedUntil: user.blockedUntil,
    blockRemainingMs: remainingMs,
    lastWarningAt: user.lastWarningAt,
    history: recent,
  };
}
