// ============================================
// MasterUz — Moderation Strikes
// Накопительная система: предупреждение → штраф → блокировка
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/** Сумма штрафа за третье нарушение (сум). */
const FINE_AMOUNT = 10_000;
/** Порог: после которого начисляется штраф. */
const FINE_THRESHOLD = 3;
/** Порог: после которого аккаунт блокируется. */
const BAN_THRESHOLD = 5;

export type StrikeAction =
  | { kind: 'warning'; strikeNumber: number; remainingBeforeFine: number }
  | { kind: 'fine'; strikeNumber: number; amount: number }
  | { kind: 'ban'; strikeNumber: number };

/**
 * Применяет санкцию по числу зафлагованных сообщений автора.
 * Возвращает применённую меру + сообщение для уведомления.
 */
export async function applyModerationStrike(params: {
  userId: string;
  orderId: string;
  messageId: string;
  reason: string;
}): Promise<{ action: StrikeAction; notice: string }> {
  const { userId, orderId, messageId, reason } = params;

  // Считаем удалённые модерацией сообщения автора (включая только что созданное).
  // isBlocked=true ставится только для нарушений категории flag (обход платформы / контакты).
  const strikeNumber = await prisma.chatMessage.count({
    where: { senderId: userId, isBlocked: true },
  });

  let action: StrikeAction;
  let notice: string;

  if (strikeNumber >= BAN_THRESHOLD) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    action = { kind: 'ban', strikeNumber };
    notice =
      `🚫 Ваш аккаунт заблокирован за систематические нарушения правил общения в чате (${strikeNumber} нарушений). ` +
      `Свяжитесь с поддержкой для разблокировки.`;
    logger.warn({ userId, strikeNumber, orderId, messageId }, 'Аккаунт заблокирован модерацией чата');
  } else if (strikeNumber === FINE_THRESHOLD) {
    // Списываем штраф с баланса (баланс может уйти в минус — взыщется при следующем пополнении).
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      const before = new Prisma.Decimal(user?.balance ?? 0);
      const after = before.sub(FINE_AMOUNT);
      await tx.user.update({
        where: { id: userId },
        data: { balance: after },
      });
      await tx.balanceTransaction.create({
        data: {
          userId,
          type: 'PENALTY',
          amount: new Prisma.Decimal(-FINE_AMOUNT),
          balanceBefore: before,
          balanceAfter: after,
          orderId,
          description: `Штраф за нарушение правил чата: ${reason}`,
          metadata: { messageId, strikeNumber, reason },
        },
      });
    });
    action = { kind: 'fine', strikeNumber, amount: FINE_AMOUNT };
    notice =
      `💸 С вашего баланса списан штраф ${FINE_AMOUNT.toLocaleString('ru-RU')} сум за нарушение правил общения в чате. ` +
      `Это ${strikeNumber}-е нарушение. Ещё ${BAN_THRESHOLD - strikeNumber} нарушения — и аккаунт будет заблокирован.`;
    logger.warn({ userId, strikeNumber, amount: FINE_AMOUNT, orderId, messageId }, 'Штраф за нарушение чата');
  } else {
    action = { kind: 'warning', strikeNumber, remainingBeforeFine: FINE_THRESHOLD - strikeNumber };
    notice =
      `⚠️ Предупреждение: ваше сообщение удалено модератором. Причина: ${reason}. ` +
      `Передача контактов и попытки обхода платформы запрещены. ` +
      `Это ${strikeNumber}-е предупреждение. ` +
      `После ${FINE_THRESHOLD}-го — штраф ${FINE_AMOUNT.toLocaleString('ru-RU')} сум, после ${BAN_THRESHOLD}-го — блокировка аккаунта.`;
    logger.info({ userId, strikeNumber, orderId, messageId }, 'Предупреждение в чате');
  }

  return { action, notice };
}

export const MODERATION_CONFIG = {
  FINE_AMOUNT,
  FINE_THRESHOLD,
  BAN_THRESHOLD,
};
