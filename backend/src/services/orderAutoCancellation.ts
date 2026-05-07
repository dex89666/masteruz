// ============================================
// MasterUz — Order Auto-Cancellation Service
// Если опубликованный заказ не принят мастером в течение N часов,
// заказ автоматически отменяется и эскроу возвращается клиенту до копейки.
// ============================================

import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { moneyAdd, toNum } from '../utils/helpers.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

// Конфиг (можно переопределить через ENV)
export const AUTO_CANCEL_TIMEOUT_HOURS = Number(process.env.ORDER_AUTO_CANCEL_HOURS ?? 72);
const TICK_INTERVAL_MS = Number(process.env.ORDER_AUTO_CANCEL_TICK_MS ?? 5 * 60 * 1000); // 5 минут

/**
 * Стадии напоминаний перед авто-отменой.
 * elapsedHours — сколько часов прошло с момента создания заказа.
 * tier — индекс стадии, сохраняется в Order.remindersSent (1..N), 0 — ещё не было.
 * notifyAdmin — уведомлять админов на этой стадии.
 */
const REMINDER_TIERS: { tier: number; elapsedHours: number; notifyAdmin: boolean }[] = [
  { tier: 1, elapsedHours: AUTO_CANCEL_TIMEOUT_HOURS / 3,        notifyAdmin: false }, // 24ч
  { tier: 2, elapsedHours: (AUTO_CANCEL_TIMEOUT_HOURS * 2) / 3,  notifyAdmin: true  }, // 48ч
  { tier: 3, elapsedHours: AUTO_CANCEL_TIMEOUT_HOURS - 6,        notifyAdmin: true  }, // 66ч
];

/**
 * Автоматическая отмена одного «зависшего» заказа со 100% возвратом эскроу.
 * Идемпотентно: повторный вызов после CANCELLED — no-op.
 */
export async function autoCancelOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.status !== OrderStatus.PUBLISHED) return; // Кто-то успел принять — отбой
    if (order.masterId) return; // Мастер уже назначен — не наш случай

    const escrowAmt = toNum(order.escrowAmount);

    // 1. Помечаем заказ отменённым системой
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: 'SYSTEM',
        cancelReason: `Автоматическая отмена: за ${AUTO_CANCEL_TIMEOUT_HOURS} ч. ни один мастер не принял заказ`,
        penaltyAmount: 0,
        escrowAmount: 0,
      },
    });

    // 2. 100% возврат клиенту (если эскроу было)
    if (escrowAmt > 0) {
      const client = await tx.user.findUnique({
        where: { id: order.clientId },
        select: { balance: true },
      });
      if (client) {
        const balanceBefore = toNum(client.balance);
        const balanceAfter = moneyAdd(balanceBefore, escrowAmt);
        await tx.user.update({
          where: { id: order.clientId },
          data: { balance: balanceAfter },
        });
        await tx.balanceTransaction.create({
          data: {
            userId: order.clientId,
            type: 'REFUND',
            amount: escrowAmt,
            balanceBefore,
            balanceAfter,
            orderId,
            description: `Автовозврат: заказ отменён системой (нет откликов за ${AUTO_CANCEL_TIMEOUT_HOURS} ч.)`,
          },
        });
      }
    }
  });

  // 3. Аудит и нотификация — вне транзакции, чтобы не блокировать БД на сетевые вызовы
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, title: true, escrowAmount: true },
  });
  if (!order) return;

  await auditService.log({
    actorId: 'SYSTEM',
    action: 'order_auto_cancelled',
    entityType: 'order',
    entityId: orderId,
    details: {
      reason: 'no_master_response',
      timeoutHours: AUTO_CANCEL_TIMEOUT_HOURS,
      refundAmount: toNum(order.escrowAmount),
    },
  });

  notificationService
    .notifyClientOrderAutoCancelled(orderId)
    .catch((err: unknown) =>
      logger.error({ err, orderId }, 'notifyClientOrderAutoCancelled failed'),
    );
}

/**
 * Эскалация напоминаний по приближающейся авто-отмене.
 * Для каждой стадии находим заказы с createdAt < (now - tier.elapsedHours) и remindersSent < tier.tier,
 * атомарно поднимаем remindersSent → tier.tier и шлём уведомления:
 *   • мастерам, подписанным на категорию (повторная рассылка);
 *   • админам/менеджерам — на критических стадиях.
 *
 * Идемпотентность гарантируется условием `remindersSent: { lt: tier.tier }` в update.
 */
