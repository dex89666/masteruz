// ============================================
// MasterUz — Notification Service
// Централизованная служба уведомлений: БД + Telegram Push
// ============================================

import { prisma } from '../config/database.js';
import { sendTelegramMessage, notifyMasterOrderApproved, notifyMasterNewOrder, notifyMasterResponseAccepted } from '../utils/telegramBot.js';
import { logger } from '../utils/logger.js';
import { toNum, calculateDistance } from '../utils/helpers.js';

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
        price: toNum(order.price),
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
   * PERFORMANCE: Promise.allSettled вместо sequential for...of
   */
  async notifyMastersNewOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { category: true },
      });

      if (!order) return;

      const orderHasGeo = order.latitude && order.longitude;

      // Находим мастеров — с геолокацией для гео-подбора
      const masterWhere: any = {
        role: 'MASTER',
        isActive: true,
        masterProfile: {
          isAvailable: true,
        },
      };

      // Если у заказа нет координат — ищем по городу
      if (!orderHasGeo && order.city) {
        masterWhere.profile = { city: order.city };
      }

      const masters = await prisma.user.findMany({
        where: masterWhere,
        select: {
          id: true,
          telegramId: true,
          profile: { select: { latitude: true, longitude: true, city: true } },
          masterProfile: { select: { maxDistanceKm: true } },
        },
        take: 200,
      });

      // Гео-фильтрация: если у заказа есть координаты — считаем расстояние
      // и отправляем только мастерам в пределах их maxDistanceKm (или 30 км по умолчанию)
      const mastersWithDistance = masters.map((m) => {
        let distance: number | null = null;
        if (orderHasGeo && m.profile?.latitude && m.profile?.longitude) {
          distance = Math.round(
            calculateDistance(order.latitude!, order.longitude!, m.profile.latitude, m.profile.longitude) * 10
          ) / 10;
        }
        return { ...m, distance };
      });

      // Фильтруем: если есть гео — только ближайшие; иначе — все по городу (до 50)
      const filteredMasters = orderHasGeo
        ? mastersWithDistance
            .filter((m) => {
              if (m.distance === null) {
                // У мастера нет координат — проверяем город
                return m.profile?.city === order.city;
              }
              const maxKm = m.masterProfile?.maxDistanceKm || 30;
              return m.distance <= maxKm;
            })
            .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
            .slice(0, 50)
        : mastersWithDistance.slice(0, 50);

      // ─── Параллельная рассылка (Promise.allSettled) ───
      const results = await Promise.allSettled(
        filteredMasters.map(async (master) => {
          const distLabel = master.distance !== null ? ` • ${master.distance} км от вас` : '';

          // In-app уведомление
          await this.createNotification({
            userId: master.id,
            type: 'new_order',
            title: order.isUrgent ? '🚨 Новый срочный заказ!' : '🆕 Новый заказ!',
            message: `${order.title} — ${toNum(order.price).toLocaleString('ru')} сум${order.city ? ` • ${order.city}` : ''}${order.district ? `, ${order.district}` : ''}${distLabel}`,
            data: {
              orderId: order.id,
              city: order.city,
              district: order.district,
              isUrgent: order.isUrgent,
              distance: master.distance,
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
            price: toNum(order.price),
            isUrgent: order.isUrgent,
            categoryName: order.category?.name || '',
            distance: master.distance,
          });
        })
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn({ orderId, failedCount: failed.length, totalCount: filteredMasters.length }, 'Некоторые уведомления не доставлены');
      }

      logger.info({ orderId, mastersNotified: filteredMasters.length - failed.length, totalMasters: filteredMasters.length }, 'Мастера уведомлены о новом заказе (гео-подбор)');
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
        price: toNum(order.price),
      });
    } catch (error) {
      logger.error({ error, orderId, masterId }, 'Ошибка уведомления о принятии отклика');
    }
  }
}

export const notificationService = new NotificationService();
