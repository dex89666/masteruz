// ============================================
// MasterUz — Event Bus (SSE для real-time)
// Позволяет мгновенно уведомлять участников заказа
// ============================================

import { Response } from 'express';
import { logger } from '../utils/logger.js';

interface SseClient {
  res: Response;
  userId: string;
  orderId?: string;
}

class EventBus {
  private clients: Map<string, SseClient[]> = new Map();

  /**
   * Подключить клиента к SSE-стриму заказа
   */
  addClient(orderId: string, userId: string, res: Response) {
    if (!this.clients.has(orderId)) {
      this.clients.set(orderId, []);
    }
    const list = this.clients.get(orderId)!;
    // Не дублировать одного пользователя
    const existing = list.findIndex(c => c.userId === userId);
    if (existing !== -1) {
      list.splice(existing, 1);
    }
    list.push({ res, userId, orderId });
    logger.debug({ orderId, userId }, 'SSE client connected');
  }

  /**
   * Удалить клиента при отключении
   */
  removeClient(orderId: string, userId: string) {
    const list = this.clients.get(orderId);
    if (!list) return;
    const idx = list.findIndex(c => c.userId === userId);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.clients.delete(orderId);
    }
    logger.debug({ orderId, userId }, 'SSE client disconnected');
  }

  /**
   * Отправить событие всем подключённым к заказу
   */
  emit(orderId: string, event: string, data: any) {
    const list = this.clients.get(orderId);
    if (!list || list.length === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of list) {
      try {
        client.res.write(payload);
      } catch {
        // Клиент отключился — уберём при следующем цикле
      }
    }

    logger.debug({ orderId, event, listeners: list.length }, 'SSE event emitted');
  }

  /**
   * Отправить событие конкретному пользователю (по userId, во всех заказах)
   */
  emitToUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, list] of this.clients) {
      for (const client of list) {
        if (client.userId === userId) {
          try {
            client.res.write(payload);
          } catch { /* ignore */ }
        }
      }
    }
  }

  /**
   * Количество подключённых клиентов
   */
  getStats() {
    let totalClients = 0;
    for (const [, list] of this.clients) {
      totalClients += list.length;
    }
    return { orders: this.clients.size, clients: totalClients };
  }
}

export const eventBus = new EventBus();
