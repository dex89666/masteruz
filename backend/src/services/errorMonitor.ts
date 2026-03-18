// ============================================
// MasterUz — Error Monitor (Lightweight Sentry-like)
// Алерты в Telegram при 500-ошибках с дедупликацией через Redis
// ============================================

import crypto from 'crypto';
import { config } from '../config/index.js';
import { getRedis } from '../config/redis.js';
import { sendTelegramMessage } from '../utils/telegramBot.js';
import { logger } from '../utils/logger.js';

const THROTTLE_SECONDS = 300; // 5 минут дедупликации одинаковых ошибок
const REDIS_PREFIX = 'err_alert:';

interface ErrorReport {
  error: Error;
  method?: string;
  url?: string;
  userId?: string;
}

function getErrorFingerprint(err: Error): string {
  const key = `${err.name}:${err.message}:${(err.stack || '').split('\n')[1] || ''}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function formatAlert(report: ErrorReport): string {
  const time = new Date().toISOString();
  const method = report.method || '—';
  const url = report.url || '—';
  const user = report.userId || 'anonymous';
  const stack = (report.error.stack || '').split('\n').slice(0, 4).join('\n');

  return [
    '🚨 <b>500 Error — MasterUz</b>',
    '',
    `<b>Time:</b> ${time}`,
    `<b>Method:</b> ${method}`,
    `<b>URL:</b> ${url}`,
    `<b>User:</b> ${user}`,
    `<b>Error:</b> ${report.error.message}`,
    '',
    `<pre>${stack}</pre>`,
  ].join('\n');
}

/**
 * Сообщает о критической ошибке (500) — Telegram-алерт с дедупликацией.
 * fire-and-forget: никогда не бросает исключение, не влияет на основной flow.
 */
export async function reportError(report: ErrorReport): Promise<void> {
  try {
    const adminChatId = config.telegram.adminChatId;
    if (!adminChatId || config.env === 'development') return;

    const fingerprint = getErrorFingerprint(report.error);
    const redisKey = `${REDIS_PREFIX}${fingerprint}`;

    // Дедупликация: если уже отправляли алерт за последние 5 мин — пропускаем
    const redis = getRedis();
    const existing = await redis.get(redisKey);
    if (existing) return;

    await redis.setex(redisKey, THROTTLE_SECONDS, '1');

    const text = formatAlert(report);
    await sendTelegramMessage({ chatId: adminChatId, text, parseMode: 'HTML' });
  } catch (monitorErr) {
    // Мониторинг никогда не должен ломать основной поток
    logger.warn({ err: monitorErr }, 'errorMonitor: не удалось отправить алерт');
  }
}
