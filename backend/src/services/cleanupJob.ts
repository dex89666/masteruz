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
import { withLock } from './distributedLock.js';
import { checkBackupFreshness } from './backupWatchdog.js';

const NOTIFICATIONS_TTL_DAYS = Number(process.env.NOTIFICATIONS_TTL_DAYS ?? 30);
const DELIVERY_LOG_TTL_DAYS  = Number(process.env.DELIVERY_LOG_TTL_DAYS ?? 14);
const TICK_INTERVAL_MS       = Number(process.env.CLEANUP_TICK_MS ?? 60 * 60 * 1000); // 1 час
// Заброшенные попытки оплаты: клиент открыл форму провайдера и не завершил.
// Через сутки такой платёж уже не будет оплачен — переводим в FAILED, чтобы
// он не засорял отчётность и не мешал отличать реальные проблемы от мусора.
const STALE_PAYMENT_HOURS    = Number(process.env.STALE_PAYMENT_HOURS ?? 24);

let timer: NodeJS.Timeout | null = null;

export async function runCleanupTick(): Promise<{ notifications: number; deliveryLogs: number; stalePayments: number }> {
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

  // Заброшенные попытки оплаты → FAILED.
  // ВАЖНО: трогаем только PENDING (форма открыта, но не начата). PROCESSING
  // не трогаем — там платёж уже в руках провайдера и вебхук ещё может прийти;
  // пометить его FAILED значило бы разойтись с реальным списанием у клиента.
  const paymentCutoff = new Date(Date.now() - STALE_PAYMENT_HOURS * 3_600_000);
  const stalePayments = await prisma.payment.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: paymentCutoff },
    },
    data: {
      status: 'FAILED',
      metadata: { failedReason: 'auto_timeout', autoFailedAt: new Date().toISOString() },
    },
  });

  if (notif.count > 0 || log.count > 0 || stalePayments.count > 0) {
    logger.info(
      { notifications: notif.count, deliveryLogs: log.count, stalePayments: stalePayments.count },
      'cleanup-tick: устаревшие записи обработаны',
    );
  }

  // Заодно проверяем свежесть бэкапа: часовой тик — подходящая частота,
  // а отдельный воркер ради одного запроса заводить незачем.
  // Сбой проверки не должен ронять уборку.
  await checkBackupFreshness().catch((err) =>
    logger.error({ err }, 'cleanup-tick: проверка бэкапа не удалась'),
  );

  return { notifications: notif.count, deliveryLogs: log.count, stalePayments: stalePayments.count };
}

export function startCleanupJob(): void {
  if (timer) return;
  logger.info(
    { notifTtlDays: NOTIFICATIONS_TTL_DAYS, logTtlDays: DELIVERY_LOG_TTL_DAYS, tickMs: TICK_INTERVAL_MS },
    '🧹 Cleanup job запущен',
  );

  // Первый прогон через 5 минут после старта — не мешаем boot'у.
  setTimeout(() => {
    withLock('cron:cleanup', TICK_INTERVAL_MS, runCleanupTick)
      .catch((err) => logger.error({ err }, 'cleanup-tick: первый прогон провалился'));
  }, 5 * 60_000);

  timer = setInterval(() => {
    withLock('cron:cleanup', TICK_INTERVAL_MS, runCleanupTick)
      .catch((err) => logger.error({ err }, 'cleanup-tick: ошибка'));
  }, TICK_INTERVAL_MS);
}

export function stopCleanupJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
