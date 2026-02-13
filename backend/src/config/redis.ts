// ============================================
// MasterUz — Redis Client (Serverless-совместимый)
// Поддерживает: Upstash REST (Vercel) + ioredis (VPS) + in-memory (dev)
// ============================================

import { config } from './index.js';
import { logger } from '../utils/logger.js';

// Универсальный интерфейс Redis
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string): Promise<any>;
  ping(): Promise<string>;
}

let redis: RedisLike | null = null;

/**
 * Возвращает Redis-клиент.
 * - Vercel → Upstash REST (HTTP, без TCP-соединений)
 * - VPS/Docker → ioredis (TCP)
 * - Dev без Redis → in-memory fallback
 */
export function getRedis(): RedisLike {
  if (!redis) {
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

    if (isVercel && process.env.UPSTASH_REDIS_REST_URL) {
      // ─── Upstash REST (serverless) ───
      const baseUrl = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

      const upstashFetch = async (command: string[]): Promise<any> => {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(command),
        });
        const data = (await res.json()) as { result: any; error?: string };
        if (data.error) throw new Error(data.error);
        return data.result;
      };

      redis = {
        get: (key) => upstashFetch(['GET', key]),
        set: (key, value, ...args) => upstashFetch(['SET', key, value, ...args.map(String)]),
        del: (key) => upstashFetch(['DEL', key]),
        ping: () => upstashFetch(['PING']),
      };

      logger.info('Redis: Upstash REST mode (serverless)');
    } else if (config.redisUrl && config.redisUrl !== 'redis://localhost:6379') {
      // ─── ioredis TCP (VPS / Docker) ───
      try {
        const IoRedis = require('ioredis');
        const IoRedisClass = IoRedis.default || IoRedis;
        const client = new IoRedisClass(config.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy(times: number) {
            return Math.min(times * 50, 2000);
          },
        });

        client.on('connect', () => logger.info('Redis: ioredis TCP mode'));
        client.on('error', (err: Error) => logger.error({ err }, 'Ошибка Redis'));

        redis = client;
      } catch {
        logger.warn('ioredis недоступен — fallback на in-memory');
        redis = createInMemoryRedis();
      }
    } else {
      // ─── In-memory fallback (dev без Redis) ───
      logger.info('Redis: in-memory fallback mode');
      redis = createInMemoryRedis();
    }
  }
  return redis!;
}

function createInMemoryRedis(): RedisLike {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ...args) {
      let expiresAt: number | undefined;
      const exIdx = args.findIndex((a: any) => String(a).toUpperCase() === 'EX');
      if (exIdx !== -1 && args[exIdx + 1]) {
        expiresAt = Date.now() + Number(args[exIdx + 1]) * 1000;
      }
      store.set(key, { value, expiresAt });
      return 'OK';
    },
    async del(key) {
      store.delete(key);
      return 1;
    },
    async ping() {
      return 'PONG';
    },
  };
}

export async function closeRedis(): Promise<void> {
  if (redis && 'quit' in redis && typeof (redis as any).quit === 'function') {
    await (redis as any).quit();
  }
  redis = null;
}

export default getRedis;