export async function runReminderTick(): Promise<{ remindersSent: number }> {
  const now = Date.now();
  let total = 0;

  // Идём от старшей стадии к младшей: заказ, прошедший stage 3, не должен повторно ловить stage 1
  for (const tier of [...REMINDER_TIERS].sort((a, b) => b.tier - a.tier)) {
    const cutoff = new Date(now - tier.elapsedHours * 60 * 60 * 1000);

    const candidates = await prisma.order.findMany({
      where: {
        status: OrderStatus.PUBLISHED,
        masterId: null,
        createdAt: { lt: cutoff },
        remindersSent: { lt: tier.tier },
      },
      select: { id: true },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const { id } of candidates) {
      // Атомарно «застолбим» эту стадию — если кто-то параллельно уже сделал, count будет 0
      const claim = await prisma.order.updateMany({
        where: {
          id,
          status: OrderStatus.PUBLISHED,
          masterId: null,
          remindersSent: { lt: tier.tier },
        },
        data: { remindersSent: tier.tier },
      });
      if (claim.count === 0) continue;

      const hoursLeft = Math.max(1, Math.round(AUTO_CANCEL_TIMEOUT_HOURS - tier.elapsedHours));

      // Уведомления — вне транзакции, ошибки логируем, не валим тик
      notificationService
        .remindMastersOrderExpiring(id, hoursLeft)
        .catch((err: unknown) =>
          logger.error({ err, orderId: id, tier: tier.tier }, 'remindMastersOrderExpiring failed'),
        );

      if (tier.notifyAdmin) {
        notificationService
          .notifyAdminsOrderExpiring(id, hoursLeft)
          .catch((err: unknown) =>
            logger.error({ err, orderId: id, tier: tier.tier }, 'notifyAdminsOrderExpiring failed'),
          );
      }

      total++;
    }
  }

  if (total > 0) logger.info({ total }, 'Auto-cancel: напоминания разосланы');
  return { remindersSent: total };
}

/**
 * Один проход по всем «зависшим» заказам.
 * Работает батчами по 100 — на случай большого backlog после простоя сервера.
 */
export async function runAutoCancelTick(): Promise<{ cancelled: number }> {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_TIMEOUT_HOURS * 60 * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.PUBLISHED,
      masterId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  if (stale.length === 0) return { cancelled: 0 };

  logger.info({ count: stale.length, cutoff }, 'Auto-cancel: найдены просроченные заказы');

  let cancelled = 0;
  for (const { id } of stale) {
    try {
      await autoCancelOrder(id);
      cancelled++;
    } catch (err) {
      logger.error({ err, orderId: id }, 'Auto-cancel: ошибка при отмене заказа');
    }
  }

  logger.info({ cancelled }, 'Auto-cancel: проход завершён');
  return { cancelled };
}

/**
 * Запуск фоновой задачи. Один экземпляр на процесс.
 */
let timer: NodeJS.Timeout | null = null;

export function startAutoCancellationJob(): void {
  if (timer) return;
  logger.info(
    { timeoutHours: AUTO_CANCEL_TIMEOUT_HOURS, tickMs: TICK_INTERVAL_MS },
    '🕒 Order auto-cancellation job запущен',
  );

  // Первый прогон — через минуту после старта (чтобы не мешать boot-у)
  setTimeout(() => {
    runReminderTick().catch((err) =>
      logger.error({ err }, 'Auto-cancel: reminder-tick первый прогон провалился'),
    );
    runAutoCancelTick().catch((err) =>
      logger.error({ err }, 'Auto-cancel: первый прогон провалился'),
    );
  }, 60_000);

  timer = setInterval(() => {
    runReminderTick().catch((err) =>
      logger.error({ err }, 'Auto-cancel: reminder-tick провалился'),
    );
    runAutoCancelTick().catch((err) =>
      logger.error({ err }, 'Auto-cancel: tick провалился'),
    );
  }, TICK_INTERVAL_MS);

  // Не держим event loop, если процесс хочет завершиться
  timer.unref?.();
}

export function stopAutoCancellationJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
