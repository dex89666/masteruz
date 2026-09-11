// ============================================
// MasterUz — Расписание бэкапов базы
// ============================================
// Ежечасная проверка: если с последнего успешного бэкапа прошло больше
// 23 часов — снимаем новый. Так бэкап догоняет пропуски сам: после
// перезапуска, простоя или деплоя он появится в течение часа, а не ждёт
// следующей ночи. Блокировка в Redis не даёт двум экземплярам бэкенда
// снять дамп одновременно.
// ============================================

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withLock } from './distributedLock.js';
import { getLastBackupAt } from './backupWatchdog.js';
import { runDatabaseBackup, isBackupConfigured, isPgDumpAvailable } from './databaseBackup.js';

const TICK_INTERVAL_MS = 60 * 60_000;
/** Бэкап суточный; 23 часа — чтобы время снятия не уползало вперёд. */
const BACKUP_DUE_AFTER_MS = 23 * 60 * 60_000;
const LOCK_TTL_MS = 30 * 60_000;

let timer: NodeJS.Timeout | null = null;

export function isBackupDue(lastBackupAt: Date | null, now: Date = new Date()): boolean {
  return !lastBackupAt || now.getTime() - lastBackupAt.getTime() >= BACKUP_DUE_AFTER_MS;
}

export async function runBackupTick(): Promise<void> {
  if (!isBackupDue(await getLastBackupAt())) return;

  const result = await runDatabaseBackup();
  logger.info(
    {
      key: result.key,
      sizeKb: Math.round(result.bytes / 1024),
      durationMs: result.durationMs,
      removedOld: result.removed.length,
    },
    '💾 backup: дамп базы сохранён в хранилище',
  );
}

export function startBackupJob(): void {
  if (timer) return;

  if (!config.backup.enabled) {
    logger.info('backup: выключен (BACKUP_ENABLED=false)');
    return;
  }
  if (!isBackupConfigured()) {
    logger.warn('backup: хранилище не настроено (BACKUP_S3_*) — резервное копирование не запущено');
    return;
  }
  if (!isPgDumpAvailable()) {
    logger.error('backup: pg_dump не найден в образе — резервное копирование не запущено');
    return;
  }

  const tick = () =>
    withLock('cron:db-backup', LOCK_TTL_MS, runBackupTick).catch((err) =>
      // Сбой видит и сторож бэкапов: без свежей отметки он поднимет тревогу.
      logger.error({ err: (err as Error)?.message ?? err }, 'backup: дамп не удался'),
    );

  // Первый прогон вскоре после старта: если бэкап просрочен, копия
  // появится сразу, а не через час.
  setTimeout(tick, 3 * 60_000);
  timer = setInterval(tick, TICK_INTERVAL_MS);
  logger.info({ tickMs: TICK_INTERVAL_MS }, '💾 Backup job запущен');
}

export function stopBackupJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
