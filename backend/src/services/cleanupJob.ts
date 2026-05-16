// ============================================
// MasterUz — Cleanup Job
// ────────────────────────────────────────────
// Периодически удаляет устаревшие in-app уведомления и журналы доставки,
// чтобы при росте трафика (10k+ клиентов) `notifications` не раздувалась
// и лента у активного мастера не превращалась в простыню на месяцы назад.
//
// По умолчанию: notifications > 30 дней, delivery logs > 14 дней.
// Запуск: раз в час, легковесный (одиночный DELETE с индексом по created_at).
// ============================================

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

const NOTIFICATIONS_TTL_DAYS = Number(process.env.NOTIFICATIONS_TTL_DAYS ?? 30);
const DELIVERY_LOG_TTL_DAYS  = Number(process.env.DELIVERY_LOG_TTL_DAYS ?? 14);
const TICK_INTERVAL_MS       = Number(process.env.CLEANUP_TICK_MS ?? 60 * 60 * 1000); // 1 час

let timer: NodeJS.Timeout | null = null;

export async function runCleanupTick(): Promise<{ notifications: number; deliveryLogs: number }> {
  const notifCutoff = new Date(Date.now() - NOTIFICATIONS_TTL_DAYS * 86_400_000);
  const logCutoff   = new Date(Date.now() - DELIVERY_LOG_TTL_DAYS * 86_400_000);

  // Удаляем только прочитанные/устаревшие — непрочитанные оставляем нетронутыми,
  // даже если им больше 30 дней (пользователь должен сам решить).
  const notif = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: notifCutoff },
      isRead: true,
    },
  });

  const log = await prisma.notificationDeliveryLog.deleteMany({
    where: { createdAt: { lt: logCutoff } },
  });

  if (notif.count > 0 || log.count > 0) {
    logger.info(
      { notifications: notif.count, deliveryLogs: log.count },
      'cleanup-tick: устаревшие записи удалены',
    );
  }
  return { notifications: notif.count, deliveryLogs: log.count };
}

export function startCleanupJob(): void {
  if (timer) return;
  logger.info(
    { notifTtlDays: NOTIFICATIONS_TTL_DAYS, logTtlDays: DELIVERY_LOG_TTL_DAYS, tickMs: TICK_INTERVAL_MS },
    '🧹 Cleanup job запущен',
  );

  // Первый прогон через 5 минут после старта — не мешаем boot'у.
  setTimeout(() => {
    runCleanupTick().catch((err) => logger.error({ err }, 'cleanup-tick: первый прогон провалился'));
  }, 5 * 60_000);

  timer = setInterval(() => {
    runCleanupTick().catch((err) => logger.error({ err }, 'cleanup-tick: ошибка'));
  }, TICK_INTERVAL_MS);
}

export function stopCleanupJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
