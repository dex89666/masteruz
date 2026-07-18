// ============================================
// MasterUz — Сторож бэкапов
// ────────────────────────────────────────────
// Следит не за «ошибкой бэкапа», а за ТИШИНОЙ.
//
// Реальный инцидент: автобэкап в GitHub Actions падал 33 раза подряд с
// 15 июня — аккаунт был заблокирован по биллингу, workflow завершался за
// 3 секунды, и никто не узнал. База с 254 пользователями и балансами
// больше месяца жила без резервной копии.
//
// Уведомление «бэкап упал» такой сценарий не ловит: когда падает сама
// платформа запуска, некому отправить сообщение. Поэтому источник истины —
// отметка об УСПЕХЕ в БД: успешный бэкап пишет `last_backup_at`, а бэкенд
// периодически проверяет свежесть отметки. Молчание = тревога.
// ============================================

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { alertRouter } from './alertRouter.js';

/** Ключ отметки об успешном бэкапе (пишется скриптом/workflow). */
export const LAST_BACKUP_KEY = 'last_backup_at';
/** Когда последний раз предупреждали — чтобы не слать алерт каждый час. */
const LAST_WARN_KEY = 'last_backup_warn_at';

// Бэкап суточный: тревога после 36 часов тишины — сутки плюс запас на
// сдвиг расписания и время самой выгрузки.
const STALE_AFTER_H = Number(process.env.BACKUP_STALE_AFTER_HOURS ?? 36);
// Повторяем предупреждение не чаще раза в сутки: проблема чинится руками,
// ежечасный спам приучит команду игнорировать алерты.
const REWARN_AFTER_H = Number(process.env.BACKUP_REWARN_AFTER_HOURS ?? 24);

async function readTimestamp(key: string): Promise<Date | null> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  if (!row?.value) return null;
  const d = new Date(row.value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function writeTimestamp(key: string, value: Date): Promise<void> {
  await prisma.platformConfig.upsert({
    where: { key },
    update: { value: value.toISOString() },
    create: {
      key,
      value: value.toISOString(),
      description:
        key === LAST_BACKUP_KEY
          ? 'Время последнего успешного бэкапа БД (пишется скриптом бэкапа)'
          : 'Время последнего предупреждения об устаревшем бэкапе',
    },
  });
}

/** Отметить успешный бэкап. Вызывается скриптом через API/psql. */
export async function markBackupSuccess(at: Date = new Date()): Promise<void> {
  await writeTimestamp(LAST_BACKUP_KEY, at);
  logger.info({ at: at.toISOString() }, 'backup-watchdog: отметка об успешном бэкапе');
}

/**
 * Проверить свежесть бэкапа и предупредить владельцев, если он устарел.
 * Возвращает состояние — удобно для тестов и ручной диагностики.
 */
export async function checkBackupFreshness(): Promise<{
  lastBackupAt: Date | null;
  ageHours: number | null;
  stale: boolean;
  alerted: boolean;
}> {
  const lastBackupAt = await readTimestamp(LAST_BACKUP_KEY);

  const ageHours =
    lastBackupAt === null ? null : (Date.now() - lastBackupAt.getTime()) / 3_600_000;

  // Отметки нет вообще — бэкап либо ни разу не отработал, либо не умеет
  // её писать. Это тоже тревога: именно так выглядел реальный инцидент.
  const stale = ageHours === null || ageHours > STALE_AFTER_H;
  if (!stale) return { lastBackupAt, ageHours, stale: false, alerted: false };

  const lastWarnAt = await readTimestamp(LAST_WARN_KEY);
  const warnAgeH = lastWarnAt ? (Date.now() - lastWarnAt.getTime()) / 3_600_000 : Infinity;
  if (warnAgeH < REWARN_AFTER_H) {
    return { lastBackupAt, ageHours, stale: true, alerted: false };
  }

  const ageText =
    ageHours === null
      ? 'отметок об успешных бэкапах нет вообще'
      : `последний успешный бэкап был ${Math.floor(ageHours)} ч назад ` +
        `(${lastBackupAt!.toISOString().slice(0, 16).replace('T', ' ')} UTC)`;

  await alertRouter
    .dispatch({
      type: 'backup_failed',
      title: '🚨 Бэкап БД устарел',
      message:
        `${ageText}.\n\n` +
        `Порог тревоги: ${STALE_AFTER_H} ч.\n\n` +
        `Что проверить:\n` +
        `1. GitHub Actions → workflow «Daily Postgres backup» (не заблокирован ли аккаунт)\n` +
        `2. Снять копию вручную: ./scripts/backup-db.sh\n\n` +
        `База без резервной копии — риск потерять пользователей, заказы и балансы.`,
      data: { lastBackupAt: lastBackupAt?.toISOString() ?? null, ageHours, thresholdH: STALE_AFTER_H },
    })
    .catch((err) => logger.error({ err }, 'backup-watchdog: не удалось отправить алерт'));

  await writeTimestamp(LAST_WARN_KEY, new Date());
  logger.warn({ lastBackupAt, ageHours }, 'backup-watchdog: бэкап устарел, отправлено предупреждение');

  return { lastBackupAt, ageHours, stale: true, alerted: true };
}
