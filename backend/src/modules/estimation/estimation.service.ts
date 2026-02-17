// ============================================
// MasterUz — Estimation Service
// Выезд мастера на оценку + составление сметы
// Защита от обхода комиссии
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { balanceService } from '../balance/balance.service.js';
import { notificationService } from '../../services/notificationService.js';
import { OrderStatus, EstimateStatus } from '@prisma/client';

// ─── Конфигурация оценки ─────────────────────
const ESTIMATION_FEE = 150000;           // Фиксированная цена выезда: 150 000 сум
const ESTIMATION_COMMISSION_RATE = 20;    // Комиссия платформы: 20%
const MASTER_ESTIMATION_SHARE = 0.80;     // Мастер получает 80% = 120 000 сум
const ESTIMATION_TIMER_MINUTES = 120;     // Таймер на прибытие: 2 часа

export class EstimationService {
  /**
   * Создание заказа на оценку клиентом
   * Фиксированная цена 150 000 сум, блокируется на балансе
   */
  async createEstimationOrder(clientId: string, data: {
    categoryId: string;
    title: string;
    description: string;
    address: string;
    city?: string;
    district?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    images: string[];
    scheduledDate?: string;  // Если клиент выбирает другой день
    scheduledTime?: string;  // Точное время
  }) {
    // Проверяем категорию
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || !category.isActive) {
      throw ApiError.badRequest('Категория не найдена или неактивна');
    }

    // Проверяем что фото приложены
    if (!data.images || data.images.length === 0) {
      throw ApiError.badRequest('Необходимо приложить фото объекта (минимум 1)');
    }

    // Получаем конфиг из БД (или берём значения по умолчанию)
    const [feeConfig, commConfig] = await Promise.all([
      prisma.platformConfig.findUnique({ where: { key: 'estimation_fee' } }),
      prisma.platformConfig.findUnique({ where: { key: 'estimation_commission_rate' } }),
    ]);
    const estimationFee = feeConfig ? parseFloat(feeConfig.value) : ESTIMATION_FEE;
    const commissionRate = commConfig ? parseFloat(commConfig.value) : ESTIMATION_COMMISSION_RATE;
    const commissionAmount = estimationFee * (commissionRate / 100);

    // Проверяем баланс клиента
    const clientBalance = await balanceService.getBalance(clientId);
    if (clientBalance < estimationFee) {
      throw ApiError.badRequest(
        `Недостаточно средств. Баланс: ${clientBalance.toLocaleString('ru')} сум, ` +
        `необходимо: ${estimationFee.toLocaleString('ru')} сум`
      );
    }

    // Блокируем средства на балансе
    await balanceService.holdFunds(clientId, estimationFee, 'pending');

