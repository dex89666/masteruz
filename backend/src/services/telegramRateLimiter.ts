// ============================================
// MasterUz — Telegram Outbound Rate Limiter
// ────────────────────────────────────────────
// Telegram Bot API: 30 сообщений/сек глобально на бота.
// При превышении — бан на минуты, иногда часы.
//
// Реализация: фиксированное окно в 1 секунду на ключ "tg:out:<unix-sec>".
// INCR + EXPIRE даёт нам атомарный счётчик; если он превышает лимит,
// откладываем отправку до начала следующей секунды.
//
// Multi-node safe (Redis = единый счётчик). При недоступности Redis
// делаем fail-open — лучше отправить и поймать 429, чем заблокировать
// поток уведомлений.
// ============================================

import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

/** Безопасный лимит ниже официальных 30 — оставляем запас на пики. */
const TELEGRAM_RPS_LIMIT = Number(process.env.TELEGRAM_OUTBOUND_RPS ?? 25);
/** Сколько раз ждать следующую секунду, прежде чем сдаться. */
const MAX_WAIT_ITERATIONS = 60;

/**
 * Ждать «слот» в текущей секунде. Возвращает true, если можно слать.
 * Никогда не бросает — при ошибке Redis возвращает true (fail-open).
 */
export async function acquireTelegramSlot(): Promise<boolean> {
  const redis = getRedis();

  for (let i = 0; i < MAX_WAIT_ITERATIONS; i++) {
    const sec = Math.floor(Date.now() / 1000);
    const key = `tg:out:${sec}`;

    try {
      // INCR на in-memory redis вернёт NaN — используем set+get как fallback.
      const incr = (redis as any).incr?.bind(redis) as ((k: string) => Promise<number>) | undefined;
      let count: number;
      if (typeof incr === 'function') {
        count = await incr(key);
        // EXPIRE один раз за окно (не критично, если выполнится несколько раз)
        if (count === 1) {
          const expire = (redis as any).expire?.bind(redis) as ((k: string, s: number) => Promise<number>) | undefined;
          if (typeof expire === 'function') await expire(key, 2).catch(() => {});
        }
      } else {
        // Fallback для in-memory клиента
        const raw = await redis.get(key);
        count = Number(raw ?? 0) + 1;
        await redis.setex(key, 2, String(count));
      }

      if (count <= TELEGRAM_RPS_LIMIT) return true;
    } catch (err) {
      logger.warn({ err }, 'telegramRateLimiter: redis недоступен — fail-open');
      return true;
    }

    // Ждём до начала следующей секунды (+малый jitter)
    const nowMs = Date.now();
    const waitMs = 1000 - (nowMs % 1000) + Math.floor(Math.random() * 50);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  logger.error('telegramRateLimiter: не удалось получить слот за лимит итераций — пропускаем сообщение');
  return false;
}
