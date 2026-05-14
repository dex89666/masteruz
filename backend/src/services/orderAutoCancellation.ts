// ============================================
// MasterUz — Order Reminder Service
// Опубликованные заказы НЕ сгорают автоматически.
// Раз в N часов рассылаем подходящим мастерам (по категории + локации)
// повторное уведомление, пока заказ не принят клиентом/мастером.
// ============================================

import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { moneyAdd, toNum } from '../utils/helpers.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

// Конфиг (можно переопределить через ENV)
/** Интервал между повторными рассылками подходящим мастерам, часы */
export const REMIND_EVERY_HOURS = Number(process.env.ORDER_REMIND_EVERY_HOURS ?? 3);
/** Жёсткий предел повторов, чтобы счётчик не рос бесконечно */
const MAX_REMINDERS = Number(process.env.ORDER_MAX_REMINDERS ?? 50);
const TICK_INTERVAL_MS = Number(process.env.ORDER_AUTO_CANCEL_TICK_MS ?? 5 * 60 * 1000); // 5 минут

/**
 * Ручная отмена одного заказа со 100% возвратом эскроу.
 * Оставлено для админских сценариев (например, кнопка «Закрыть зависший заказ»).
 * В автоматическом тике больше НЕ вызывается — заказ живёт пока клиент не отменит сам.
 * Идемпотентно: повторный вызов после CANCELLED — no-op.
 */
export async function autoCancelOrder(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.status !== OrderStatus.PUBLISHED) return;
    if (order.masterId) return;

    const escrowAmt = toNum(order.escrowAmount);

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: 'SYSTEM',
        cancelReason: 'Закрыто администратором: заказ не был принят мастером',
        penaltyAmount: 0,
        escrowAmount: 0,
      },
    });

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
            description: 'Возврат: заказ закрыт администратором (не был принят мастером)',
          },
        });
      }
    }
  });

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
      reason: 'admin_close_no_master_response',
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
 * Один проход повторных рассылок.
 * Для каждого опубликованного заказа без мастера считаем, сколько «окон»
 * по REMIND_EVERY_HOURS часов уже прошло с момента создания. Если это число
 * больше счётчика `remindersSent` — атомарно поднимаем счётчик на 1
 * и шлём свежую волну уведомлений подходящим мастерам (категория + город).
 *
 * Атомарность гарантируется условием `remindersSent: { lt: nextCount }` в update.
 */
export async function runReminderTick(): Promise<{ remindersSent: number }> {
  const now = Date.now();
  const windowMs = REMIND_EVERY_HOURS * 60 * 60 * 1000;
  const oldestCutoff = new Date(now - windowMs);

  // Берём заказы, у которых прошло хотя бы одно «окно» с момента создания.
  // Сортируем по «давности» — чем старше заказ, тем выше приоритет.
  const candidates = await prisma.order.findMany({
    where: {
      status: OrderStatus.PUBLISHED,
      masterId: null,
      createdAt: { lt: oldestCutoff },
      remindersSent: { lt: MAX_REMINDERS },
    },
    select: { id: true, createdAt: true, remindersSent: true },
    take: 200,
    orderBy: { createdAt: 'asc' },
  });

  let total = 0;

  for (const order of candidates) {
    const elapsedMs = now - order.createdAt.getTime();
    const expectedCount = Math.floor(elapsedMs / windowMs);
    if (expectedCount <= order.remindersSent) continue;

    const nextCount = order.remindersSent + 1;

    // Атомарно «застолбим» следующий пинг
    const claim = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: OrderStatus.PUBLISHED,
        masterId: null,
        remindersSent: { lt: nextCount },
      },
      data: { remindersSent: nextCount },
    });
    if (claim.count === 0) continue;

    // Повторно шлём подходящим мастерам полноценное уведомление о новом заказе:
    // ту же воронку, что и при публикации (категория + гео + город, ранжирование, волны).
    notificationService
      .notifyMastersNewOrder(order.id)
      .catch((err: unknown) =>
        logger.error(
          { err, orderId: order.id, pingNumber: nextCount },
          'reminder: notifyMastersNewOrder failed',
        ),
      );

    total++;
  }

  if (total > 0) {
    logger.info(
      { total, everyHours: REMIND_EVERY_HOURS },
      'reminder-tick: повторные уведомления разосланы',
    );
  }
  return { remindersSent: total };
}

/**
 * Запуск фоновой задачи. Один экземпляр на процесс.
 * Авто-отмена заказов отключена — заказ живёт, пока клиент не отменит его сам.
 */
let timer: NodeJS.Timeout | null = null;

export function startAutoCancellationJob(): void {
  if (timer) return;
  logger.info(
    { remindEveryHours: REMIND_EVERY_HOURS, tickMs: TICK_INTERVAL_MS },
    '🔔 Order reminder job запущен (auto-cancel отключён)',
  );

  // Первый прогон — через минуту после старта (чтобы не мешать boot-у)
  setTimeout(() => {
    runReminderTick().catch((err) =>
      logger.error({ err }, 'reminder-tick: первый прогон провалился'),
    );
  }, 60_000);

  timer = setInterval(() => {
    runReminderTick().catch((err) =>
      logger.error({ err }, 'reminder-tick: провалился'),
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