    try {
      // Создаём заказ на оценку
      const order = await prisma.order.create({
        data: {
          clientId,
          categoryId: data.categoryId,
          title: `🔍 Выезд на оценку: ${data.title}`,
          description: data.description,
          price: estimationFee,
          commissionRate,
          commissionAmount,
          estimationFee,
          escrowAmount: estimationFee,
          isEstimationOrder: true,
          offerAccepted: true,
          status: OrderStatus.PUBLISHED,
          address: data.address,
          city: data.city,
          district: data.district,
          region: data.region,
          latitude: data.latitude,
          longitude: data.longitude,
          images: data.images,
          deadline: data.scheduledDate ? new Date(data.scheduledDate) : null,
        },
        include: {
          category: true,
          client: { include: { profile: true } },
        },
      });

      // Обновляем orderId в транзакции эскроу
      await prisma.balanceTransaction.updateMany({
        where: { userId: clientId, orderId: 'pending', type: 'ESCROW_HOLD' },
        data: { orderId: order.id },
      });

      logger.info(
        { orderId: order.id, clientId, estimationFee },
        'Заказ на оценку создан, средства заблокированы'
      );

      // Уведомляем мастеров с подходящими категориями
      this.notifyRelevantMasters(order.id, data.categoryId).catch(err => {
        logger.error({ error: err }, 'Ошибка уведомления мастеров об оценке');
      });

      return order;
    } catch (error) {
      // Откатываем блокировку при ошибке
      await prisma.user.update({
        where: { id: clientId },
        data: { balance: { increment: estimationFee } },
      });
      throw error;
    }
  }

  /**
   * Мастер принимает заказ на оценку
   * Платит свои 20% комиссии → получает контакты и адрес
   */
  async acceptEstimation(orderId: string, masterId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { client: { include: { profile: true } } },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.isEstimationOrder) throw ApiError.badRequest('Это не заказ на оценку');
    if (order.status !== OrderStatus.PUBLISHED) throw ApiError.badRequest('Заказ уже принят');
    if (order.clientId === masterId) throw ApiError.badRequest('Нельзя принять свой заказ');

    // Проверяем мастерский профиль
    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
    });
    if (!masterProfile) throw ApiError.badRequest('Только мастера могут принимать заказы');
    if (!masterProfile.registrationPaid) throw ApiError.forbidden('Оплатите регистрационный взнос');

    // Мастер платит комиссию (20% от стоимости выезда)
    const masterCommission = order.commissionAmount;
    const masterBalance = await balanceService.getBalance(masterId);
    if (masterBalance < masterCommission) {
      throw ApiError.badRequest(
        `Недостаточно средств для принятия. Нужно: ${masterCommission.toLocaleString('ru')} сум`
      );
    }

    // Списываем комиссию с мастера
    await balanceService.chargeCommission(masterId, masterCommission, orderId);

    // Обновляем статус
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        masterId,
        status: OrderStatus.ESTIMATION_IN_PROGRESS,
        acceptedAt: new Date(),
        commissionPaid: true,
      },
      include: {
        master: { include: { profile: true } },
        client: { include: { profile: true } },
        category: true,
      },
    });

    logger.info({ orderId, masterId, commission: masterCommission }, 'Мастер принял оценку');

    // Уведомление клиенту
    await notificationService.createNotification({
      userId: order.clientId,
      type: 'ESTIMATION_ACCEPTED',
      title: '🔍 Мастер принял заказ на оценку',
      message: `Мастер ${updatedOrder.master?.profile?.firstName || 'Мастер'} едет к вам на оценку.`,
      data: { orderId },
    });

    return updatedOrder;
  }

  /**
   * Мастер создаёт смету прямо на месте
   */
  async createEstimate(orderId: string, masterId: string, data: {
    workItems: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    materialItems: Array<{ name: string; quantity: number; unit: string; unitPrice: number; total: number }>;
    estimatedDays?: number;
    notes?: string;
    photos: string[];
    videos?: string[];
  }) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.isEstimationOrder) throw ApiError.badRequest('Это не заказ на оценку');
    if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');
    if (order.status !== OrderStatus.ESTIMATION_IN_PROGRESS) {
      throw ApiError.badRequest('Заказ не в статусе оценки');
    }

    // Считаем итоги
    const workTotal = data.workItems.reduce((sum, item) => sum + item.total, 0);
    const materialTotal = data.materialItems.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = workTotal + materialTotal;

    if (totalAmount <= 0) {
      throw ApiError.badRequest('Общая сумма сметы должна быть больше 0');
    }

    // Создаём смету
    const estimate = await prisma.estimate.create({
      data: {
        orderId,
        masterId,
        status: EstimateStatus.DRAFT,
        workItems: data.workItems,
        materialItems: data.materialItems,
        workTotal,
        materialTotal,
        totalAmount,
        estimatedDays: data.estimatedDays,
        notes: data.notes,
        photos: data.photos,
        videos: data.videos || [],
      },
    });

    // Обновляем статус заказа
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.ESTIMATION_DONE },
    });

    logger.info({ orderId, estimateId: estimate.id, totalAmount }, 'Смета создана');
    return estimate;
  }

  /**
   * Мастер отправляет смету клиенту
   */
  async sendEstimate(estimateId: string, masterId: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { order: true },
    });
    if (!estimate) throw ApiError.notFound('Смета не найдена');
    if (estimate.masterId !== masterId) throw ApiError.forbidden('Вы не автор этой сметы');
    if (estimate.status !== EstimateStatus.DRAFT) throw ApiError.badRequest('Смета уже отправлена');

    // Обновляем смету и заказ
    const [updatedEstimate] = await prisma.$transaction([
      prisma.estimate.update({
        where: { id: estimateId },
        data: { status: EstimateStatus.SENT, sentAt: new Date() },
      }),
      prisma.order.update({
        where: { id: estimate.orderId },
        data: { status: OrderStatus.ESTIMATE_SENT },
      }),
    ]);

    // Уведомление клиенту
    await notificationService.createNotification({
      userId: estimate.order.clientId,
      type: 'ESTIMATE_RECEIVED',
      title: '📋 Мастер составил смету',
      message: `Смета на сумму ${estimate.totalAmount.toLocaleString('ru')} сум. Проверьте в заказе.`,
      data: { orderId: estimate.orderId, estimateId },
    });

    logger.info({ estimateId, orderId: estimate.orderId }, 'Смета отправлена клиенту');
    return updatedEstimate;
  }

  /**
   * Клиент одобряет смету → оплачивает полную сумму → модерация
   */
  async approveEstimate(estimateId: string, clientId: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { order: true },
    });
    if (!estimate) throw ApiError.notFound('Смета не найдена');
    if (estimate.order.clientId !== clientId) throw ApiError.forbidden('Только клиент может одобрить смету');
    if (estimate.status !== EstimateStatus.SENT) throw ApiError.badRequest('Смета не в статусе ожидания');

    // Клиент оплачивает полную сумму сметы
    const clientBalance = await balanceService.getBalance(clientId);
    if (clientBalance < estimate.totalAmount) {
      throw ApiError.badRequest(
        `Недостаточно средств. Баланс: ${clientBalance.toLocaleString('ru')} сум, ` +
        `необходимо: ${estimate.totalAmount.toLocaleString('ru')} сум`
      );
    }

    // Блокируем сумму сметы
    await balanceService.holdFunds(clientId, estimate.totalAmount, estimate.orderId);

    // Обновляем статусы → модерация
    await prisma.$transaction([
      prisma.estimate.update({
        where: { id: estimateId },
        data: {
          status: EstimateStatus.MODERATION,
          clientResponseAt: new Date(),
        },
      }),
      prisma.order.update({
        where: { id: estimate.orderId },
        data: {
          status: OrderStatus.MODERATION,
          escrowAmount: { increment: estimate.totalAmount },
        },
      }),
    ]);

    // Уведомить админов/менеджеров
    await this.notifyModeration(estimate.orderId, estimateId);

    logger.info({ estimateId, totalAmount: estimate.totalAmount }, 'Клиент одобрил смету → модерация');
    return { success: true, message: 'Смета одобрена, ожидается модерация' };
  }

  /**
   * Клиент отказывается от сметы → закрываем заказ оценки
   * Мастер получает 120 000 сум за выезд
   */
  async rejectEstimate(estimateId: string, clientId: string, reason?: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { order: true },
    });
    if (!estimate) throw ApiError.notFound('Смета не найдена');
    if (estimate.order.clientId !== clientId) throw ApiError.forbidden('Только клиент может отклонить смету');
    if (estimate.status !== EstimateStatus.SENT) throw ApiError.badRequest('Смета не в статусе ожидания');

    const order = estimate.order;
    const masterShare = (order.estimationFee || ESTIMATION_FEE) * MASTER_ESTIMATION_SHARE;

    // Выплачиваем мастеру 80% (120 000 сум)
    if (order.masterId) {
      await this.payMasterForEstimation(order.masterId, masterShare, order.id);
    }

    // Обновляем статусы
    await prisma.$transaction([
      prisma.estimate.update({
        where: { id: estimateId },
        data: {
          status: EstimateStatus.REJECTED,
          clientResponseAt: new Date(),
          rejectionReason: reason,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ESTIMATE_REJECTED,
          completedAt: new Date(),
          escrowAmount: 0,
        },
      }),
    ]);

    // Уведомление мастеру
    await notificationService.createNotification({
      userId: order.masterId!,
      type: 'ESTIMATE_REJECTED',
      title: '❌ Клиент отказался от сметы',
      message: `Оплата за выезд: ${masterShare.toLocaleString('ru')} сум зачислена на баланс.${reason ? ` Причина: ${reason}` : ''}`,
      data: { orderId: order.id },
    });

    logger.info({ estimateId, orderId: order.id, masterShare }, 'Клиент отказался от сметы');
    return { success: true, masterPayment: masterShare };
  }

  /**
   * Модерация: админ/менеджер одобряет смету → создаётся основной заказ
   */
  async moderateEstimate(estimateId: string, adminId: string, approved: boolean, note?: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { order: { include: { category: true } } },
    });
    if (!estimate) throw ApiError.notFound('Смета не найдена');
    if (estimate.status !== EstimateStatus.MODERATION) throw ApiError.badRequest('Смета не на модерации');

    if (approved) {
      // Одобрено → создаём основной заказ на основе сметы
      const order = estimate.order;
      const commissionRate = order.commissionRate;
      const commissionAmount = estimate.totalAmount * (commissionRate / 100);

      // Создаём основной заказ (привязанный к заказу оценки)
      const mainOrder = await prisma.order.create({
        data: {
          clientId: order.clientId,
          masterId: order.masterId,
          categoryId: order.categoryId,
          title: order.title.replace('🔍 Выезд на оценку: ', '🔨 '),
          description: `По смете: ${estimate.notes || order.description}`,
          price: estimate.totalAmount,
          commissionRate,
          commissionAmount,
          escrowAmount: estimate.totalAmount,
          offerAccepted: true,
          status: OrderStatus.ACCEPTED,
          parentOrderId: order.id,
          address: order.address,
          city: order.city,
          district: order.district,
          region: order.region,
          latitude: order.latitude,
          longitude: order.longitude,
          images: [...order.images, ...estimate.photos],
          acceptedAt: new Date(),
          commissionPaid: true,
        },
      });

      // Обновляем смету и заказ оценки
      await prisma.$transaction([
        prisma.estimate.update({
          where: { id: estimateId },
          data: {
            status: EstimateStatus.APPROVED,
            moderatedById: adminId,
            moderatedAt: new Date(),
            moderationNote: note,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ESTIMATE_APPROVED },
        }),
      ]);

      // Оплата мастеру за выезд (из суммы оценки)
      const masterEstimationShare = (order.estimationFee || ESTIMATION_FEE) * MASTER_ESTIMATION_SHARE;
      if (order.masterId) {
        await this.payMasterForEstimation(order.masterId, masterEstimationShare, order.id);
      }

      // Уведомления
      await notificationService.createNotification({
        userId: order.clientId,
        type: 'ESTIMATE_MODERATED',
        title: '✅ Смета одобрена модератором',
        message: `Основной заказ создан. Мастер приступит к работе.`,
        data: { orderId: mainOrder.id, estimateId },
      });
      if (order.masterId) {
        await notificationService.createNotification({
          userId: order.masterId,
          type: 'MAIN_ORDER_CREATED',
          title: '🔨 Основной заказ создан',
          message: `Смета одобрена. Приступайте к работам. Сумма: ${estimate.totalAmount.toLocaleString('ru')} сум`,
          data: { orderId: mainOrder.id, estimateId },
        });
      }

      logger.info({ estimateId, mainOrderId: mainOrder.id }, 'Смета одобрена → основной заказ создан');
      return { approved: true, mainOrderId: mainOrder.id };
    } else {
      // Отклонено модератором → возврат средств
      const order = estimate.order;
      await balanceService.refundFunds(order.id);

      await prisma.$transaction([
        prisma.estimate.update({
          where: { id: estimateId },
          data: {
            status: EstimateStatus.REJECTED,
            moderatedById: adminId,
            moderatedAt: new Date(),
            moderationNote: note,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ESTIMATE_REJECTED },
        }),
      ]);

      await notificationService.createNotification({
        userId: order.clientId,
        type: 'ESTIMATE_REJECTED_MOD',
        title: '❌ Смета отклонена модератором',
        message: `Модератор отклонил смету. ${note || ''} Средства возвращены.`,
        data: { orderId: order.id },
      });

      logger.info({ estimateId, note }, 'Смета отклонена модератором');
      return { approved: false, note };
    }
  }

  /**
   * Получить смету по заказу
   */
  async getEstimateByOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');

    // Проверяем доступ: клиент, мастер или админ
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isParticipant = order.clientId === userId || order.masterId === userId;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

    if (!isParticipant && !isAdmin) {
      throw ApiError.forbidden('Нет доступа к смете');
    }

    const estimates = await prisma.estimate.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        master: {
          select: {
            id: true,
            username: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
            masterProfile: { select: { rating: true, completedOrders: true } },
          },
        },
      },
    });

    return estimates;
  }

  /**
   * Получить все заказы на оценку (для модерации)
   */
  async getEstimationOrders(filters?: { status?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { isEstimationOrder: true };
    if (filters?.status) {
      where.status = filters.status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          client: { include: { profile: true } },
          master: { include: { profile: true } },
          estimates: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { data: orders, total, page, limit };
  }

  /**
   * Получить сметы на модерации
   */
  async getPendingModeration() {
    return prisma.estimate.findMany({
      where: { status: EstimateStatus.MODERATION },
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          include: {
            category: true,
            client: { include: { profile: true } },
            master: { include: { profile: true } },
          },
        },
      },
    });
  }

  // ─── Private helpers ───────────────────────

  /**
   * Выплата мастеру за выезд на оценку (80%)
   */
  private async payMasterForEstimation(masterId: string, amount: number, orderId: string) {
    await prisma.$transaction(async (tx) => {
      const master = await tx.user.findUnique({
        where: { id: masterId },
        select: { balance: true },
      });
      if (!master) return;

      const balanceBefore = master.balance;
      const balanceAfter = balanceBefore + amount;

      await tx.user.update({
        where: { id: masterId },
        data: { balance: balanceAfter },
      });

      await tx.balanceTransaction.create({
        data: {
          userId: masterId,
          type: 'ESTIMATE_PAYOUT',
          amount,
          balanceBefore,
          balanceAfter,
          orderId,
          description: `Оплата за выезд на оценку: ${amount.toLocaleString('ru')} сум`,
        },
      });
    });
  }

  /**
   * Уведомить мастеров с подходящими категориями
   */
  private async notifyRelevantMasters(orderId: string, categoryId: string) {
    const masterCategories = await prisma.masterCategory.findMany({
      where: { categoryId },
      include: {
        masterProfile: {
          include: {
            user: { select: { id: true, telegramId: true, isActive: true } },
          },
        },
      },
    });

    for (const mc of masterCategories) {
      if (!mc.masterProfile.user.isActive) continue;
      if (!mc.masterProfile.registrationPaid) continue;
      if (!mc.masterProfile.isAvailable) continue;

      await notificationService.createNotification({
        userId: mc.masterProfile.user.id,
        type: 'NEW_ESTIMATION_ORDER',
        title: '🔍 Новый заказ на оценку',
        message: 'Клиент ищет мастера для выезда и составления сметы. Фиксированная оплата.',
        data: { orderId },
      });
    }
  }

  /**
   * Уведомить модераторов о новой смете
   */
  private async notifyModeration(orderId: string, estimateId: string) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await notificationService.createNotification({
        userId: admin.id,
        type: 'ESTIMATE_MODERATION',
        title: '📋 Новая смета на модерации',
        message: 'Клиент одобрил смету. Проверьте корректность расчётов.',
        data: { orderId, estimateId },
      });
    }
  }
}

export const estimationService = new EstimationService();
