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

// ════════════════════════════════════════════════════════════════════════════
// Итерация 4: Композитный Fraud Detection Agent
// ════════════════════════════════════════════════════════════════════════════
//
// scanUser(userId) — прогоняет набор детекторов и возвращает fraud-скор 0..100
// с разбивкой по сигналам. Каждый сработавший сигнал автоматически пишется
// в AuditLog как FRAUD_SIGNAL (если ещё не было такого же недавно).
//
// Веса подобраны так, чтобы:
//   • один слабый сигнал (например, новый аккаунт) не давал >20
//   • явное «самосозвон» (один телефон у клиента и мастера) сразу ≥40
//   • два-три сигнала складывались в «high» (≥60)
//
// Бэнды для UI:
//   clean       ≤ 20
//   suspicious  ≤ 49
//   high        ≤ 79
//   critical    ≥ 80
// ════════════════════════════════════════════════════════════════════════════

export type FraudBand = 'clean' | 'suspicious' | 'high' | 'critical';

export interface FraudSignalHit {
  signal: string;
  weight: number;
  evidence: Record<string, unknown>;
}

export interface FraudReport {
  userId: string;
  role: string | null;
  score: number;        // 0..100
  band: FraudBand;
  signals: FraudSignalHit[];
  scannedAt: Date;
}

const SCAN_WINDOW_DAYS = 30;
const SELF_DEAL_LOOKBACK_DAYS = 180;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function bandOf(score: number): FraudBand {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 21) return 'suspicious';
  return 'clean';
}

/**
 * Детектор: новый аккаунт + крупная активность.
 * Регистрация <24 ч назад, при этом уже создал заказ либо
 * выставил/принял предложение.
 */
async function detectNewAccountSpike(userId: string): Promise<FraudSignalHit | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, role: true },
  });
  if (!user) return null;

  const ageHours = (Date.now() - user.createdAt.getTime()) / 3_600_000;
  if (ageHours > 24) return null;

  const ordersCount = await prisma.order.count({
    where: user.role === 'MASTER' ? { masterId: userId } : { clientId: userId },
  });
  if (ordersCount === 0) return null;

  return {
    signal: 'new_account_spike',
    weight: 10,
    evidence: { ageHours: Math.round(ageHours * 10) / 10, ordersCount },
  };
}

/**
 * Детектор: «самосозвон» — клиент и мастер делят телефон или telegramId.
 * Это явный признак, что один человек создал два аккаунта и сам себе платит,
 * чтобы прокачать рейтинг / отзывы.
 */
async function detectSelfDealing(userId: string): Promise<FraudSignalHit | null> {
  const since = new Date(Date.now() - SELF_DEAL_LOOKBACK_DAYS * 86_400_000);
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, telegramId: true, role: true },
  });
  if (!me) return null;

  const orders = await prisma.order.findMany({
    where: {
      AND: [
        { createdAt: { gte: since } },
        { masterId: { not: null } },
        { OR: [{ clientId: userId }, { masterId: userId }] },
      ],
    },
    select: {
      id: true,
      client: { select: { id: true, phone: true, telegramId: true } },
      master: { select: { id: true, phone: true, telegramId: true } },
    },
  });

  const collisions: Array<{ orderId: string; field: 'phone' | 'telegramId' }> = [];
  for (const o of orders) {
    if (!o.master || !o.client || o.client.id === o.master.id) continue;
    if (me.phone && o.client.phone === o.master.phone) {
      collisions.push({ orderId: o.id, field: 'phone' });
    }
    if (o.client.telegramId === o.master.telegramId) {
      collisions.push({ orderId: o.id, field: 'telegramId' });
    }
  }

  if (collisions.length === 0) return null;
  return {
    signal: 'self_dealing',
    weight: 40,
    evidence: { collisions: collisions.slice(0, 5), totalCollisions: collisions.length },
  };
}

/**
 * Детектор для мастера: частые отмены ПОСЛЕ ACCEPTED.
 * Признак: мастер берёт заказ, чтобы получить контакт, и сразу отменяет.
 */
