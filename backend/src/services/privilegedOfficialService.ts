// ============================================
// MasterUz — Privileged Officials Management Service
// Система привилегий, мотивации и KPI для чиновников и руководителей
// ============================================

import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import {
  PrivilegeStatus,
  PrivilegeType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from 'decimal.js';

interface CreatePrivilegedOfficialInput {
  userId: string;
  organizationName: string;
  position: string;
  privilegeType: PrivilegeType;
  documentNumber?: string;
  documentUrl?: string;
  expiresAt?: Date;
}

interface UpdateOfficialStatusInput {
  officialId: string;
  status: PrivilegeStatus;
  statusReason?: string;
  approvedBy: string;
}

interface FastTrackOrderInput {
  officialId: string;
  orderId: string;
  reason: string;
  actorIp?: string;
  actorUserAgent?: string;
}

interface SetOrderPriorityInput {
  officialId: string;
  orderId: string;
  priorityLevel: number; // 1..3
  reason?: string;
  customSlaHours?: number;
  bonusAmount?: Decimal;
}

interface KPICalculationInput {
  officialId: string;
  period: string; // '2024-06'
}

export class PrivilegedOfficialService {
  /**
   * Создать профиль привилегированного должностного лица
   */
  async createOfficialProfile(input: CreatePrivilegedOfficialInput) {
    // Проверка что пользователь существует
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new ApiError(404, 'Пользователь не найден');
    }

    // Проверка что этот пользователь уже не имеет привилегии
    const existing = await prisma.privilegedOfficialProfile.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      throw new ApiError(409, 'Этот пользователь уже имеет профиль привилегий');
    }

    // Получить настройки мотивации для этого типа привилегии
    const motivationSetting = await prisma.motivationSetting.findUnique({
      where: { privilegeType: input.privilegeType },
    });

    // Создать профиль
    const profile = await prisma.privilegedOfficialProfile.create({
      data: {
        userId: input.userId,
        organizationName: input.organizationName,
        position: input.position,
        privilegeType: input.privilegeType,
        documentNumber: input.documentNumber,
        documentUrl: input.documentUrl,
        expiresAt: input.expiresAt,
        status: PrivilegeStatus.PENDING,
        targetSlaScore: motivationSetting?.slaThresholdPct || 85.0,
        targetSatisfaction: motivationSetting?.satisfactionMin || 4.0,
        bonusPercentage: motivationSetting?.baseBonusPercentage || 5.0,
        dailyFastTrackLimit: motivationSetting?.fastTrackLimit || 5,
      },
      include: {
        user: { include: { profile: true } },
      },
    });

    // Залогировать создание профиля (аудит)
    await this.logPrivilegedAction({
      officialId: profile.id,
      action: 'PROFILE_CREATED',
      targetEntityType: 'PROFILE',
      targetEntityId: profile.id,
      description: `Создан профиль привилегий для ${input.organizationName}`,
    });

    logger.info(
      `[PrivilegedOfficials] Profile created for ${user.username} (${profile.id})`
    );

    return profile;
  }

  /**
   * Одобрить/отклонить профиль привилегий
   */
  async updateOfficialStatus(input: UpdateOfficialStatusInput) {
    const official = await prisma.privilegedOfficialProfile.findUnique({
      where: { id: input.officialId },
      include: { user: true },
    });
    if (!official) {
      throw new ApiError(404, 'Профиль привилегий не найден');
    }

    const updated = await prisma.privilegedOfficialProfile.update({
      where: { id: input.officialId },
      data: {
        status: input.status,
        statusReason: input.statusReason,
        approvedBy: input.approvedBy,
      },
      include: {
        user: { include: { profile: true } },
      },
    });

    // Залогировать изменение статуса
    await this.logPrivilegedAction({
      officialId: input.officialId,
      action: 'STATUS_CHANGED',
      targetEntityType: 'PROFILE',
      targetEntityId: input.officialId,
      description: `Статус изменён на ${input.status}. ${input.statusReason || ''}`,
    });

    logger.info(
      `[PrivilegedOfficials] Status updated for ${official.user.username}: ${input.status}`
    );

    return updated;
  }

  /**
   * Ускорить заказ (fast-track)
   * Заказ переместится выше в очереди и мастеру отправится уведомление о высоком приоритете
   */
  async fastTrackOrder(input: FastTrackOrderInput) {
    const official = await prisma.privilegedOfficialProfile.findUnique({
      where: { id: input.officialId },
    });
    if (!official) {
      throw new ApiError(404, 'Профиль привилегий не найден');
    }

    // Проверка лимита ускорений за день
    if ((official as any).dailyFastTrackUsed >= (official as any).dailyFastTrackLimit) {
      throw new ApiError(
        429,
        `Лимит ускорений за день исчерпан (${(official as any).dailyFastTrackLimit})`
      );
    }

    // Проверка статуса привилегии
    if (official.status !== PrivilegeStatus.ACTIVE) {
      throw new ApiError(403, 'Эта привилегия не активна');
    }

    // Проверка что привилегия позволяет ускорение
    if (!(official as any).canFastTrack) {
      throw new ApiError(403, 'Эта привилегия не позволяет ускорение');
    }

    // Получить заказ
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new ApiError(404, 'Заказ не найден');
    }

    // Обновить счётчик ускорений
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dailyUsed = (official as any).dailyFastTrackUsed;
    let resetAt = (official as any).dailyFastTrackResetAt;

    if (resetAt && resetAt < today) {
      // Сброс счётчика, если прошел день
      dailyUsed = 1;
      resetAt = tomorrow;
    } else {
      dailyUsed++;
    }

    await prisma.privilegedOfficialProfile.update({
      where: { id: input.officialId },
      data: {
        dailyFastTrackUsed: dailyUsed,
        dailyFastTrackResetAt: resetAt,
      },
    });

    // Залогировать действие
    await this.logPrivilegedAction({
      officialId: input.officialId,
      action: 'FAST_TRACKED',
      targetEntityType: 'ORDER',
      targetEntityId: input.orderId,
      description: `Заказ ускорен. Причина: ${input.reason}`,
      metadata: {
        orderId: input.orderId,
        reason: input.reason,
        dailyUsedBefore: (official as any).dailyFastTrackUsed,
        dailyUsedAfter: dailyUsed,
      },
      ipAddress: input.actorIp,
      userAgent: input.actorUserAgent,
    });

    logger.info(
      `[PrivilegedOfficials] Order ${input.orderId} fast-tracked by ${official.userId}`
    );

    return { success: true, message: 'Заказ ускорен' };
  }

  /**
   * Установить приоритет заказу
   */
  async setOrderPriority(input: SetOrderPriorityInput) {
    const official = await prisma.privilegedOfficialProfile.findUnique({
      where: { id: input.officialId },
    });
    if (!official) {
      throw new ApiError(404, 'Профиль привилегий не найден');
    }

    if (official.status !== PrivilegeStatus.ACTIVE) {
      throw new ApiError(403, 'Эта привилегия не активна');
    }

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new ApiError(404, 'Заказ не найден');
    }

    // Проверка что официальное лицо может переопределять SLA
    if (input.customSlaHours && !(official as any).canOverrideSla) {
      throw new ApiError(
        403,
        'Эта привилегия не позволяет переопределять SLA'
      );
    }

    // Создать или обновить приоритет
    const priority = await prisma.officialOrderPriority.upsert({
      where: {
        orderId_officialId: {
          orderId: input.orderId,
          officialId: input.officialId,
        },
      },
      update: {
        priorityLevel: input.priorityLevel,
        reason: input.reason,
        customSlaHours: input.customSlaHours,
        bonusAmount: input.bonusAmount,
      },
      create: {
        orderId: input.orderId,
        officialId: input.officialId,
        priorityLevel: input.priorityLevel,
        reason: input.reason,
        customSlaHours: input.customSlaHours,
        bonusAmount: input.bonusAmount,
      },
    });

    // Залогировать
    await this.logPrivilegedAction({
      officialId: input.officialId,
      action: 'PRIORITY_SET',
      targetEntityType: 'ORDER',
      targetEntityId: input.orderId,
      description: `Приоритет установлен на уровень ${input.priorityLevel}`,
      metadata: {
        orderId: input.orderId,
        priorityLevel: input.priorityLevel,
        customSlaHours: input.customSlaHours,
        bonusAmount: input.bonusAmount?.toFixed(2),
      },
    });

    logger.info(
      `[PrivilegedOfficials] Priority ${input.priorityLevel} set for order ${input.orderId}`
    );

    return priority;
  }

  /**
   * Получить профиль официального лица с KPI и статистикой
   */
  async getOfficialProfile(officialId: string) {
    const official = await prisma.privilegedOfficialProfile.findUnique({
      where: { id: officialId },
      include: {
        user: {
          include: {
            profile: true,
            clientOrders: {
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        kpiRecords: {
          orderBy: { period: 'desc' },
          take: 12,
        },
        orderPriorities: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!official) {
      throw new ApiError(404, 'Профиль привилегий не найден');
    }

    // Получить текущий месяц KPI (если нет - вернуть нули)
    const today = new Date();
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const currentKpi =
      official.kpiRecords.find((k: any) => k.period === period) ||
      this.getDefaultKPI(official.id, period);

    return {
      ...official,
      currentKpi,
    };
  }

  /**
   * Список всех привилегированных лиц (для админ-панели)
   */
  async listOfficials(filters?: {
    status?: PrivilegeStatus;
    privilegeType?: PrivilegeType;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PrivilegedOfficialProfileWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.privilegeType) {
      where.privilegeType = filters.privilegeType;
    }

    if (filters?.search) {
      where.OR = [
        { organizationName: { contains: filters.search, mode: 'insensitive' } },
        { user: { username: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [officials, total] = await Promise.all([
      prisma.privilegedOfficialProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { include: { profile: true } },
          kpiRecords: {
            where: { status: 'FINAL' },
            orderBy: { period: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.privilegedOfficialProfile.count({ where }),
    ]);

    return {
      data: officials,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить историю действий привилегированного лица
   */
  async getActionHistory(
    officialId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const limit = Math.min(options?.limit || 50, 500);
    const offset = options?.offset || 0;

    const actions = await prisma.privilegedAction.findMany({
      where: { officialId: officialId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.privilegedAction.count({
      where: { officialId: officialId },
    });

    return { actions, total };
  }

  /**
   * Внутренняя функция: залогировать действие привилегированного лица
   */
  private async logPrivilegedAction(input: {
    officialId: string;
    action: string;
    targetEntityType: string;
    targetEntityId: string;
    description?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await prisma.privilegedAction.create({
        data: {
          officialId: input.officialId,
          action: input.action,
          targetEntityType: input.targetEntityType,
          targetEntityId: input.targetEntityId,
          description: input.description,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      logger.error('[PrivilegedOfficials] Failed to log action:', error);
    }
  }

  /**
   * Расчёт KPI за период
   */
  async calculateKPI(input: KPICalculationInput) {
    const official = await prisma.privilegedOfficialProfile.findUnique({
      where: { id: input.officialId },
    });
    if (!official) {
      throw new ApiError(404, 'Профиль привилегий не найден');
    }

    // Разбить период на дату начала и конца
    const [year, month] = input.period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Получить все заказы от клиентов этого официального лица за период
    // (предполагается что заказы связаны с организацией в поле city/district)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        status: OrderStatus.COMPLETED,
        // Фильтр по городу/округу чиновника (упрощённо)
        city: (official as any).organizationName,
      },
    });

    const totalOrders = orders.length;
    const onTimeOrders = orders.filter((o: any) => {
      const completionTime = o.completedAt
        ? o.completedAt.getTime() - o.createdAt.getTime()
        : 0;
      const slaHours = 24 * 3600 * 1000; // 24 часа
      return completionTime <= slaHours;
    }).length;

    const slaScore =
      totalOrders > 0 ? (onTimeOrders / totalOrders) * 100 : 0;

    // Получить отзывы и оценки
    const reviews = await prisma.review.findMany({
      where: {
        order: {
          createdAt: { gte: startDate, lt: endDate },
        },
      },
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : 0;

    // Рассчитать бонус
    const bonusEarned =
      slaScore >= (official as any).targetSlaScore
        ? new Decimal((official as any).monthlyBonusPool)
            .mul(((official as any).bonusPercentage || 0) / 100)
            .toDecimalPlaces(2)
        : new Decimal(0);

    // Сохранить KPI запись
    const kpiRecord = await prisma.kPIRecord.upsert({
      where: {
        officialId_period: {
          officialId: input.officialId,
          period: input.period,
        },
      },
      update: {
        totalOrders: totalOrders,
        onTimeOrders: onTimeOrders,
        slaScore: slaScore,
        avgRating: avgRating,
        ratingCount: reviews.length,
        bonusEarned: bonusEarned,
        status: 'FINAL',
      },
      create: {
        officialId: input.officialId,
        period: input.period,
        totalOrders: totalOrders,
        onTimeOrders: onTimeOrders,
        slaScore: slaScore,
        avgRating: avgRating,
        ratingCount: reviews.length,
        bonusEarned: bonusEarned,
      },
    });

    logger.info(
      `[PrivilegedOfficials] KPI calculated for period ${input.period}: SLA=${slaScore.toFixed(2)}%`
    );

    return kpiRecord;
  }

  /**
   * Вспомогательная функция для пустого KPI
   */
  private getDefaultKPI(officialId: string, period: string) {
    return {
      id: '',
      officialId,
      period,
      totalOrders: 0,
      onTimeOrders: 0,
      slaScore: 0,
      avgRating: 0,
      ratingCount: 0,
      totalComplaints: 0,
      resolvedComplaints: 0,
      avgResolutionDays: 0,
      totalOrderAmount: new Decimal(0),
      savings: new Decimal(0),
      bonusEarned: new Decimal(0),
      status: 'PRELIMINARY',
      lockedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export const privilegedOfficialService = new PrivilegedOfficialService();
