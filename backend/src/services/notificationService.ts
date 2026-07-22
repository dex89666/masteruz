// ============================================
// MasterUz — Notification Service
// Централизованная служба уведомлений: БД + Telegram Push
// ============================================

import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { sendTelegramMessage, notifyMasterOrderApproved, notifyMasterNewOrder, notifyMasterResponseAccepted } from '../utils/telegramBot.js';
import { logger } from '../utils/logger.js';
import { toNum, calculateDistance } from '../utils/helpers.js';
import { alertRouter } from './alertRouter.js';
import { translatorFor, translator, normalizeLang, type Translator } from '../i18n/index.js';
import {
  rankMasters,
  splitIntoWaves,
  logRoutingDecision,
  type RankedMaster,
  type DispatchWave,
} from './masterRoutingService.js';

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

      const masterLangRow = await prisma.user.findUnique({
        where: { id: order.masterId! },
        select: { language: true },
      });
      const masterLang = normalizeLang(masterLangRow?.language);
      const trMaster = translator(masterLang);

      // In-app уведомление
      await this.createNotification({
        userId: order.masterId!,
        type: 'order_approved',
        title: trMaster('notify.orderApproved.title'),
        message: trMaster('notify.orderApproved.message', { title: order.title }),
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
        lang: masterLang,
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
        masterProfile: {
          select: {
            maxDistanceKm: true,
            // Поля для routing-скоринга (Итерация 3)
            rating: true,
            completedOrders: true,
            isOnline: true,
            lastSeenAt: true,
            hourlyRate: true,
            masterCategories: { select: { categoryId: true } },
          },
        },
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

      // ─── PRO-флаг батчем (1 SQL вместо N) ───
      const proIds = await prisma.masterSubscription.findMany({
        where: {
          masterId: { in: filteredMasters.map((m) => m.id) },
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() },
        },
        select: { masterId: true },
      });
      const proSet = new Set(proIds.map((r) => r.masterId));

      // ─── Итерация 3: композитный скоринг + волновая рассылка ───
      const ranked = rankMasters(
        filteredMasters.map((m) => ({
          id: m.id,
          telegramId: m.telegramId,
          isPro: proSet.has(m.id),
          profile: m.profile,
          masterProfile: m.masterProfile,
        })),
        {
          id: order.id,
          categoryId: order.categoryId,
          parentCategoryId: order.category?.parentId ?? null,
          childCategoryIds: childCategories.map((c) => c.id),
          latitude: order.latitude,
          longitude: order.longitude,
          isUrgent: order.isUrgent,
          estimatedPrice: toNum(order.price),
        },
      );
      logRoutingDecision(orderId, ranked);

      const waves = splitIntoWaves(ranked, order.isUrgent);
      logger.info(
        {
          orderId,
          waves: waves.map((w) => ({ wave: w.wave, delayMs: w.delayMs, count: w.masters.length })),
          isUrgent: order.isUrgent,
        },
        'notifyMastersNewOrder: волновой план рассылки',
      );

      // Первая волна — синхронно, остальные — отложенно через setTimeout с проверкой статуса.
      // Если заказ к моменту волны уже принят/отменён — волну пропускаем.
      for (const wave of waves) {
        if (wave.delayMs === 0) {
          await this._dispatchWave(order, wave, matchMode);
        } else {
          setTimeout(() => {
            this._dispatchWave(order, wave, matchMode).catch((err) =>
              logger.error({ err, orderId, wave: wave.wave }, 'Ошибка волны рассылки'),
            );
          }, wave.delayMs);
        }
      }
    } catch (error) {
      logger.error({ error, orderId }, 'Ошибка уведомления мастеров о новом заказе');
    }
  }

  /**
   * Выполнить одну волну рассылки.
   * Перед отправкой проверяет, что заказ всё ещё ждёт мастера.
   * Записи journal'a доставки идут одним пакетом.
   */
  private async _dispatchWave(
    order: {
      id: string;
      title: string;
      price: any;
      city: string | null;
      district: string | null;
      region: string | null;
      isUrgent: boolean;
      category: { name: string } | null;
    },
    wave: DispatchWave,
    matchMode: string,
  ): Promise<void> {
    const orderId = order.id;

    // Свежий статус: если уже принят/отменён — пропускаем волну
    if (wave.wave > 1) {
      const fresh = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      const stillOpen = fresh?.status === 'PUBLISHED' || fresh?.status === 'DRAFT';
      if (!stillOpen) {
        logger.info(
          { orderId, wave: wave.wave, status: fresh?.status },
          'notifyMastersNewOrder: волна отменена — заказ уже не ждёт мастера',
        );
        return;
      }
    }

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

    // ─── 1. Batch insert in-app уведомлений одной транзакцией ────
    // Раньше делалось N отдельных INSERT — при 50 мастерах × 500 заказов/час
    // это 25 000 round-trip к Postgres. createMany сводит до 1 запроса на волну.
    const inAppPayload = wave.masters.map((master: RankedMaster) => {
      const distLabel = master.distanceKm !== null ? ` • ${master.distanceKm} км от вас` : '';
      return {
        userId: master.masterId,
        type: 'new_order',
        title: order.isUrgent ? '🚨 Новый срочный заказ!' : '🆕 Новый заказ!',
        message: `${order.title} — ${toNum(order.price).toLocaleString('ru')} сум${order.city ? ` • ${order.city}` : ''}${order.district ? `, ${order.district}` : ''}${distLabel}`,
        data: {
          orderId,
          city: order.city,
          district: order.district,
          isUrgent: order.isUrgent,
          distance: master.distanceKm,
          routingScore: master.score,
          wave: wave.wave,
        } as any,
      };
    });

    let inAppOk = true;
    if (inAppPayload.length > 0) {
      try {
        await prisma.notification.createMany({ data: inAppPayload, skipDuplicates: false });
      } catch (err) {
        inAppOk = false;
        logger.error({ err, orderId, wave: wave.wave }, 'createMany notification failed');
      }
    }

    for (const master of wave.masters) {
      deliveryRecords.push({
        orderId,
        userId: master.masterId,
        channel: 'in_app',
        status: inAppOk ? 'success' : 'failed',
        reason: inAppOk ? null : 'db_error',
        errorCode: null,
        description: null,
        matchMode,
        distanceKm: master.distanceKm,
      });
    }

    // ─── 2. Telegram push (per-user, под rate-limit) ─────────────
    // Языки получателей — одним запросом, чтобы не делать N обращений к БД.
    const langRows = await prisma.user.findMany({
      where: { id: { in: wave.masters.map((m: RankedMaster) => m.masterId) } },
      select: { id: true, language: true },
    });
    const langByMaster = new Map(langRows.map((r) => [r.id, normalizeLang(r.language)]));

    const results = await Promise.allSettled(
      wave.masters.map(async (master: RankedMaster) => {
        if (!master.telegramId) {
          deliveryRecords.push({
            orderId,
            userId: master.masterId,
            channel: 'telegram',
            status: 'skipped',
            reason: 'no_telegram_id',
            errorCode: null,
            description: null,
            matchMode,
            distanceKm: master.distanceKm,
          });
          return { masterId: master.masterId, pushOk: false, reason: 'no_telegram_id' };
        }

        const pushResult = await notifyMasterNewOrder({
          masterTelegramId: master.telegramId,
          orderTitle: order.title,
          orderId,
          city: order.city,
          district: order.district,
          region: order.region,
          price: toNum(order.price),
          lang: langByMaster.get(master.masterId),
          isUrgent: order.isUrgent,
          categoryName: order.category?.name || '',
          distance: master.distanceKm,
        });

        deliveryRecords.push({
          orderId,
          userId: master.masterId,
          channel: 'telegram',
          status: pushResult.ok ? 'success' : 'failed',
          reason: pushResult.ok ? null : mapTelegramReason(pushResult.errorCode, pushResult.description),
          errorCode: pushResult.errorCode ?? null,
          description: pushResult.description ?? null,
          matchMode,
          distanceKm: master.distanceKm,
        });

        if (!pushResult.ok) {
          logger.warn(
            {
              orderId,
              masterId: master.masterId,
              telegramId: master.telegramId,
              errorCode: pushResult.errorCode,
              description: pushResult.description,
            },
            'Telegram push мастеру не доставлен (in-app уведомление сохранено)',
          );
        }

        return { masterId: master.masterId, pushOk: pushResult.ok, reason: pushResult.description };
      }),
    );

    if (deliveryRecords.length > 0) {
      await prisma.notificationDeliveryLog
        .createMany({ data: deliveryRecords })
        .catch((err) => logger.error({ err, orderId }, 'Не удалось записать журнал доставки'));
    }

    const pushSuccess = results.filter(
      (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value?.pushOk,
    ).length;
    const pushFailed = results.length - pushSuccess;

    logger.info(
      {
        orderId,
        wave: wave.wave,
        targets: wave.masters.length,
        pushSuccess,
        pushFailed,
        matchMode,
      },
      'notifyMastersNewOrder: волна доставлена',
    );
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

      const langRow = await prisma.user.findUnique({
        where: { id: masterId },
        select: { language: true },
      });
      const lang = normalizeLang(langRow?.language);
      const tr = translator(lang);

      // In-app
      await this.createNotification({
        userId: masterId,
        type: 'response_accepted',
        title: tr('notify.responseAccepted.title'),
        message: tr('notify.responseAccepted.message', { title: order.title }),
        data: { orderId },
      });

      // Telegram
      await notifyMasterResponseAccepted({
        masterTelegramId: masterUser.telegramId,
        orderTitle: order.title,
        orderId: order.id,
        price: toNum(order.price),
        lang,
      });
    } catch (error) {
      logger.error({ error, orderId, masterId }, 'Ошибка уведомления о принятии отклика');
    }
  }

  /**
   * Уведомить клиента, что его заказ авто-отменён системой (никто не принял за 72ч)
   * и средства возвращены на баланс.
   */
  /**
   * Мастер долго не находится: сообщаем клиенту, что деньги заморожены и их
   * можно вернуть, отменив заказ. Флаг clientStaleNotifiedAt проставляется
   * атомарно ДО отправки — при гонке двух тиков уведомление уйдёт один раз.
   * Решение отменять остаётся за клиентом: авто-отмену не включаем.
   */
  async notifyClientOrderStale(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });
      if (!order || order.masterId || order.status !== OrderStatus.PUBLISHED) return;

      // Атомарный захват: помечаем только если ещё не помечено. Если параллельный
      // тик уже взял заказ — count=0 и уведомление не дублируется.
      const claimed = await prisma.order.updateMany({
        where: { id: orderId, clientStaleNotifiedAt: null },
        data: { clientStaleNotifiedAt: new Date() },
      });
      if (claimed.count === 0) return;

      const tr = await translatorFor(order.clientId);
      const amount = toNum(order.escrowAmount).toLocaleString('ru');
      const currency = tr('common.currency');
      const days = Math.floor((Date.now() - order.createdAt.getTime()) / 86_400_000);

      await this.createNotification({
        userId: order.clientId,
        type: 'order_stale_no_master',
        title: tr('notify.orderStaleNoMaster.title'),
        message: tr('notify.orderStaleNoMaster.message', { title: order.title, days, amount, currency }),
        data: { orderId, days, escrowAmount: toNum(order.escrowAmount) },
      });

      if (order.client?.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text: tr('notify.orderStaleNoMaster.tg', { title: order.title, days, amount, currency }),
        }).catch(() => {});
      }

      logger.info({ orderId, days }, 'Клиент уведомлён о зависшем заказе');
    } catch (error) {
      logger.error({ error, orderId }, 'notifyClientOrderStale failed');
    }
  }

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

      const tr = await translatorFor(order.clientId);
      const amount = refundAmount.toLocaleString('ru');
      const currency = tr('common.currency');

      await this.createNotification({
        userId: order.clientId,
        type: 'order_auto_cancelled',
        title: tr('notify.orderAutoCancelled.title'),
        message: tr('notify.orderAutoCancelled.message', { title: order.title, amount, currency }),
        data: { orderId, refundAmount },
      });

      if (order.client?.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text: tr('notify.orderAutoCancelled.tg', { title: order.title, amount, currency }),
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
   * Диспетчер: «Заказ висит без мастера слишком долго».
   * Перед рассылкой ПЕРЕПРОВЕРЯЕМ статус — если заказ уже принят, отменён
   * или завершён, ничего не шлём (защита от фантомных алертов после ребилда).
   */
  async notifyAdminsOrderExpiring(orderId: string, hoursLeft: number) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { category: true, client: { include: { profile: true } } },
      });
      if (!order) return;
      if (order.status !== OrderStatus.PUBLISHED || order.masterId) {
        logger.debug({ orderId, status: order.status }, 'notifyAdminsOrderExpiring: заказ уже не висит — пропуск');
        return;
      }

      const clientName =
        `${order.client.profile?.firstName || ''} ${order.client.profile?.lastName || ''}`.trim() ||
        order.client.phone ||
        'клиент';
      const priceLabel = `${toNum(order.price).toLocaleString('ru')} сум`;

      await alertRouter.dispatch({
        type: 'order_stuck_no_master',
        title: `⚠️ Заказ без откликов (${hoursLeft}ч до авто-отмены)`,
        message:
          `${order.title}\n` +
          `Категория: ${order.category?.name || '—'}\n` +
          `Клиент: ${clientName}\n` +
          `Сумма: ${priceLabel}\n` +
          `До авто-отмены: ${hoursLeft} ч.\n\n` +
          `Можно вручную помочь клиенту: связаться или подсветить заказ мастерам.`,
        data: { orderId, hoursLeft, category: order.category?.name },
      });
    } catch (error) {
      logger.error({ error, orderId, hoursLeft }, 'notifyAdminsOrderExpiring failed');
    }
  }

  /**
   * Оповестить администраторов о критической проблеме с AI-провайдером
   * (например, исчерпана квота OpenAI). Используется при `insufficient_quota`,
   * `model_not_found`, отсутствии авторизации и подобных постоянных ошибках.
   */
  async notifyAdminsAiProviderIssue(params: {
    reason: 'quota_exhausted' | 'auth_failed' | 'model_unavailable' | 'unknown';
    provider?: string;
    detail?: string;
  }) {
    try {
      const provider = params.provider || 'OpenAI';
      const reasonMap: Record<typeof params.reason, { title: string; line: string }> = {
        quota_exhausted: {
          title: `⚠️ ${provider}: исчерпана квота`,
          line: `Закончился баланс или превышен план ${provider}. AI-анализ заказов не работает — пополните аккаунт.`,
        },
        auth_failed: {
          title: `🔐 ${provider}: неверный API-ключ`,
          line: `Запросы к ${provider} возвращают 401. Проверьте OPENAI_API_KEY в Railway.`,
        },
        model_unavailable: {
          title: `🚫 ${provider}: модель недоступна`,
          line: `Запрошенная модель не подключена к аккаунту ${provider}. Включите gpt-4o-mini или измените конфиг.`,
        },
        unknown: {
          title: `❗ ${provider}: ошибка интеграции`,
          line: `AI-провайдер ${provider} вернул неожиданную ошибку. Проверьте логи backend.`,
        },
      };
      const { title, line } = reasonMap[params.reason];
      const message =
        (params.detail ? `${line}\n\nДетали: ${params.detail}\n\n` : `${line}\n\n`) +
        `Время: ${new Date().toLocaleString('ru-RU')}`;

      await alertRouter.dispatch({
        type: 'ai_provider_issue',
        title,
        message,
        data: { reason: params.reason, provider, detail: params.detail },
      });
    } catch (error) {
      logger.error({ error, params }, 'notifyAdminsAiProviderIssue failed');
    }
  }

  /**
   * Клиент: «Мастер выехал к вам» / «Мастер поехал за материалом»
   */
  async notifyClientMasterDeparted(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          client: true,
          master: { include: { profile: true } },
        },
      });
      if (!order || !order.master || !order.client) return;

      const reason = order.transitReason;
      const eta = order.transitEtaAt
        ? new Date(order.transitEtaAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : null;
      const tr = await translatorFor(order.clientId);
      const masterName = order.master.profile?.firstName || tr('common.master');
      const toClient = reason === 'TO_CLIENT';

      const title = tr(
        toClient ? 'notify.masterDeparted.titleToClient' : 'notify.masterDeparted.titleForMaterial',
        { master: masterName },
      );
      const message = tr(
        toClient ? 'notify.masterDeparted.messageToClient' : 'notify.masterDeparted.messageForMaterial',
        {
          eta:
            eta ??
            tr(toClient ? 'notify.masterDeparted.etaWithinHour' : 'notify.masterDeparted.eta90min'),
        },
      );

      await this.createNotification({
        userId: order.clientId,
        type: 'master_departed',
        title,
        message,
        data: { orderId, transitReason: reason, transitEtaAt: order.transitEtaAt },
      });

      if (order.client.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text: tr('notify.masterDeparted.tg', { title, message, order: order.title }),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, orderId }, 'notifyClientMasterDeparted failed');
    }
  }

  /**
   * Мастер: «Подтвердите выезд» (висит ACCEPTED без действий).
   * Guard: если заказ уже не ACCEPTED или мастер сменился — молчим.
   */
  async notifyMasterToConfirmDeparture(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { master: true },
      });
      if (!order || !order.master) return;
      if (order.status !== OrderStatus.ACCEPTED || !order.masterId) {
        logger.debug({ orderId, status: order.status }, 'notifyMasterToConfirmDeparture: статус изменился — пропуск');
        return;
      }

      const tr = await translatorFor(order.masterId!);
      const title = tr('notify.confirmDeparture.title');
      const message = tr('notify.confirmDeparture.message', { title: order.title });

      await this.createNotification({
        userId: order.masterId!,
        type: 'master_confirm_departure',
        title,
        message,
        data: { orderId },
      });

      if (order.master.telegramId) {
        await sendTelegramMessage({
          chatId: order.master.telegramId,
          text: `<b>${title}</b>\n\n${message}`,
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, orderId }, 'notifyMasterToConfirmDeparture failed');
    }
  }

  /**
   * Мастер: «Вы обещали прибыть, обновите статус»
   * Клиент: «Мастер задерживается»
   */
  async notifyTransitOverdue(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { master: true, client: true, category: true },
      });
      if (!order || !order.master || !order.client) return;
      if (order.status !== OrderStatus.IN_TRANSIT) {
        logger.debug({ orderId, status: order.status }, 'notifyTransitOverdue: заказ уже не в транзите — пропуск');
        return;
      }

      const overdueMin = order.transitEtaAt
        ? Math.max(0, Math.round((Date.now() - new Date(order.transitEtaAt).getTime()) / 60_000))
        : 0;

      // Мастеру
      const masterLangRow = await prisma.user.findUnique({
        where: { id: order.masterId! },
        select: { language: true },
      });
      const masterLang = normalizeLang(masterLangRow?.language);
      const trMaster = translator(masterLang);
      const masterTitle = trMaster('notify.transitOverdue.masterTitle');
      const masterMsg = trMaster('notify.transitOverdue.masterMessage', {
        title: order.title,
        minutes: overdueMin,
      });
      await this.createNotification({
        userId: order.masterId!,
        type: 'master_transit_overdue',
        title: masterTitle,
        message: masterMsg,
        data: { orderId, overdueMin },
      });
      if (order.master.telegramId) {
        await sendTelegramMessage({
          chatId: order.master.telegramId,
          text: `<b>${masterTitle}</b>\n\n${masterMsg}`,
        }).catch(() => {});
      }

      // Клиенту
      const trClient = await translatorFor(order.clientId);
      const clientTitle = trClient('notify.transitOverdue.clientTitle');
      const clientMsg = trClient('notify.transitOverdue.clientMessage', {
        title: order.title,
        minutes: overdueMin,
      });
      await this.createNotification({
        userId: order.clientId,
        type: 'client_master_overdue',
        title: clientTitle,
        message: clientMsg,
        data: { orderId, overdueMin },
      });
      if (order.client.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text: `<b>${clientTitle}</b>\n\n${clientMsg}`,
        }).catch(() => {});
      }

      // Диспетчер: эскалация — нужно вмешательство человека.
      await alertRouter.dispatch({
        type: 'order_master_overdue',
        title: `🚨 Мастер опаздывает на заказе`,
        message:
          `${order.title}\n` +
          `Категория: ${order.category?.name || '—'}\n` +
          `Опоздание: ${overdueMin} мин\n` +
          `Мастер ID: ${order.masterId}\n` +
          `Клиент ID: ${order.clientId}`,
        data: { orderId, overdueMin, masterId: order.masterId, clientId: order.clientId },
      });
    } catch (err) {
      logger.error({ err, orderId }, 'notifyTransitOverdue failed');
    }
  }

  /**
   * Заказ ждёт доплаты остатка (новая модель «30% депозит»):
   * мастер подтвердил выполнение → клиенту нужно выбрать способ доплаты CASH/CARD.
   */
  async notifyOrderAwaitingRemainder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });
      if (!order) return;

      const remaining = toNum(order.remainingAmount ?? 0);
      const tr = await translatorFor(order.clientId);
      const amount = remaining.toLocaleString('ru');
      const currency = tr('common.currency');

      await this.createNotification({
        userId: order.clientId,
        type: 'order_awaiting_remainder',
        title: tr('notify.awaitingRemainder.title'),
        message: tr('notify.awaitingRemainder.message', { amount, currency }),
        data: { orderId, remaining },
      });

      if (order.client.telegramId) {
        await sendTelegramMessage({
          chatId: order.client.telegramId,
          text: tr('notify.awaitingRemainder.tg', { title: order.title, amount, currency }),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, orderId }, 'notifyOrderAwaitingRemainder failed');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ИЗМЕНЕНИЕ ЦЕНЫ ПО ХОДУ РАБОТ
  // ═══════════════════════════════════════════════════════════════

  /** Загружает заявку вместе с заказом и участниками. */
  private async loadPriceChange(requestId: string) {
    return prisma.priceChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        order: { include: { client: true } },
        master: { include: { profile: true } },
      },
    });
  }

  /** Человекочитаемое имя мастера. */
  private masterLabel(master: any): string {
    return (
      `${master?.profile?.firstName || ''} ${master?.profile?.lastName || ''}`.trim() ||
      master?.phone ||
      'Мастер'
    );
  }

  /**
   * Заявка создана мастером.
   * PENDING     → клиенту на подтверждение.
   * MODERATION  → модераторам (снижение цены / расчёт по факту / рост выше лимита).
   */
  async notifyPriceChangeCreated(requestId: string) {
    try {
      const req = await this.loadPriceChange(requestId);
      if (!req) return;

      const isSettlement = req.kind === 'SETTLEMENT';
      const oldPrice = toNum(req.oldPrice);
      const newPrice = toNum(req.newPrice);
      const visitFee = toNum(req.order.visitFee ?? 0);
      const total = newPrice + visitFee;
      const isDown = newPrice < oldPrice;
      const deltaPct = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

      // ── На модерацию: клиента пока не беспокоим ──
      if (req.status === 'MODERATION') {
        await alertRouter.dispatch({
          type: 'price_change_moderation',
          title: isSettlement
            ? '🧾 Расчёт по факту — нужна проверка'
            : isDown
              ? '⚠️ Снижение цены — возможен обход платформы'
              : '📈 Рост цены выше лимита',
          message:
            `Заказ: ${req.order.title}\n` +
            `Мастер: ${this.masterLabel(req.master)}\n` +
            `Работы: ${oldPrice.toLocaleString('ru')} → ${newPrice.toLocaleString('ru')} сум (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)\n` +
            `Итого клиенту: ${total.toLocaleString('ru')} сум (вкл. выезд ${visitFee.toLocaleString('ru')})\n` +
            `Обоснование: ${req.reason}\n` +
            `Фото: ${req.photos?.length ?? 0} шт.\n\n` +
            `Проверьте в админке → Модерация → Изменения цены.`,
          data: { requestId, orderId: req.orderId, kind: req.kind, oldPrice, newPrice, deltaPct },
        }).catch(() => {});
        return;
      }

      // ── Ждёт клиента ──
      const tr = await translatorFor(req.order.clientId);
      const currency = tr('common.currency');
      const heading = isDown
        ? tr('notify.priceChange.pendingTitleDown')
        : tr('notify.priceChange.pendingTitleUp');
      const params = {
        title: req.order.title,
        order: req.order.title,
        oldPrice: oldPrice.toLocaleString('ru'),
        newPrice: newPrice.toLocaleString('ru'),
        visitFee: visitFee.toLocaleString('ru'),
        total: total.toLocaleString('ru'),
        reason: req.reason,
        currency,
      };

      await this.createNotification({
        userId: req.order.clientId,
        type: 'price_change_pending',
        title: heading,
        message: tr('notify.priceChange.pendingMessage', params),
        data: { requestId, orderId: req.orderId, oldPrice, newPrice, total },
      });

      if (req.order.client.telegramId) {
        await sendTelegramMessage({
          chatId: req.order.client.telegramId,
          text: tr('notify.priceChange.pendingTg', { ...params, title: heading }),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, requestId }, 'notifyPriceChangeCreated failed');
    }
  }

  /**
   * Модератор принял решение.
   * approved → заявка уходит клиенту (уведомляем клиента).
   * иначе    → заявка отклонена (уведомляем мастера).
   */
  async notifyPriceChangeModerated(requestId: string, approved: boolean) {
    try {
      const req = await this.loadPriceChange(requestId);
      if (!req) return;

      if (approved) {
        // Заявка теперь PENDING — просим клиента решить.
        await this.notifyPriceChangeCreated(requestId);
        return;
      }

      const newPrice = toNum(req.newPrice);
      const tr = await translatorFor(req.masterId);
      const currency = tr('common.currency');
      const amount = newPrice.toLocaleString('ru');
      const note = req.moderatorNote ?? '';

      await this.createNotification({
        userId: req.masterId,
        type: 'price_change_moderation_rejected',
        title: tr('notify.priceChange.moderationRejectedTitle'),
        message:
          tr('notify.priceChange.moderationRejectedMessage', { title: req.order.title, amount, currency }) +
          (note ? tr('notify.priceChange.moderationRejectedReason', { note }) : ''),
        data: { requestId, orderId: req.orderId, note: req.moderatorNote },
      });

      if (req.master.telegramId) {
        await sendTelegramMessage({
          chatId: req.master.telegramId,
          text: tr('notify.priceChange.moderationRejectedTg', {
            order: req.order.title,
            amount,
            currency,
            noteLine: note ? tr('notify.priceChange.moderationRejectedTgNote', { note }) : '',
          }),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, requestId }, 'notifyPriceChangeModerated failed');
    }
  }

  /**
   * Клиент принял решение по заявке — уведомляем мастера.
   * Отказ от расчёта по факту дополнительно эскалируем в поддержку (спор).
   */
  async notifyPriceChangeResponded(requestId: string, approved: boolean) {
    try {
      const req = await this.loadPriceChange(requestId);
      if (!req) return;

      const isSettlement = req.kind === 'SETTLEMENT';
      const newPrice = toNum(req.newPrice);
      const visitFee = toNum(req.order.visitFee ?? 0);
      const total = newPrice + visitFee;

      const tr = await translatorFor(req.masterId);
      const currency = tr('common.currency');
      const totalStr = total.toLocaleString('ru');
      const visitFeeStr = visitFee.toLocaleString('ru');

      const title = approved
        ? tr(isSettlement ? 'notify.priceChange.approvedSettlementTitle' : 'notify.priceChange.approvedTitle')
        : tr(isSettlement ? 'notify.priceChange.rejectedSettlementTitle' : 'notify.priceChange.rejectedTitle');

      const message = approved
        ? tr('notify.priceChange.approvedMessage', { title: req.order.title, total: totalStr, currency })
        : tr(
            isSettlement
              ? 'notify.priceChange.rejectedSettlementMessage'
              : 'notify.priceChange.rejectedMessage',
            { title: req.order.title },
          );

      await this.createNotification({
        userId: req.masterId,
        type: approved ? 'price_change_approved' : 'price_change_rejected',
        title,
        message,
        data: { requestId, orderId: req.orderId, kind: req.kind, newPrice, total },
      });

      if (req.master.telegramId) {
        const body = approved
          ? tr('notify.priceChange.respondedTgApproved', { total: totalStr, visitFee: visitFeeStr, currency })
          : isSettlement
            ? tr('notify.priceChange.respondedTgSettlementRejected')
            : tr('notify.priceChange.respondedTgRejected', { visitFee: visitFeeStr, currency });

        await sendTelegramMessage({
          chatId: req.master.telegramId,
          text: tr('notify.priceChange.respondedTg', { title, order: req.order.title, body }),
        }).catch(() => {});
      }

      // Спор по объёму работ → в поддержку.
      if (!approved && isSettlement) {
        await alertRouter.dispatch({
          type: 'dispute_escalated',
          title: '⚖️ Спор по объёму выполненных работ',
          message:
            `Заказ: ${req.order.title}\n` +
            `Мастер: ${this.masterLabel(req.master)}\n` +
            `Заявлено мастером: ${newPrice.toLocaleString('ru')} сум\n` +
            `Согласованная цена: ${toNum(req.oldPrice).toLocaleString('ru')} сум\n` +
            `Клиент не согласен — требуется решение администратора.`,
          data: { requestId, orderId: req.orderId },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err, requestId }, 'notifyPriceChangeResponded failed');
    }
  }
}

export const notificationService = new NotificationService();
