// ============================================
// MasterUz — Orders Service (Антифрод механика)
// PUBLISHED → ACCEPTED → IN_TRANSIT → IN_PROGRESS → COMPLETED
// Эскроу / Двойное подтверждение / Штрафы / Споры
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { calculateDistance, calculateCommission, getPagination, paginatedResponse, moneyMul, moneyAdd, moneySub, moneyDiv, toNum, isSuperAdmin } from '../../utils/helpers.js';
import { OrderStatus, Prisma } from '@prisma/client';
import type { CreateOrderInput, ListOrdersInput, OrderResponseInput } from './orders.schema.js';
import { logger } from '../../utils/logger.js';
import { notificationService } from '../../services/notificationService.js';
import { balanceService } from '../balance/balance.service.js';
import { auditService } from '../../services/auditService.js';
import { eventBus } from '../../services/eventBus.js';
import { safeRecalculate as recalcCustomerRisk } from '../../services/customerRiskService.js';
import { safeScanUser as safeScanFraud } from '../../services/fraudDetectionService.js';

// Авто-отмена опубликованных заказов отключена: заказ живёт, пока клиент не закроет сам.
// Поле оставлено для обратной совместимости с фронтом — всегда null.
function withAutoCancelAt<T extends { status: OrderStatus; masterId: string | null; createdAt: Date }>(order: T): T & { autoCancelAt: Date | null } {
  return Object.assign(order, { autoCancelAt: null });
}

// ─── Конфиг штрафов ─────────────────────────
const PENALTY_AFTER_ACCEPT = 20000;   // Штраф за отмену после принятия (20 000 сум)
const PENALTY_AFTER_TRANSIT = 30000;  // Штраф за отмену после «мастер в пути» (30 000 сум)
const PENALTY_MASTER_CANCEL = 30000;  // Штраф мастеру за отмену (30 000 сум)
const AUTO_CONFIRM_TIMEOUT_MS = 60 * 60 * 1000; // 1 час — авто-подтверждение клиентом

