// ============================================
// MasterUz — Event Bus (SSE для real-time)
// In-memory clients + Redis Pub/Sub для масштабирования на N инстансов.
// Если Redis недоступен — graceful fallback на single-node режим.
// ============================================

import { Response } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

interface SseClient {
  res: Response;
  userId: string;
  orderId?: string;
}

const REDIS_CHANNEL = 'masteruz:sse';
const NODE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

interface BroadcastEnvelope {
  nodeId: string;
  type: 'order' | 'user';
  target: string;
  event: string;
  data: any;
}

class EventBus {
  private clients: Map<string, SseClient[]> = new Map();
  private publisher: any = null;
  private subscriber: any = null;
  private redisReady = false;

  constructor() {
    this.initRedis().catch(err =>
      logger.warn({ err: err.message }, 'EventBus: Redis pub/sub недоступен, fallback на single-node')
    );
  }

  private async initRedis() {
    if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'test') return;
    try {
      const ioredisMod = await import('ioredis');
      const IoRedis: any = (ioredisMod as any).default || ioredisMod;
      this.publisher = new IoRedis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
      this.subscriber = new IoRedis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(REDIS_CHANNEL);
      this.subscriber.on('message', (_ch: string, raw: string) => {
        try {
          const env: BroadcastEnvelope = JSON.parse(raw);
          if (env.nodeId === NODE_ID) return; // не зацикливаемся
          if (env.type === 'order') this.localEmit(env.target, env.event, env.data);
          else this.localEmitToUser(env.target, env.event, env.data);
        } catch (err) {
          logger.warn({ err }, 'EventBus: malformed pub/sub message');
        }
      });
      this.redisReady = true;
      logger.info('EventBus: Redis Pub/Sub готов (multi-node SSE)');
    } catch (err) {
      this.redisReady = false;
      throw err;
    }
  }

  /** Подключить клиента к SSE-стриму заказа */
  addClient(orderId: string, userId: string, res: Response) {
    if (!this.clients.has(orderId)) this.clients.set(orderId, []);
    const list = this.clients.get(orderId)!;
    const existing = list.findIndex(c => c.userId === userId);
    if (existing !== -1) list.splice(existing, 1);
    list.push({ res, userId, orderId });
    logger.debug({ orderId, userId }, 'SSE client connected');
  }

  /** Удалить клиента при отключении */
  removeClient(orderId: string, userId: string) {
    const list = this.clients.get(orderId);
    if (!list) return;
    const idx = list.findIndex(c => c.userId === userId);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.clients.delete(orderId);
    logger.debug({ orderId, userId }, 'SSE client disconnected');
  }

  private localEmit(orderId: string, event: string, data: any) {
    const list = this.clients.get(orderId);
    if (!list || list.length === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of list) {
      try { client.res.write(payload); } catch { /* ignore */ }
    }
  }

  private localEmitToUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, list] of this.clients) {
      for (const client of list) {
        if (client.userId === userId) {
          try { client.res.write(payload); } catch { /* ignore */ }
        }
      }
    }
  }

  /** Отправить событие всем подключённым к заказу (через Redis на все инстансы) */
  emit(orderId: string, event: string, data: any) {
    this.localEmit(orderId, event, data);
    if (this.redisReady && this.publisher) {
      const envelope: BroadcastEnvelope = { nodeId: NODE_ID, type: 'order', target: orderId, event, data };
      this.publisher.publish(REDIS_CHANNEL, JSON.stringify(envelope)).catch(() => { /* ignore */ });
    }
    logger.debug({ orderId, event }, 'SSE event emitted');
  }

  /** Отправить событие конкретному пользователю */
  emitToUser(userId: string, event: string, data: any) {
    this.localEmitToUser(userId, event, data);
    if (this.redisReady && this.publisher) {
      const envelope: BroadcastEnvelope = { nodeId: NODE_ID, type: 'user', target: userId, event, data };
      this.publisher.publish(REDIS_CHANNEL, JSON.stringify(envelope)).catch(() => { /* ignore */ });
    }
  }

  getStats() {
    let totalClients = 0;
    for (const [, list] of this.clients) totalClients += list.length;
    return { orders: this.clients.size, clients: totalClients, multiNode: this.redisReady };
  }
}

export const eventBus = new EventBus();
