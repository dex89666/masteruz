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

      if (!order) {
        logger.warn({ orderId }, 'notifyMastersNewOrder: заказ не найден');
        return;
      }

      const orderHasGeo = !!(order.latitude && order.longitude);

      // Находим активных мастеров, у которых есть категория этого заказа
      const masters = await prisma.user.findMany({
        where: {
          role: 'MASTER',
          isActive: true,
          masterProfile: {
            isAvailable: true,
            masterCategories: {
              some: {
                categoryId: order.categoryId,
              },
            },
          },
        },
        select: {
          id: true,
          telegramId: true,
          profile: { select: { latitude: true, longitude: true, city: true } },
          masterProfile: { select: { maxDistanceKm: true } },
        },
        take: 200,
      });

      logger.info({ orderId, totalMasters: masters.length, orderHasGeo, orderCity: order.city }, 'notifyMastersNewOrder: найдено мастеров');

      if (masters.length === 0) {
        logger.warn({ orderId }, 'notifyMastersNewOrder: нет активных мастеров');
        return;
      }

      // Считаем расстояние если у заказа есть координаты
      const mastersWithDistance = masters.map((m) => {
        let distance: number | null = null;
        if (orderHasGeo && m.profile?.latitude && m.profile?.longitude) {
          distance = Math.round(
            calculateDistance(order.latitude!, order.longitude!, m.profile.latitude, m.profile.longitude) * 10
          ) / 10;
        }
        return { ...m, distance };
      });

      // Фильтрация:
      // 1) Если у заказа есть гео — приоритет ближайшим, но город-фолбэк тоже
      // 2) Если у заказа есть город (без гео) — по городу
      // 3) Если ни гео ни города — отправляем ВСЕМ (до 50)
      let filteredMasters;
      if (orderHasGeo) {
        filteredMasters = mastersWithDistance
          .filter((m) => {
            if (m.distance !== null) {
              const maxKm = m.masterProfile?.maxDistanceKm || 30;
              return m.distance <= maxKm;
            }
            // У мастера нет координат — фолбэк на город
            return !order.city || m.profile?.city === order.city;
          })
          .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
          .slice(0, 50);
      } else if (order.city) {
        filteredMasters = mastersWithDistance
          .filter((m) => m.profile?.city === order.city)
          .slice(0, 50);
      } else {
        // Нет ни гео ни города — отправляем всем
        filteredMasters = mastersWithDistance.slice(0, 50);
      }

      logger.info({ orderId, filteredCount: filteredMasters.length }, 'notifyMastersNewOrder: после фильтрации');

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

  /**
   * Уведомить клиента, что его заказ авто-отменён системой (никто не принял за 72ч)
   * и средства возвращены на баланс.
   */
  async notifyClientOrderAutoCancelled(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });
      if (!order) return;

      const refund = toNum(order.escrowAmount); // в БД уже 0, но нам нужна сумма для текста
      // Пересчитаем по последней транзакции REFUND, если поле уже обнулено
      const lastRefund = await prisma.balanceTransaction.findFirst({
        where: { orderId, type: 'REFUND' },
        orderBy: { createdAt: 'desc' },
        select: { amount: true },
      });
      const refundAmount = lastRefund ? toNum(lastRefund.amount) : refund;

      await this.createNotification({
        userId: order.clientId,
        type: 'order_auto_cancelled',
        title: '⏱ Заказ отменён — средства возвращены',
        message:
          `К сожалению, ни один мастер не принял ваш заказ "${order.title}" за 72 часа. ` +
          `Заказ автоматически отменён, ${refundAmount.toLocaleString('ru')} сум возвращены на баланс.`,
        data: { orderId, refundAmount },
      });

      if (order.client?.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text:
            `⏱ <b>Заказ отменён</b>\n\n` +
            `Ваш заказ <b>"${order.title}"</b> не был принят ни одним мастером в течение 72 часов.\n` +
            `Заказ автоматически отменён, <b>${refundAmount.toLocaleString('ru')} сум</b> возвращены на ваш баланс.\n\n` +
            `Попробуйте создать заказ повторно — возможно, стоит уточнить описание или изменить сумму.`,
        });
      }
    } catch (error) {
      logger.error({ error, orderId }, 'notifyClientOrderAutoCancelled failed');
    }
  }

  /**
   * Повторная рассылка мастерам, подписанным на категорию заказа,
   * по мере приближения авто-отмены. Эскалация по тонам сообщений.
   */
  async remindMastersOrderExpiring(orderId: string, hoursLeft: number) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { category: true },
      });
      if (!order || order.masterId) return;

      const masters = await prisma.user.findMany({
        where: {
          role: 'MASTER',
          isActive: true,
          masterProfile: {
            isAvailable: true,
            masterCategories: { some: { categoryId: order.categoryId } },
          },
        },
        select: { id: true, telegramId: true, profile: { select: { city: true } } },
        take: 200,
      });

      const filtered = order.city
        ? masters.filter((m) => !m.profile?.city || m.profile.city === order.city)
        : masters;

      const targets = filtered.slice(0, 100);

      const isUrgent = hoursLeft <= 12;
      const tone = isUrgent ? '🔥 Последний шанс' : '⏳ Заказ скоро сгорит';
      const titleAlert = `${tone} — осталось ${hoursLeft}ч`;
      const priceLabel = `${toNum(order.price).toLocaleString('ru')} сум`;
      const cityLabel = order.city ? ` • ${order.city}` : '';

      await Promise.allSettled(
        targets.map(async (master) => {
          await this.createNotification({
            userId: master.id,
            type: 'order_expiring',
            title: titleAlert,
            message: `${order.title} — ${priceLabel}${cityLabel}. До авто-отмены: ${hoursLeft}ч`,
            data: { orderId, hoursLeft, isUrgent },
          });
          if (master.telegramId) {
            const text =
              `${tone} — <b>${hoursLeft} ч.</b>\n\n` +
              `<b>${order.title}</b>\n` +
              `💰 ${priceLabel}${cityLabel}\n` +
              `📂 ${order.category?.name || ''}\n\n` +
              `Если не примете в ближайшее время — заказ закроется автоматически и уйдёт другим.`;
            await sendTelegramMessage({ chatId: master.telegramId, text }).catch(() => {});
          }
        }),
      );

      logger.info(
        { orderId, hoursLeft, recipients: targets.length },
        'remindMastersOrderExpiring: рассылка отправлена',
      );
    } catch (error) {
      logger.error({ error, orderId, hoursLeft }, 'remindMastersOrderExpiring failed');
    }
  }

  /**
   * Уведомить администраторов, что заказ скоро будет авто-отменён.
   */
  async notifyAdminsOrderExpiring(orderId: string, hoursLeft: number) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { category: true, client: { include: { profile: true } } },
      });
      if (!order) return;

      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] as any }, isActive: true },
        select: { id: true, telegramId: true },
      });
      if (admins.length === 0) return;

      const clientName =
        `${order.client.profile?.firstName || ''} ${order.client.profile?.lastName || ''}`.trim() ||
        order.client.phone ||
        'клиент';
      const priceLabel = `${toNum(order.price).toLocaleString('ru')} сум`;

      await Promise.allSettled(
        admins.map(async (admin) => {
          await this.createNotification({
            userId: admin.id,
            type: 'admin_order_expiring',
            title: `⚠️ Заказ скоро авто-отменится (${hoursLeft}ч)`,
            message: `${order.title} • ${priceLabel} • ${order.category?.name || ''} • клиент: ${clientName}`,
            data: { orderId, hoursLeft },
          });
          if (admin.telegramId) {
            const text =
              `⚠️ <b>Заказ без откликов</b>\n\n` +
              `<b>${order.title}</b>\n` +
              `Категория: ${order.category?.name || '—'}\n` +
              `Клиент: ${clientName}\n` +
              `Сумма: ${priceLabel}\n` +
              `До авто-отмены: <b>${hoursLeft} ч.</b>\n\n` +
              `Можно вручную помочь клиенту: связаться или подсветить заказ мастерам.`;
            await sendTelegramMessage({ chatId: admin.telegramId, text }).catch(() => {});
          }
        }),
      );

      logger.info({ orderId, hoursLeft, adminCount: admins.length }, 'notifyAdminsOrderExpiring: отправлено');
    } catch (error) {
      logger.error({ error, orderId, hoursLeft }, 'notifyAdminsOrderExpiring failed');
    }
  }
}

export const notificationService = new NotificationService();
