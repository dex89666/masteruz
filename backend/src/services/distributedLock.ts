// ============================================
// MasterUz — Distributed Lock
// ────────────────────────────────────────────
// Простой Redis-mutex через SET NX EX. Защищает cron-задачи от двойного
// исполнения при горизонтальном масштабе backend-инстансов.
//
// Использование:
//   await withLock('cron:cleanup', 5 * 60_000, async () => { ... });
//
// Если блокировка занята другим инстансом — функция возвращает null,
// без падений и ретраев. Lock автоматически освобождается по TTL,
// чтобы упавший процесс не оставил «вечный» замок.
// ============================================

import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const redis = getRedis();
  const lockKey = `lock:${key}`;
  const token = `${INSTANCE_ID}:${Date.now()}`;

  // ioredis: SET key value NX PX <ms>
  let acquired = false;
  try {
    const r = redis as any;
    if (typeof r.set === 'function') {
      const result = await r.set(lockKey, token, 'PX', ttlMs, 'NX');
      acquired = result === 'OK';
    } else {
      // in-memory fallback — без NX, всегда даём пройти (один инстанс по определению)
      acquired = true;
    }
  } catch (err) {
    logger.warn({ err, key }, '[lock] redis недоступен, fallback на локальный запуск');
    acquired = true;
  }

  if (!acquired) {
    logger.debug({ key }, '[lock] занят другим инстансом, пропускаем тик');
    return null;
  }

  try {
    return await fn();
  } finally {
    // Безопасное освобождение: удаляем только если значение наше.
    try {
      const r = redis as any;
      if (typeof r.eval === 'function') {
        await r.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          token
        );
      } else if (typeof r.del === 'function') {
        await r.del(lockKey);
      }
    } catch (err) {
      logger.debug({ err, key }, '[lock] не удалось освободить (отпустится по TTL)');
    }
  }
}
