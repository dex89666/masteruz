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
    runAutoCancelTick().catch((err) =>
      logger.error({ err }, 'Auto-cancel: первый прогон провалился'),
    );
  }, 60_000);

  timer = setInterval(() => {
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
