import { prisma } from '../config/database';
import logger from '../utils/logger';

/**
 * Эвристики обнаружения попыток обхода платформы.
 *
 * Сигналы — мягкие: ничего не блокируют автоматически, но накапливают
 * fraud-score в AuditLog. Админ видит подозрительные аккаунты в панели
 * и принимает решение вручную (штраф / блокировка / запрос объяснений).
 */

/** Минимальный порог для срабатывания эвристики «отказы после контакта». */
const CANCEL_AFTER_CONTACT_THRESHOLD = 3;
/** Окно наблюдения в днях. */
const OBSERVATION_WINDOW_DAYS = 30;

/**
 * Сигнал 1: клиент часто отменяет заказы после того,
 * как мастер был назначен (= получил контакт), но до начала работ.
 * Подозрение — увод через прямой контакт.
 */
export async function checkCancelAfterContactPattern(clientId: string): Promise<{
  suspicious: boolean;
  cancelledAfterAccept: number;
  windowDays: number;
}> {
  const since = new Date(Date.now() - OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const cancelledAfterAccept = await prisma.order.count({
    where: {
      clientId,
      createdAt: { gte: since },
      acceptedAt: { not: null },
      status: 'CANCELLED',
    },
  });

  const suspicious = cancelledAfterAccept >= CANCEL_AFTER_CONTACT_THRESHOLD;
  if (suspicious) {
    logger.warn(
      { clientId, cancelledAfterAccept, windowDays: OBSERVATION_WINDOW_DAYS },
      'Anti-fraud: клиент часто отменяет после назначения мастера'
    );
  }
  return { suspicious, cancelledAfterAccept, windowDays: OBSERVATION_WINDOW_DAYS };
}

/**
 * Сигнал 2: пара клиент↔мастер встречалась на нескольких заказах, но второй и
 * последующие заказы внезапно отменяются после ACCEPTED — возможно, продолжают
 * работать напрямую.
 */
export async function checkRepeatPairCancelPattern(
  clientId: string,
  masterId: string
): Promise<{ suspicious: boolean; total: number; cancelledAfterAccept: number }> {
  const orders = await prisma.order.findMany({
    where: { clientId, masterId },
    select: { status: true, acceptedAt: true },
  });

  const total = orders.length;
  const cancelledAfterAccept = orders.filter(
    (o) => o.status === 'CANCELLED' && o.acceptedAt !== null
  ).length;

  const suspicious = total >= 2 && cancelledAfterAccept >= 2;
  if (suspicious) {
    logger.warn(
      { clientId, masterId, total, cancelledAfterAccept },
      'Anti-fraud: повторная пара с частыми отменами после назначения'
    );
  }
  return { suspicious, total, cancelledAfterAccept };
}

/**
 * Сигнал 3: в чате заказа упоминаются телефонные номера или мессенджеры
 * до того, как мастер физически приступил к работе.
 * Проверяет переданный текст сообщения.
 */
const CONTACT_PATTERNS = [
  /(?:\+?9?9?8\s?\(?\d{2}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2})/, // узбекский номер
  /\b\d{9,12}\b/,                                            // длинная числовая последовательность
  /(?:telegram|телеграм|whatsapp|вотсап|ватсап|viber|вайбер)/i,
  /\b@[a-zA-Z0-9_]{4,}\b/,                                   // @username
  /(?:оплата\s+налич|без\s+комисс|мимо\s+платформ|вне\s+платформ|напрямую)/i,
];

export function detectContactExchangeInMessage(text: string): {
  detected: boolean;
  matchedPattern: string | null;
} {
  if (!text) return { detected: false, matchedPattern: null };
  for (const re of CONTACT_PATTERNS) {
    if (re.test(text)) {
      return { detected: true, matchedPattern: re.source };
    }
  }
  return { detected: false, matchedPattern: null };
}

/**
 * Зафиксировать подозрительное событие в аудит-логе.
 * Не блокирует пользователя, но даёт админу основание для разбирательства.
 */
export async function recordFraudSignal(params: {
  userId: string;
  signal: string;
  context: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.userId,
        action: 'FRAUD_SIGNAL',
        entityType: 'User',
        entityId: params.userId,
        details: {
          signal: params.signal,
          ...params.context,
        } as any,
      },
    });
  } catch (err) {
    logger.error({ err, ...params }, 'Anti-fraud: не удалось записать сигнал в аудит');
  }
}
