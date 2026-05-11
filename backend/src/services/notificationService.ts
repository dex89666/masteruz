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

      // Категории-кандидаты: сам categoryId + родительский (если заказ в подкатегории)
      // Это важно: мастер может быть привязан к родителю «Электрика», а заказ — в подкатегории «Замена розетки».
      const categoryIds: string[] = [order.categoryId];
      if (order.category?.parentId) categoryIds.push(order.category.parentId);
      // Также добавляем ID всех детей текущей категории (если заказ в родительской — мастера-узкоспециалисты тоже получат)
      const childCategories = await prisma.category.findMany({
        where: { parentId: order.categoryId },
        select: { id: true },
      });
      for (const c of childCategories) categoryIds.push(c.id);

      const masterSelect = {
        id: true,
        telegramId: true,
        profile: { select: { latitude: true, longitude: true, city: true } },
        masterProfile: { select: { maxDistanceKm: true } },
      } as const;

      // ШАГ 1: ищем мастеров, у которых явно привязана категория (или её родитель/потомок)
      let masters = await prisma.user.findMany({
        where: {
          role: 'MASTER',
          isActive: true,
          masterProfile: {
            isAvailable: true,
            masterCategories: { some: { categoryId: { in: categoryIds } } },
          },
        },
        select: masterSelect,
        take: 200,
      });

      let matchMode: 'category' | 'fallback_all_masters' = 'category';

      // ШАГ 2 (фолбэк): если по категории никого нет — берём ВСЕХ активных мастеров.
      // Лучше отправить «не своей» категории, чем не отправить никому.
      // Дальше всё равно фильтруем по гео/городу.
      if (masters.length === 0) {
        masters = await prisma.user.findMany({
          where: {
            role: 'MASTER',
            isActive: true,
            masterProfile: { isAvailable: true },
          },
          select: masterSelect,
          take: 200,
        });
        matchMode = 'fallback_all_masters';
        logger.warn(
          { orderId, categoryIds, orderCategoryName: order.category?.name },
          'notifyMastersNewOrder: по категории мастеров нет — переключаемся на фолбэк (все активные мастера)',
        );
      }

      logger.info(
        { orderId, totalMasters: masters.length, matchMode, orderHasGeo, orderCity: order.city, categoryIds },
        'notifyMastersNewOrder: найдено мастеров',
      );

      if (masters.length === 0) {
        logger.warn({ orderId }, 'notifyMastersNewOrder: нет активных мастеров вообще');
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

      // Нормализатор города для сравнения: понижаем регистр, убираем пробелы/диакритику.
      // Так «Ташкент», «ташкент », «Tashkent», «Toshkent» считаются одним городом.
      const cityAliases: Record<string, string> = {
        ташкент: 'tashkent',
        tashkent: 'tashkent',
        toshkent: 'tashkent',
        самарканд: 'samarkand',
        samarkand: 'samarkand',
        samarqand: 'samarkand',
        бухара: 'bukhara',
        bukhara: 'bukhara',
        buxoro: 'bukhara',
      };
      const normCity = (raw?: string | null): string => {
        if (!raw) return '';
        const k = raw.trim().toLowerCase().replace(/\s+/g, '');
        return cityAliases[k] ?? k;
      };
      const orderCityKey = normCity(order.city);

      // Фильтрация:
      // 1) Если у заказа есть гео — приоритет ближайшим, но город-фолбэк тоже
      // 2) Если у заказа есть город (без гео) — по городу (с нормализацией)
      // 3) Если ни гео ни города — отправляем ВСЕМ (до 50)
      //
      // ВАЖНО: мастер по категории УЖЕ матчится строго. Если у мастера нет
      // координат и нет совпадения по городу — мы всё равно его включаем
      // (без отметки расстояния). Лучше уведомить, чем молчать: мастер сам
      // решит брать заказ или нет, увидев адрес.
      let filteredMasters;
      if (orderHasGeo) {
        filteredMasters = mastersWithDistance
          .filter((m) => {
            if (m.distance !== null) {
              const maxKm = m.masterProfile?.maxDistanceKm || 30;
              return m.distance <= maxKm;
            }
            // У мастера нет координат — пропускаем дальше (city-проверка опциональна)
            if (!orderCityKey) return true;
            const masterCity = normCity(m.profile?.city);
            // Если у мастера город не указан или совпадает — включаем
            return !masterCity || masterCity === orderCityKey;
          })
          .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
          .slice(0, 50);
      } else if (order.city) {
        filteredMasters = mastersWithDistance
          .filter((m) => {
            const masterCity = normCity(m.profile?.city);
            return !masterCity || masterCity === orderCityKey;
          })
          .slice(0, 50);
      } else {
        // Нет ни гео ни города — отправляем всем
        filteredMasters = mastersWithDistance.slice(0, 50);
      }

      // ФОЛБЭК: если после гео/city-фильтра никого не осталось, но по категории
      // мастера были найдены — отправляем им. Лучше уведомить мастера «не из города»,
      // чем не уведомить никого.
      if (filteredMasters.length === 0 && mastersWithDistance.length > 0) {
        filteredMasters = mastersWithDistance.slice(0, 50);
        logger.warn(
          { orderId, totalMasters: mastersWithDistance.length, orderCity: order.city },
          'notifyMastersNewOrder: гео/city-фильтр обнулил список — отправляем всем найденным по категории',
        );
      }

      logger.info({ orderId, filteredCount: filteredMasters.length }, 'notifyMastersNewOrder: после фильтрации');

      // ─── Параллельная рассылка (Promise.allSettled) ───
      // Накапливаем записи журнала доставки и пишем одним createMany в конце.
      const deliveryRecords: Array<{
        orderId: string;
        userId: string;
        channel: string;
        status: string;
        reason: string | null;
        errorCode: number | null;
        description: string | null;
        matchMode: string;
        distanceKm: number | null;
      }> = [];

      const mapTelegramReason = (errorCode?: number, description?: string): string => {
        if (!description) return 'unknown';
        const d = description.toLowerCase();
        if (errorCode === 403 && d.includes('blocked')) return 'bot_blocked';
        if (errorCode === 403 && d.includes("can't initiate")) return 'never_started_bot';
        if (errorCode === 400 && d.includes('chat not found')) return 'chat_not_found';
        if (errorCode === 400 && d.includes('user is deactivated')) return 'user_deactivated';
        return description.slice(0, 80);
      };

      const results = await Promise.allSettled(
        filteredMasters.map(async (master) => {
          const distLabel = master.distance !== null ? ` • ${master.distance} км от вас` : '';

          // 1) In-app уведомление — работает всегда
          const inApp = await this.createNotification({
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

          deliveryRecords.push({
            orderId,
            userId: master.id,
            channel: 'in_app',
            status: inApp ? 'success' : 'failed',
            reason: inApp ? null : 'db_error',
            errorCode: null,
            description: null,
            matchMode,
            distanceKm: master.distance,
          });

          // 2) Telegram push — только если есть telegramId
          if (!master.telegramId) {
            deliveryRecords.push({
              orderId,
              userId: master.id,
              channel: 'telegram',
              status: 'skipped',
              reason: 'no_telegram_id',
              errorCode: null,
              description: null,
              matchMode,
              distanceKm: master.distance,
            });
            return { masterId: master.id, pushOk: false, reason: 'no_telegram_id' };
          }

          const pushResult = await notifyMasterNewOrder({
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

          deliveryRecords.push({
            orderId,
            userId: master.id,
            channel: 'telegram',
            status: pushResult.ok ? 'success' : 'failed',
            reason: pushResult.ok ? null : mapTelegramReason(pushResult.errorCode, pushResult.description),
            errorCode: pushResult.errorCode ?? null,
            description: pushResult.description ?? null,
            matchMode,
            distanceKm: master.distance,
          });

          if (!pushResult.ok) {
            logger.warn(
              {
                orderId,
                masterId: master.id,
                telegramId: String(master.telegramId),
                errorCode: pushResult.errorCode,
                description: pushResult.description,
              },
              'Telegram push мастеру не доставлен (in-app уведомление сохранено)',
            );
          }

          return { masterId: master.id, pushOk: pushResult.ok, reason: pushResult.description };
        }),
      );

      // Запись журнала доставки одним пакетом
      if (deliveryRecords.length > 0) {
        await prisma.notificationDeliveryLog
          .createMany({ data: deliveryRecords })
          .catch((err) => logger.error({ err, orderId }, 'Не удалось записать журнал доставки'));
      }

      const pushSuccess = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value?.pushOk).length;
      const pushFailed = results.length - pushSuccess;

      logger.info(
        {
          orderId,
          totalTargets: filteredMasters.length,
          pushSuccess,
          pushFailed,
          matchMode,
        },
        'notifyMastersNewOrder: рассылка завершена',
      );
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
