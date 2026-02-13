// ============================================
// MasterUz — Notification Service
// Централизованная служба уведомлений: БД + Telegram Push
// ============================================

import { prisma } from '../config/database.js';
import { sendTelegramMessage, notifyMasterOrderApproved, notifyMasterNewOrder, notifyMasterResponseAccepted } from '../utils/telegramBot.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  /**
   * Создать in-app уведомление в БД
   */
  async createNotification(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          userId: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          data: params.data ?? undefined,
        },
      });
    } catch (error) {
      logger.error({ error, params }, 'Ошибка создания уведомления');
      return null;
    }
  }

  /**
   * Уведомить мастера о назначении + оплате комиссии
   * Отправляет: данные клиента (телефон, геолокация, адрес) + что делать
   */
  async notifyMasterAssigned(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          client: { include: { profile: true } },
          master: { include: { profile: true, masterProfile: true } },
          category: true,
          orderTasks: { include: { task: true } },
        },
      });

      if (!order || !order.master || !order.client) return;

      const masterUser = await prisma.user.findUnique({
        where: { id: order.masterId! },
        select: { telegramId: true },
      });

      if (!masterUser) return;

      // In-app уведомление
      await this.createNotification({
        userId: order.masterId!,
        type: 'order_approved',
        title: '✅ Заказ одобрен — можете приступать!',
        message: `Заказ "${order.title}" одобрен. Комиссия оплачена. Контакты клиента доступны в заказе.`,
        data: {
          orderId: order.id,
          clientPhone: order.client.phone,
          address: order.address,
          street: order.street,
          city: order.city,
          district: order.district,
          region: order.region,
          latitude: order.latitude,
          longitude: order.longitude,
          isUrgent: order.isUrgent,
        },
      });

      // Telegram push-уведомление
      await notifyMasterOrderApproved({
        masterTelegramId: masterUser.telegramId,
        orderTitle: order.title,
        orderId: order.id,
        clientName: `${order.client.profile?.firstName || 'Клиент'} ${order.client.profile?.lastName || ''}`.trim(),
        clientPhone: order.client.phone,
        address: order.address,
        street: order.street,
        city: order.city,
        district: order.district,
        region: order.region,
        latitude: order.latitude,
        longitude: order.longitude,
        price: order.price,
        isUrgent: order.isUrgent,
        tasks: order.orderTasks.map((ot: any) => ot.task.name),
      });

      logger.info({ orderId, masterId: order.masterId }, 'Мастер уведомлён о назначении');
    } catch (error) {
      logger.error({ error, orderId }, 'Ошибка уведомления мастера о назначении');
    }
  }

  /**
   * Уведомить мастеров о новом заказе в их городе
   */
  async notifyMastersNewOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { category: true },
      });

      if (!order) return;

      // Находим мастеров в этом городе или со специализацией в этой категории
      const masterWhere: any = {
        role: 'MASTER',
        isActive: true,
        masterProfile: {
          isAvailable: true,
        },
      };

      if (order.city) {
        masterWhere.profile = { city: order.city };
      }

      const masters = await prisma.user.findMany({
        where: masterWhere,
        select: {
          id: true,
          telegramId: true,
        },
        take: 50, // Ограничиваем количество рассылок
      });

      for (const master of masters) {
        // In-app уведомление
        await this.createNotification({
          userId: master.id,
          type: 'new_order',
          title: order.isUrgent ? '🚨 Новый срочный заказ!' : '🆕 Новый заказ!',
          message: `${order.title} — ${order.price.toLocaleString('ru')} сум${order.city ? ` • ${order.city}` : ''}${order.district ? `, ${order.district}` : ''}`,
          data: {
            orderId: order.id,
            city: order.city,
            district: order.district,
            isUrgent: order.isUrgent,
          },
        });

        // Telegram push
        await notifyMasterNewOrder({
          masterTelegramId: master.telegramId,
          orderTitle: order.title,
          orderId: order.id,
          city: order.city,
          district: order.district,
          region: order.region,
          price: order.price,
          isUrgent: order.isUrgent,
          categoryName: order.category?.name || '',
        });
      }

      logger.info({ orderId, mastersNotified: masters.length }, 'Мастера уведомлены о новом заказе');
    } catch (error) {
      logger.error({ error, orderId }, 'Ошибка уведомления мастеров о новом заказе');
    }
  }

  /**
   * Уведомить мастера, что его отклик выбран
   */
  async notifyMasterResponseAccepted(orderId: string, masterId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { title: true, price: true, id: true },
      });

      const masterUser = await prisma.user.findUnique({
        where: { id: masterId },
        select: { telegramId: true },
      });

      if (!order || !masterUser) return;

      // In-app
      await this.createNotification({
        userId: masterId,
        type: 'response_accepted',
        title: '🎉 Ваш отклик выбран!',
        message: `Клиент выбрал вас для заказа "${order.title}". Оплатите комиссию, чтобы получить контакты клиента.`,
        data: { orderId },
      });

      // Telegram
      await notifyMasterResponseAccepted({
        masterTelegramId: masterUser.telegramId,
        orderTitle: order.title,
        orderId: order.id,
        price: order.price,
      });
    } catch (error) {
      logger.error({ error, orderId, masterId }, 'Ошибка уведомления о принятии отклика');
    }
  }
}

export const notificationService = new NotificationService();