async function detectMasterRapidCancel(userId: string): Promise<FraudSignalHit | null> {
  const since = new Date(Date.now() - SCAN_WINDOW_DAYS * 86_400_000);
  const cancelled = await prisma.order.count({
    where: {
      masterId: userId,
      status: 'CANCELLED',
      cancelledBy: 'MASTER',
      acceptedAt: { not: null },
      createdAt: { gte: since },
    },
  });
  if (cancelled < 3) return null;

  return {
    signal: 'master_rapid_cancel',
    weight: clamp(cancelled * 5, 15, 25),
    evidence: { cancelledAfterAcceptCount: cancelled, windowDays: SCAN_WINDOW_DAYS },
  };
}

/**
 * Детектор: история нарушений в чате (накопленные FRAUD_SIGNAL/contact_leak).
 */
async function detectChatLeakHistory(userId: string): Promise<FraudSignalHit | null> {
  const since = new Date(Date.now() - SCAN_WINDOW_DAYS * 86_400_000);
  const count = await prisma.auditLog.count({
    where: {
      actorId: userId,
      action: 'FRAUD_SIGNAL',
      createdAt: { gte: since },
      details: { path: ['signal'], equals: 'contact_leak' },
    },
  });
  if (count === 0) return null;
  return {
    signal: 'chat_leak_history',
    weight: clamp(count * 5, 5, 25),
    evidence: { contactLeakCount: count, windowDays: SCAN_WINDOW_DAYS },
  };
}

/**
 * Адаптер для существующего детектора отмен клиента.
 */
async function detectClientCancelAfterContact(userId: string): Promise<FraudSignalHit | null> {
  const r = await checkCancelAfterContactPattern(userId);
  if (!r.suspicious) return null;
  return {
    signal: 'client_cancel_after_contact',
    weight: clamp(r.cancelledAfterAccept * 5, 15, 25),
    evidence: { cancelledAfterAccept: r.cancelledAfterAccept, windowDays: r.windowDays },
  };
}

/**
 * Главная точка входа: запустить все детекторы и вернуть отчёт.
 * Параллельно пишет каждый сработавший сигнал в AuditLog (dedup: не чаще раза в час).
 */
export async function scanUser(userId: string): Promise<FraudReport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const detectors: Array<Promise<FraudSignalHit | null>> = [
    detectNewAccountSpike(userId),
    detectSelfDealing(userId),
    detectChatLeakHistory(userId),
  ];

  if (user?.role === 'CLIENT') {
    detectors.push(detectClientCancelAfterContact(userId));
  }
  if (user?.role === 'MASTER') {
    detectors.push(detectMasterRapidCancel(userId));
  }

  const settled = await Promise.allSettled(detectors);
  const signals: FraudSignalHit[] = settled
    .filter((s): s is PromiseFulfilledResult<FraudSignalHit | null> => s.status === 'fulfilled')
    .map((s) => s.value)
    .filter((s): s is FraudSignalHit => s !== null);

  const score = clamp(
    signals.reduce((sum, s) => sum + s.weight, 0),
    0,
    100,
  );
  const band = bandOf(score);

  // Запись в AuditLog только для significant сигналов (>=15) и с дедупом
  const significant = signals.filter((s) => s.weight >= 15);
  await Promise.all(significant.map((s) => recordSignalIfFresh(userId, s)));

  return {
    userId,
    role: user?.role ?? null,
    score,
    band,
    signals,
    scannedAt: new Date(),
  };
}

/** Записать сигнал, если такого же не было за последний час. */
async function recordSignalIfFresh(userId: string, hit: FraudSignalHit): Promise<void> {
  const recent = await prisma.auditLog.findFirst({
    where: {
      actorId: userId,
      action: 'FRAUD_SIGNAL',
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
      details: { path: ['signal'], equals: hit.signal },
    },
    select: { id: true },
  });
  if (recent) return;

  await recordFraudSignal({
    userId,
    signal: hit.signal,
    context: { weight: hit.weight, ...hit.evidence },
  });
}

/**
 * Безопасный фоновый запуск: используется как триггер из других сервисов.
 * Никогда не пробрасывает исключения наружу.
 */
export async function safeScanUser(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await scanUser(userId);
  } catch (err) {
    logger.error({ err, userId }, 'safeScanUser: ошибка');
  }
}