export class OrdersService {
  /**
   * Создание нового заказа с блокировкой средств (эскроу)
   */
  async createOrder(clientId: string, data: CreateOrderInput) {
    // Проверяем категорию
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });

    if (!category || !category.isActive) {
      throw ApiError.badRequest('Категория не найдена или неактивна');
    }

    // ─── Проверка принятия оферты ──────────
    if (!data.offerAccepted) {
      throw ApiError.badRequest('Необходимо принять условия оферты');
    }

    // Получаем текущую комиссию из конфигурации
    const [visitFeeConfig, visitFeeCommConfig] = await Promise.all([
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee' } }),
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee_commission_rate' } }),
    ]);
    const visitFee = visitFeeConfig ? parseFloat(visitFeeConfig.value) : 0;
    const visitFeeCommissionRate = visitFeeCommConfig ? parseFloat(visitFeeCommConfig.value) : 0;

    // ─── Проверка минимальной цены ────────────────
    if (data.taskIds && data.taskIds.length > 0) {
      const selectedTasks = await prisma.task.findMany({
        where: { id: { in: data.taskIds } },
        select: { id: true, minPrice: true, name: true },
      });

      const totalMinPrice = selectedTasks.reduce((sum, t) => sum + toNum(t.minPrice ?? 0), 0);
      const minimumRequired = totalMinPrice + visitFee;

      if (data.price < minimumRequired) {
        const detail = visitFee > 0
          ? `(работы: ${totalMinPrice.toLocaleString('ru')} + выезд: ${visitFee.toLocaleString('ru')})`
          : `(минимум по выбранным работам)`;
        throw ApiError.badRequest(
          `Минимальная стоимость заказа: ${minimumRequired.toLocaleString('ru')} сум ${detail}`
        );
      }
    }

    // ─── Обработка срочности (+40%) ────────────
    const URGENT_MULTIPLIER = 1.4;
    const isUrgent = data.isUrgent === true;
    const urgentMultiplier = isUrgent ? URGENT_MULTIPLIER : 1.0;
    const effectivePrice = data.price * urgentMultiplier;

    // Ступенчатая комиссия от стоимости работ (без учёта первой/повторной пары — её применим
    // при назначении мастера в assignMaster, когда станет известно masterId).
    const { getTieredCommissionRate } = await import('../../services/platformConfigService.js');
    const commissionRate = await getTieredCommissionRate(effectivePrice);

    // Комиссия с работ + (опционально) комиссия с выезда
    const workCommission = calculateCommission(effectivePrice, commissionRate);
    const visitFeeCommission = visitFee > 0
      ? calculateCommission(visitFee, visitFeeCommissionRate)
      : 0;
    const commissionAmount = workCommission + visitFeeCommission;

    // Полная сумма для эскроу: цена заказа + (опц.) стоимость выезда
    const escrowAmount = effectivePrice + visitFee;

    // ─── Атомарная транзакция: проверка баланса + блокировка + создание заказа ────
    const order = await prisma.$transaction(async (tx) => {
      // Блокирующее чтение баланса внутри транзакции
      const client = await tx.user.findUnique({
        where: { id: clientId },
        select: { balance: true },
      });
      if (!client) throw ApiError.notFound('Пользователь не найден');

      const balance = toNum(client.balance);
      if (balance < escrowAmount) {
        throw ApiError.badRequest(
          `Недостаточно средств. Баланс: ${balance.toLocaleString('ru')} сум, ` +
          `необходимо: ${escrowAmount.toLocaleString('ru')} сум`
        );
      }

      // Создаём заказ
      const newOrder = await tx.order.create({
        data: {
          clientId,
          categoryId: data.categoryId,
          title: data.title,
          description: data.description,
          price: effectivePrice,
          priceMax: data.priceMax ? data.priceMax * urgentMultiplier : null,
          commissionRate,
          commissionAmount,
          visitFee,
          escrowAmount,
          offerAccepted: true,
          status: OrderStatus.PUBLISHED,
          isUrgent,
          urgentMultiplier,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          street: data.street,
          city: data.city,
          district: data.district,
          region: data.region,
          deadline: data.deadline ? new Date(data.deadline) : null,
          ...(data.taskIds && data.taskIds.length > 0
            ? { orderTasks: { create: data.taskIds.map((taskId: string) => ({ taskId })) } }
            : {}),
        },
        include: {
          category: true,
          client: { include: { profile: true } },
          orderTasks: { include: { task: true } },
        },
      });

      // Списываем баланс и создаём запись аудита — всё в одной транзакции
      const balanceAfter = moneySub(balance, escrowAmount);
      await Promise.all([
        tx.user.update({
          where: { id: clientId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId: clientId,
            type: 'ESCROW_HOLD',
            amount: -escrowAmount,
            balanceBefore: balance,
            balanceAfter,
            orderId: newOrder.id,
            description: 'Блокировка средств по заказу',
          },
        }),
      ]);

      return newOrder;
    });

    logger.info({ orderId: order.id, clientId, isUrgent, escrowAmount }, 'Заказ создан, средства заблокированы');

    // Уведомления — fire-and-forget, вне транзакции
    notificationService.notifyMastersNewOrder(order.id).catch((err) => {
      logger.error({ error: err }, 'Ошибка уведомления мастеров');
    });

    return order;
  }

  /**
   * Получение списка заказов с фильтрами
   */
  async listOrders(filters: ListOrdersInput, userId?: string) {
    const { skip, take, page, limit } = getPagination(
      Number(filters.page) || 1,
      Number(filters.limit) || 20
    );

    const where: Prisma.OrderWhereInput = {};

    // Фильтр по статусу
    if (filters.status) {
      where.status = filters.status as OrderStatus;
    } else {
      where.status = OrderStatus.PUBLISHED;
    }

    // Фильтр по категории (поддержка UUID и slug)
    if (filters.categoryId) {
      // Проверяем: это UUID или slug?
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.categoryId);
      if (isUuid) {
        where.categoryId = filters.categoryId;
      } else {
        // Ищем категорию по slug
        const category = await prisma.category.findFirst({
          where: { slug: filters.categoryId },
        });
        if (category) {
          where.categoryId = category.id;
        }
      }
    }

    // Фильтр по подкатегории (через связанные задачи)
    if (filters.subcategoryId) {
      where.orderTasks = {
        some: {
          task: {
            subcategoryId: filters.subcategoryId,
          },
        },
      };
    }

    // Фильтр по городу
    if (filters.city) {
      where.city = filters.city;
    }

    // Фильтр по району
    if (filters.district) {
      where.district = filters.district;
    }

    // Фильтр по срочности
    if (filters.isUrgent === 'true') {
      where.isUrgent = true;
    }

    // Фильтр по цене
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = Number(filters.minPrice);
      if (filters.maxPrice) where.price.lte = Number(filters.maxPrice);
    }

    // Определяем сортировку
    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: 'desc' };
    if (filters.sortBy === 'price') {
      orderBy = { price: filters.sortOrder || 'desc' };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: true,
          client: {
            include: { profile: true },
          },
          orderTasks: {
            include: { task: true },
          },
          _count: {
            select: { responses: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Скрываем контактные данные клиента в списке заказов
    orders.forEach((o: any) => {
      if (o.client) {
        o.client.phone = null;
        o.client.email = null;
      }
    });

    // Если есть координаты — рассчитываем расстояние и фильтруем
    let processedOrders = orders;
    if (filters.latitude && filters.longitude) {
      processedOrders = orders
        .map((order) => {
          const distance =
            order.latitude && order.longitude
              ? calculateDistance(
                  Number(filters.latitude),
                  Number(filters.longitude),
                  order.latitude,
                  order.longitude
                )
              : null;

          return { ...order, distance };
        })
        .filter((order) => {
          if (filters.radius && order.distance !== null) {
            return order.distance <= Number(filters.radius);
          }
          return true;
        })
        .sort((a, b) => {
          if (filters.sortBy === 'distance' && a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          return 0;
        }) as any;
    }

    return paginatedResponse(processedOrders.map(withAutoCancelAt), total, page, limit);
  }

  /**
   * Получение деталей заказа
   */
  async getOrder(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        category: true,
        client: {
          include: { profile: true },
        },
        master: {
          include: { profile: true, masterProfile: true },
        },
        responses: {
          include: {
            master: {
              include: { profile: true, masterProfile: true },
            },
          },
        },
        orderTasks: {
          include: { task: true },
        },
        reviews: true,
      },
    });

    if (!order) {
      throw ApiError.notFound('Заказ не найден');
    }

    // Скрываем контакты клиента (phone, email) — видны только:
    // 1. Самому клиенту (владельцу заказа)
    // 2. Назначенному мастеру после принятия заказа (ACCEPTED+)
    // 3. Админу/менеджеру
    const isOwner = userId === order.clientId;
    const isAssignedMaster = userId === order.masterId;
    const acceptedStatuses = ['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED',
      'ESTIMATION_IN_PROGRESS', 'ESTIMATION_DONE', 'ESTIMATE_SENT', 'ESTIMATE_APPROVED', 'MODERATION'];
    const orderAccepted = acceptedStatuses.includes(order.status);

    let isAdminRequester = false;
    if (userId) {
      const reqUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } });
      isAdminRequester = reqUser?.role === 'ADMIN' || reqUser?.role === 'MANAGER' || isSuperAdmin(reqUser?.username);
    }

    const canSeeContacts = isOwner || (isAssignedMaster && orderAccepted) || isAdminRequester;

    if (!canSeeContacts && order.client) {
      // Убираем контактные данные клиента
      (order.client as any).phone = null;
      (order.client as any).email = null;
    }

    // Скрываем контакты мастера от клиента до принятия заказа
    // Контакты мастера видны только: назначенному мастеру (себе), клиенту после ACCEPTED, админу
    if (!isAdminRequester && order.master) {
      const clientCanSeeMasterContacts = isOwner && orderAccepted;
      const isMasterSelf = userId === order.masterId;
      if (!clientCanSeeMasterContacts && !isMasterSelf) {
        (order.master as any).phone = null;
        (order.master as any).email = null;
      }
    }

    // Скрываем контакты мастеров в откликах (до назначения)
    if (order.responses) {
      for (const resp of order.responses as any[]) {
        if (resp.master && !isAdminRequester) {
          (resp.master as any).phone = null;
          (resp.master as any).email = null;
        }
      }
    }

    // ─── Виртуальные номера (anti-bypass) ───────────────────
    // Когда включён флаг virtual_numbers_enabled, реальные телефоны
    // маскируются для всех, кроме админов. До подключения SIP-провайдера
    // это переходная мера — клиент и мастер видят формат +998 ** *** ** 12,
    // реальный звонок осуществляется через кнопку «Позвонить» (TODO: SIP).
    if (!isAdminRequester) {
      const { shouldMaskPhones, maskPhone } = await import('../../utils/phoneMask.js');
      if (await shouldMaskPhones()) {
        if (order.client && (order.client as any).phone) {
          (order.client as any).phone = maskPhone((order.client as any).phone);
        }
        if (order.master && (order.master as any).phone) {
          (order.master as any).phone = maskPhone((order.master as any).phone);
        }
      }
    }

    // ─── Customer Risk Score: мастер/админ видит риск-скор клиента ──
    // (Сам клиент свой скор тоже видит — это его персональные данные)
    if (order.client && (isAdminRequester || isAssignedMaster || isOwner)) {
      const score = (order.client as any).riskScore ?? 50;
      const band = score <= 30 ? 'low' : score <= 60 ? 'normal' : score <= 80 ? 'caution' : 'high';
      (order.client as any).risk = { score, band };
    }
    // Скрываем raw поля скоринга от всех (только агрегат через .risk)
    if (order.client) {
      delete (order.client as any).riskScore;
      delete (order.client as any).riskUpdatedAt;
      delete (order.client as any).riskFactors;
    }

    return withAutoCancelAt(order as any);
  }

  /**
   * Отклик мастера на заказ
   * RACE-SAFE: $transaction + unique constraint гарантируют атомарность
   */
  async respondToOrder(orderId: string, masterId: string, data: OrderResponseInput) {
    // Предварительные проверки (вне транзакции — дешёвые)
    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
    });

    if (!masterProfile) {
      throw ApiError.badRequest('Только мастера могут откликаться на заказы');
    }

    // ─── Атомарная транзакция: проверка + создание ───
    const response = await prisma.$transaction(async (tx) => {
      // Блокирующее чтение заказа внутри транзакции
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) throw ApiError.notFound('Заказ не найден');
      if (order.status !== OrderStatus.PUBLISHED) throw ApiError.badRequest('Заказ недоступен для откликов');
      if (order.clientId === masterId) throw ApiError.badRequest('Нельзя откликнуться на свой заказ');

      // Ограничение для новичков (< 5 заказов)
      if (masterProfile.completedOrders < 5 && data.priceOffer) {
        const newbieConfig = await tx.platformConfig.findUnique({ where: { key: 'newbie_max_price_ratio' } });
        const maxRatio = newbieConfig ? parseFloat(newbieConfig.value) : 0.7;
        const maxNewbiePrice = Math.round(toNum(order.price) * maxRatio);

        if (data.priceOffer > maxNewbiePrice) {
          throw ApiError.badRequest(
            `Новые мастера (менее 5 заказов) могут предлагать не более ${(maxRatio * 100).toFixed(0)}% от стоимости заказа. ` +
            `Максимальная ставка: ${maxNewbiePrice.toLocaleString('ru')} сум`
          );
        }
      }

      // Создаём отклик — unique constraint (orderId_masterId) предотвращает дубли
      try {
        return await tx.orderResponse.create({
          data: {
            orderId,
            masterId,
            priceOffer: data.priceOffer,
            message: data.message,
          },
          include: {
            master: {
              include: { profile: true, masterProfile: true },
            },
          },
        });
      } catch (err: any) {
        // P2002 = Unique constraint violation
        if (err?.code === 'P2002') {
          throw ApiError.conflict('Вы уже откликнулись на этот заказ');
        }
        throw err;
      }
    });

    logger.info({ orderId, masterId }, 'Мастер откликнулся на заказ');

    // ─── Авто-назначение мастера ───
    // 1) Для instant-photo-заказов (фиксированная цена + фото) ВСЕГДА авто-назначаем
    //    первого откликнувшегося — клиенту нечего выбирать, задача предельно простая.
    // 2) В остальных случаях — только если включён глобальный флаг auto_assign_master.
    try {
      const fresh = await prisma.order.findUnique({
        where: { id: orderId },
        select: { clientId: true, status: true, isInstantAiOrder: true },
      });
      if (!fresh || fresh.status !== OrderStatus.PUBLISHED) {
        return response;
      }

      let shouldAutoAssign = fresh.isInstantAiOrder;
      if (!shouldAutoAssign) {
        const autoAssignConfig = await prisma.platformConfig.findUnique({
          where: { key: 'auto_assign_master' },
        });
        shouldAutoAssign = autoAssignConfig?.value === 'true';
      }

      if (shouldAutoAssign) {
        logger.info(
          { orderId, masterId, instant: fresh.isInstantAiOrder },
          'Авто-назначение мастера',
        );
        await this.assignMaster(orderId, fresh.clientId, masterId);
      }
    } catch (err) {
      logger.error({ err, orderId, masterId }, 'Ошибка авто-назначения');
    }

    return response;
  }

  /**
   * Назначение мастера на заказ (клиентом) → статус ACCEPTED
   */
  async assignMaster(orderId: string, clientId: string, masterId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw ApiError.notFound('Заказ не найден');
    }

    if (order.clientId !== clientId) {
      throw ApiError.forbidden('Только владелец заказа может назначить мастера');
    }

    if (order.status !== OrderStatus.PUBLISHED) {
      throw ApiError.badRequest('Заказ не в статусе публикации');
    }

    // Проверяем отклик мастера
    const response = await prisma.orderResponse.findUnique({
      where: {
        orderId_masterId: {
          orderId,
          masterId,
        },
      },
    });

    if (!response) {
      throw ApiError.badRequest('Мастер не откликался на этот заказ');
    }

    // ─── Ступенчатая комиссия + надбавка за первый заказ клиент↔мастер ───
    //     База = ступень от стоимости работ. Поверх — surcharge first/repeat.
    const { getTieredEffectiveCommissionRate, getConfigNumber, PLATFORM_CONFIG_KEYS } = await import(
      '../../services/platformConfigService.js'
    );
    const workPrice = toNum(order.price);
    const effectiveRate = await getTieredEffectiveCommissionRate(workPrice, clientId, masterId);
    const visitFeeRate = await getConfigNumber(PLATFORM_CONFIG_KEYS.visitFeeCommissionRate, 0);
    const recalcWorkCommission = calculateCommission(workPrice, effectiveRate);
    const recalcVisitCommission = calculateCommission(toNum(order.visitFee ?? 0), visitFeeRate);
    const recalcCommissionAmount = recalcWorkCommission + recalcVisitCommission;

    // PUBLISHED → ACCEPTED (не сразу IN_PROGRESS!)
    // Комиссия теперь удерживается автоматически из эскроу при завершении
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          masterId,
          status: OrderStatus.ACCEPTED,
          acceptedAt: new Date(),
          commissionRate: effectiveRate,
          commissionAmount: recalcCommissionAmount,
          commissionPaid: true, // Авто-комиссия: мастер не платит вручную
        },
        include: {
          master: { include: { profile: true } },
          client: { include: { profile: true } },
          category: true,
        },
      }),
      prisma.orderResponse.update({
        where: { id: response.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.orderResponse.updateMany({
        where: {
          orderId,
          masterId: { not: masterId },
        },
        data: { status: 'REJECTED' },
      }),
    ]);

    logger.info({ orderId, masterId, clientId }, 'Мастер принят → ACCEPTED');

    // SSE: мастер назначен, уведомляем участников
    eventBus.emit(orderId, 'master_assigned', {
      orderId,
      masterId,
      clientId,
      status: OrderStatus.ACCEPTED,
      timestamp: new Date().toISOString(),
    });

    // Уведомляем мастера о назначении
    notificationService.notifyMasterAssigned(orderId).catch((err) => {
      logger.error({ error: err }, 'Ошибка уведомления мастера о назначении');
    });
    notificationService.notifyMasterResponseAccepted(orderId, masterId).catch((err) => {
      logger.error({ error: err }, 'Ошибка уведомления о принятии отклика');
    });

    return updatedOrder;
  }

  /**
   * Мастер обновляет статус: ACCEPTED → IN_TRANSIT → IN_PROGRESS
   */
  async updateOrderStatus(
    orderId: string,
    masterId: string,
    newStatus: string,
    masterCoords?: { latitude?: number; longitude?: number }
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');

    const transitions: Record<string, string[]> = {
      ACCEPTED: ['IN_TRANSIT'],
      IN_TRANSIT: ['IN_PROGRESS'],
    };

    const allowedNext = transitions[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw ApiError.badRequest(
        `Нельзя перевести из ${order.status} в ${newStatus}. Допустимые: ${allowedNext.join(', ')}`
      );
    }

    // ─── Гео-фенс при «Я приехал» (IN_TRANSIT → IN_PROGRESS) ───
    // Не даём подтвердить «приехал», если мастер дальше 500м от точки заказа
    if (newStatus === 'IN_PROGRESS' && order.latitude && order.longitude) {
      if (masterCoords?.latitude == null || masterCoords?.longitude == null) {
        throw ApiError.badRequest(
          'Чтобы подтвердить прибытие, разрешите доступ к геолокации'
        );
      }
      const distanceKm = calculateDistance(
        order.latitude,
        order.longitude,
        masterCoords.latitude,
        masterCoords.longitude
      );
      const ARRIVAL_RADIUS_KM = 0.5; // 500 м
      if (distanceKm > ARRIVAL_RADIUS_KM) {
        const meters = Math.round(distanceKm * 1000);
        throw ApiError.badRequest(
          `Вы в ${meters} м от точки заказа. Подойдите ближе (до 500 м), чтобы подтвердить прибытие.`
        );
      }
    }

    const updateData: any = { status: newStatus as OrderStatus };
    if (newStatus === 'IN_TRANSIT') {
      updateData.inTransitAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        master: { include: { profile: true } },
        client: { include: { profile: true } },
        category: true,
      },
    });

    logger.info({ orderId, masterId, from: order.status, to: newStatus }, 'Статус обновлён мастером');

    // SSE: уведомляем всех участников о смене статуса
    eventBus.emit(orderId, 'status_changed', {
      orderId,
      status: newStatus,
      previousStatus: order.status,
      updatedBy: masterId,
      timestamp: new Date().toISOString(),
    });

    return updatedOrder;
  }

  /**
   * Live-позиция мастера во время доставки (IN_TRANSIT)
   * Эмитит SSE-событие master_location клиенту/всем подписчикам заказа.
   * НЕ записываем в БД — только в eventBus (мгновенный broadcast).
   */
  async broadcastMasterLocation(
    orderId: string,
    masterId: string,
    coords: { latitude: number; longitude: number; heading?: number; speed?: number }
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, masterId: true, status: true, latitude: true, longitude: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');

    // Live-трансляция имеет смысл только в активной фазе
    const liveStatuses = new Set(['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS']);
    if (!liveStatuses.has(order.status)) {
      return { broadcast: false, status: order.status };
    }

    // Расстояние до точки заказа — приходит вместе с позицией для UX-индикатора
    const distanceKm =
      order.latitude && order.longitude
        ? calculateDistance(order.latitude, order.longitude, coords.latitude, coords.longitude)
        : null;

    eventBus.emit(orderId, 'master_location', {
      orderId,
      masterId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      heading: coords.heading,
      speed: coords.speed,
      distanceKm,
      timestamp: new Date().toISOString(),
    });

    return { broadcast: true, distanceKm };
  }

  /**
   * Мастер подтверждает выполнение работы
   * RACE-SAFE: $transaction + повторная проверка статуса
   */
  async masterConfirmComplete(orderId: string, masterId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw ApiError.notFound('Заказ не найден');
      if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');
      if (order.status !== OrderStatus.IN_PROGRESS) throw ApiError.badRequest('Заказ не в статусе «В работе»');
      if (order.masterConfirmedAt) throw ApiError.badRequest('Вы уже подтвердили выполнение');

      return tx.order.update({
        where: { id: orderId },
        data: { masterConfirmedAt: new Date() },
      });
    });

    logger.info({ orderId, masterId }, 'Мастер подтвердил выполнение');

    // SSE: уведомляем обоих — мастер подтвердил, клиенту нужно подтвердить тоже
    eventBus.emit(orderId, 'master_confirmed', {
      orderId,
      masterId,
      masterConfirmedAt: result.masterConfirmedAt,
      clientConfirmedAt: result.clientConfirmedAt,
      timestamp: new Date().toISOString(),
    });

    // Если клиент уже подтвердил — завершаем и выплачиваем
    if (result.clientConfirmedAt) {
      return this.finalizeOrder(orderId);
    }

    // Запускаем таймер автоподтверждения клиентом (1 час)
    this.scheduleAutoConfirm(orderId);
    return result;
  }

  /**
   * Клиент подтверждает завершение работы
   * RACE-SAFE: $transaction + повторная проверка статуса
   */
  async clientConfirmComplete(orderId: string, clientId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw ApiError.notFound('Заказ не найден');
      if (order.clientId !== clientId) throw ApiError.forbidden('Только владелец может подтвердить');
      if (order.status !== OrderStatus.IN_PROGRESS) throw ApiError.badRequest('Заказ не в статусе «В работе»');
      if (order.clientConfirmedAt) throw ApiError.badRequest('Вы уже подтвердили завершение');

      return tx.order.update({
        where: { id: orderId },
        data: { clientConfirmedAt: new Date() },
      });
    });

    logger.info({ orderId, clientId }, 'Клиент подтвердил завершение');

    // SSE: уведомляем обоих — клиент подтвердил
    eventBus.emit(orderId, 'client_confirmed', {
      orderId,
      clientId,
      masterConfirmedAt: result.masterConfirmedAt,
      clientConfirmedAt: result.clientConfirmedAt,
      timestamp: new Date().toISOString(),
    });

    // Если мастер уже подтвердил — завершаем и выплачиваем
    if (result.masterConfirmedAt) {
      return this.finalizeOrder(orderId);
    }

    return result;
  }

  /**
   * Финализация заказа: оба подтвердили → COMPLETED + выплата
   * Атомарная транзакция: статус + выплата мастеру + счётчик
   */
  private async finalizeOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, escrowAmount: true, clientId: true, masterId: true,
        price: true, commissionAmount: true, visitFee: true,
      },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.masterId) throw ApiError.badRequest('Мастер не назначен');

    const escrow = toNum(order.escrowAmount);
    const commission = toNum(order.commissionAmount);
    const masterPayout = moneySub(escrow, commission);

    await prisma.$transaction(async (tx) => {
      // 1. Обновляем статус заказа
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          escrowAmount: 0,
          commissionPaid: true,
        },
      });

      // 2. Начисляем мастеру (если есть что начислять)
      if (escrow > 0) {
        const master = await tx.user.findUnique({
          where: { id: order.masterId! },
          select: { balance: true },
        });
        if (!master) throw ApiError.notFound('Мастер не найден');

        const masterBalanceBefore = toNum(master.balance);
        const masterBalanceAfter = moneyAdd(masterBalanceBefore, masterPayout);

        await Promise.all([
          tx.user.update({
            where: { id: order.masterId! },
            data: { balance: masterBalanceAfter },
          }),
          tx.balanceTransaction.create({
            data: {
              userId: order.masterId!,
              type: 'PAYOUT',
              amount: masterPayout,
              balanceBefore: masterBalanceBefore,
              balanceAfter: masterBalanceAfter,
              orderId,
              description: 'Оплата за выполненный заказ',
            },
          }),
          tx.balanceTransaction.create({
            data: {
              userId: order.masterId!,
              type: 'COMMISSION',
              amount: -commission,
              balanceBefore: masterBalanceAfter,
              balanceAfter: masterBalanceAfter,
              orderId,
              description: `Комиссия платформы (${commission} сум)`,
            },
          }),
        ]);
      }

      // 3. Обновляем счётчик завершённых заказов
      if (order.masterId) {
        await tx.masterProfile.update({
          where: { userId: order.masterId },
          data: { completedOrders: { increment: 1 } },
        });
      }
    });

    logger.info({ orderId, masterPayout, commission }, 'Заказ финализирован, средства переведены');

    await auditService.log({
      actorId: order.masterId!,
      action: 'order_finalized',
      entityType: 'order',
      entityId: orderId,
      details: { masterPayout, commission, escrow: toNum(order.escrowAmount), clientId: order.clientId },
    });

    // SSE: заказ завершён, средства переведены
    eventBus.emit(orderId, 'order_completed', {
      orderId,
      masterId: order.masterId,
      clientId: order.clientId,
      masterPayout,
      commission,
      timestamp: new Date().toISOString(),
    });

    // Customer Risk Score: пересчёт после успешного завершения
    void recalcCustomerRisk(order.clientId);

    return { orderId };
  }

  /**
   * Авто-подтверждение через 1 час
   */
  private scheduleAutoConfirm(orderId: string) {
    setTimeout(async () => {
      try {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        if (order.status === OrderStatus.IN_PROGRESS && order.masterConfirmedAt && !order.clientConfirmedAt) {
          logger.info({ orderId }, 'Авто-подтверждение клиентом (таймаут 1 час)');
          await prisma.order.update({
            where: { id: orderId },
            data: { clientConfirmedAt: new Date() },
          });
          await this.finalizeOrder(orderId);
        }
      } catch (error) {
        logger.error({ error, orderId }, 'Ошибка авто-подтверждения');
      }
    }, AUTO_CONFIRM_TIMEOUT_MS);
  }

  /**
   * Отмена заказа с системой штрафов
   */
  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw ApiError.badRequest('Заказ уже завершён или отменён');
    }

    const isClient = order.clientId === userId;
    const isMaster = order.masterId === userId;
    if (!isClient && !isMaster) throw ApiError.forbidden('Нет прав для отмены');

    let penaltyAmount = 0;
    const cancelledBy = isClient ? 'CLIENT' : 'MASTER';

    if (isClient) {
      switch (order.status) {
        case OrderStatus.PUBLISHED: penaltyAmount = 0; break;
        case OrderStatus.ACCEPTED: penaltyAmount = PENALTY_AFTER_ACCEPT; break;
        case OrderStatus.IN_TRANSIT:
        case OrderStatus.IN_PROGRESS: penaltyAmount = PENALTY_AFTER_TRANSIT; break;
        default: penaltyAmount = 0;
      }
    } else if (isMaster && order.status !== OrderStatus.PUBLISHED) {
      penaltyAmount = PENALTY_MASTER_CANCEL;
    }

    // ─── Атомарная транзакция: отмена + возврат эскроу + штраф ────
    await prisma.$transaction(async (tx) => {
      // 1. Обновляем статус заказа
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason || null,
          cancelledBy,
          penaltyAmount,
        },
      });

      // 2. Возвращаем эскроу клиенту
      const escrowAmt = toNum(order.escrowAmount);
      if (escrowAmt > 0) {
        const client = await tx.user.findUnique({
          where: { id: order.clientId },
          select: { balance: true },
        });
        if (client) {
          const balBefore = toNum(client.balance);
          const balAfter = moneyAdd(balBefore, escrowAmt);
          await Promise.all([
            tx.user.update({
              where: { id: order.clientId },
              data: { balance: balAfter },
            }),
            tx.balanceTransaction.create({
              data: {
                userId: order.clientId,
                type: 'REFUND',
                amount: escrowAmt,
                balanceBefore: balBefore,
                balanceAfter: balAfter,
                orderId,
                description: 'Возврат средств при отмене заказа',
              },
            }),
            tx.order.update({
              where: { id: orderId },
              data: { escrowAmount: 0 },
            }),
          ]);
        }
      }

      // 3. Списываем штраф (если есть)
      if (penaltyAmount > 0) {
        const penaltyUser = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        if (penaltyUser) {
          const pBefore = toNum(penaltyUser.balance);
          const pAfter = moneySub(pBefore, penaltyAmount);
          await Promise.all([
            tx.user.update({
              where: { id: userId },
              data: { balance: pAfter },
            }),
            tx.balanceTransaction.create({
              data: {
                userId,
                type: 'PENALTY',
                amount: -penaltyAmount,
                balanceBefore: pBefore,
                balanceAfter: pAfter,
                orderId,
                description: `Штраф за отмену (${cancelledBy === 'CLIENT' ? 'клиент' : 'мастер'}): ${penaltyAmount.toLocaleString('ru')} сум`,
              },
            }),
          ]);
        }
      }
    });

    logger.info({ orderId, userId, cancelledBy, penaltyAmount }, 'Заказ отменён');

    await auditService.log({
      actorId: userId,
      action: 'order_cancelled',
      entityType: 'order',
      entityId: orderId,
      details: { cancelledBy, penaltyAmount, reason, escrowRefunded: toNum(order.escrowAmount) },
    });

    // Customer Risk Score: пересчёт после отмены (не блокирует основной флоу)
    void recalcCustomerRisk(order.clientId);

    // Fraud-скан того, кто отменил (мастер с серией отмен = красный флаг)
    void safeScanFraud(userId);

    return { orderId, cancelledBy, penaltyAmount, reason };
  }

  /**
   * Открытие спора
   */
  async disputeOrder(orderId: string, clientId: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.clientId !== clientId) throw ApiError.forbidden('Только клиент может открыть спор');

    if (![OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED].includes(order.status as any)) {
      throw ApiError.badRequest('Спор можно открыть только для заказов в работе или завершённых');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DISPUTED, disputeReason: reason },
    });

    logger.info({ orderId, clientId, reason }, 'Спор открыт');

    await auditService.log({
      actorId: clientId,
      action: 'dispute_opened',
      entityType: 'order',
      entityId: orderId,
      details: { reason },
    });

    // Customer Risk Score: пересчёт после открытия спора
    void recalcCustomerRisk(clientId);

    // Fraud-скан клиента: серия споров — повод присмотреться
    void safeScanFraud(clientId);

    return updatedOrder;
  }

  /**
   * Разрешение спора (администратор)
   */
  async resolveDispute(orderId: string, adminId: string, resolution: string, note?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.status !== OrderStatus.DISPUTED) throw ApiError.badRequest('Заказ не в статусе спора');

    switch (resolution) {
      case 'refund_client':
        await prisma.$transaction(async (tx) => {
          // Возврат эскроу
          const escrowAmt = toNum(order.escrowAmount);
          if (escrowAmt > 0) {
            const client = await tx.user.findUnique({ where: { id: order.clientId }, select: { balance: true } });
            if (client) {
              const balBefore = toNum(client.balance);
              const balAfter = moneyAdd(balBefore, escrowAmt);
              await Promise.all([
                tx.user.update({ where: { id: order.clientId }, data: { balance: balAfter } }),
                tx.balanceTransaction.create({
                  data: { userId: order.clientId, type: 'REFUND', amount: escrowAmt, balanceBefore: balBefore, balanceAfter: balAfter, orderId, description: 'Возврат по спору (в пользу клиента)' },
                }),
              ]);
            }
          }
          await tx.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: note || 'Спор решён в пользу клиента', cancelledBy: 'ADMIN', escrowAmount: 0 },
          });
        });
        break;

      case 'pay_master':
        await prisma.$transaction(async (tx) => {
          const escrow = toNum(order.escrowAmount);
          const commission = toNum(order.commissionAmount);
          const masterPayout = moneySub(escrow, commission);

          if (escrow > 0 && order.masterId) {
            const master = await tx.user.findUnique({ where: { id: order.masterId }, select: { balance: true } });
            if (master) {
              const balBefore = toNum(master.balance);
              const balAfter = moneyAdd(balBefore, masterPayout);
              await Promise.all([
                tx.user.update({ where: { id: order.masterId }, data: { balance: balAfter } }),
                tx.balanceTransaction.create({
                  data: { userId: order.masterId, type: 'PAYOUT', amount: masterPayout, balanceBefore: balBefore, balanceAfter: balAfter, orderId, description: 'Оплата по спору (в пользу мастера)' },
                }),
                tx.balanceTransaction.create({
                  data: { userId: order.masterId, type: 'COMMISSION', amount: -commission, balanceBefore: balAfter, balanceAfter: balAfter, orderId, description: `Комиссия платформы (${commission} сум)` },
                }),
              ]);
            }
          }
          await tx.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.COMPLETED, completedAt: new Date(), escrowAmount: 0, commissionPaid: true },
          });
          if (order.masterId) {
            await tx.masterProfile.update({
              where: { userId: order.masterId },
              data: { completedOrders: { increment: 1 } },
            });
          }
        });
        break;

      case 'split':
        if (toNum(order.escrowAmount) > 0 && order.masterId) {
          const half = moneyDiv(toNum(order.escrowAmount), 2);
          await prisma.$transaction(async (tx) => {
            const client = await tx.user.findUnique({ where: { id: order.clientId }, select: { balance: true } });
            const master = await tx.user.findUnique({ where: { id: order.masterId! }, select: { balance: true } });
            if (client) {
              const clientBal = toNum(client.balance);
              await tx.user.update({ where: { id: order.clientId }, data: { balance: { increment: half } } });
              await tx.balanceTransaction.create({
                data: { userId: order.clientId, type: 'REFUND', amount: half, balanceBefore: clientBal, balanceAfter: moneyAdd(clientBal, half), orderId, description: 'Возврат 50% по спору' },
              });
            }
            if (master) {
              const masterBal = toNum(master.balance);
              await tx.user.update({ where: { id: order.masterId! }, data: { balance: { increment: half } } });
              await tx.balanceTransaction.create({
                data: { userId: order.masterId!, type: 'PAYOUT', amount: half, balanceBefore: masterBal, balanceAfter: moneyAdd(masterBal, half), orderId, description: 'Оплата 50% по спору' },
              });
            }
            await tx.order.update({ where: { id: orderId }, data: { escrowAmount: 0, status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: note || 'Спор 50/50', cancelledBy: 'ADMIN' } });
          });
        }
        break;

      default:
        throw ApiError.badRequest('Неверный тип решения');
    }

    logger.info({ orderId, adminId, resolution }, 'Спор разрешён');

    await auditService.log({
      actorId: adminId,
      action: 'dispute_resolved',
      entityType: 'order',
      entityId: orderId,
      details: { resolution, note, escrow: toNum(order.escrowAmount), masterId: order.masterId, clientId: order.clientId },
    });

    return { orderId, resolution, note };
  }

  /**
   * Завершение заказа (обратная совместимость)
   */
  async completeOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');

    if (order.masterId === userId) {
      return this.masterConfirmComplete(orderId, userId);
    } else if (order.clientId === userId) {
      return this.clientConfirmComplete(orderId, userId);
    }

    throw ApiError.forbidden('Нет прав для завершения заказа');
  }

  /**
   * Заказы клиента
   */
  async getClientOrders(clientId: string, status?: string) {
    const where: Prisma.OrderWhereInput = { clientId };
    if (status) where.status = status as OrderStatus;

    return prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        master: { include: { profile: true } },
        orderTasks: { include: { task: true } },
        _count: { select: { responses: true } },
      },
    });
  }

  /**
   * Заказы мастера (назначенные)
   */
  async getMasterOrders(masterId: string, status?: string) {
    const where: Prisma.OrderWhereInput = { masterId };
    if (status) where.status = status as OrderStatus;

    return prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        client: { include: { profile: true } },
        orderTasks: { include: { task: true } },
        _count: { select: { responses: true } },
      },
    });
  }
}

export const ordersService = new OrdersService();
