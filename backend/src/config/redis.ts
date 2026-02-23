// ============================================
// MasterUz — Redis Client (Serverless-совместимый)
// Поддерживает: Upstash REST (Vercel) + ioredis (VPS) + in-memory (dev)
// ============================================

import { config } from './index.js';
import { logger } from '../utils/logger.js';

// Универсальный интерфейс Redis (расширенный для heartbeat/cache)
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string): Promise<any>;
  ping(): Promise<string>;
  // Расширения для heartbeat и кэша
  setex(key: string, seconds: number, value: string): Promise<any>;
  keys(pattern: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<number>;
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
        setex: (key, seconds, value) => upstashFetch(['SETEX', key, String(seconds), value]),
        keys: (pattern) => upstashFetch(['KEYS', pattern]),
        sadd: (key, ...members) => upstashFetch(['SADD', key, ...members]),
        smembers: (key) => upstashFetch(['SMEMBERS', key]),
        srem: (key, ...members) => upstashFetch(['SREM', key, ...members]),
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
  const sets = new Map<string, Set<string>>();

  const isExpired = (key: string): boolean => {
    const entry = store.get(key);
    if (entry?.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key);
      return true;
    }
    return false;
  };

  return {
    async get(key) {
      if (isExpired(key)) return null;
      const entry = store.get(key);
      return entry ? entry.value : null;
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
      sets.delete(key);
      return 1;
    },
    async ping() {
      return 'PONG';
    },
    async setex(key, seconds, value) {
      store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
      return 'OK';
    },
    async keys(pattern) {
      // Поддерживаем только prefix:* паттерн
      const prefix = pattern.replace(/\*$/, '');
      const result: string[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix) && !isExpired(key)) {
          result.push(key);
        }
      }
      return result;
    },
    async sadd(key, ...members) {
      if (!sets.has(key)) sets.set(key, new Set());
      let added = 0;
      for (const m of members) {
        if (!sets.get(key)!.has(m)) { sets.get(key)!.add(m); added++; }
      }
      return added;
    },
    async smembers(key) {
      return Array.from(sets.get(key) || []);
    },
    async srem(key, ...members) {
      const s = sets.get(key);
      if (!s) return 0;
      let removed = 0;
      for (const m of members) {
        if (s.delete(m)) removed++;
      }
      return removed;
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
