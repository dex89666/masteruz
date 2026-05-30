// ============================================
// MasterUz — Admin Service
// Агент 9 (Админ-панель разработчик)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../../utils/helpers.js';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { auditService } from '../../services/auditService.js';

export class AdminService {
  /**
   * Дашборд — общая аналитика
   */
  async getDashboard() {
    const [
      totalUsers,
      totalMasters,
      totalClients,
      totalOrders,
      completedOrders,
      activeOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      topMasters,
      recentOrders,
      ordersByStatus,
      registrationFeesPaid,
      unpaidMasters,
      urgentOrders,
      ordersBySource,
      proStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'MASTER' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { amount: true },
      }),
      prisma.masterProfile.findMany({
        take: 10,
        orderBy: { rating: 'desc' },
        include: {
          user: { include: { profile: true } },
        },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { include: { profile: true } },
          master: { include: { profile: true } },
          category: true,
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.masterProfile.count({ where: { registrationPaid: true } }),
      prisma.masterProfile.count({ where: { registrationPaid: false } }),
      prisma.order.count({ where: { isUrgent: true } }),
      prisma.order.groupBy({
        by: ['source'],
        _count: { source: true },
      }),
      this.getProStats(),
    ]);

    return {
      stats: {
        totalUsers,
        totalMasters,
        totalClients,
        totalOrders,
        completedOrders,
        activeOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
        todayOrders,
        todayRevenue: todayRevenue._sum.amount || 0,
        registrationFeesPaid,
        unpaidMasters,
        urgentOrders,
        proActive: proStats.active,
        proTrial: proStats.trial,
        proRevenue: proStats.revenue,
        proFounderUsed: proStats.founderUsed,
      },
      topMasters,
      recentOrders,
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      ordersBySource: ordersBySource.map((item) => ({
        source: item.source,
        count: item._count.source,
      })),
      proByPlan: proStats.byPlan,
    };
  }

  /**
   * PRO-метрики для дашборда.
   */
  private async getProStats() {
    const now = new Date();
    const [active, trial, byPlan, revenue, founderUsed] = await Promise.all([
      prisma.masterSubscription.count({
        where: { status: 'ACTIVE', currentPeriodEnd: { gt: now }, plan: { notIn: ['TRIAL', 'REFERRAL'] } },
      }),
      prisma.masterSubscription.count({
        where: { status: 'ACTIVE', currentPeriodEnd: { gt: now }, plan: 'TRIAL' },
      }),
      prisma.masterSubscription.groupBy({
        by: ['plan'],
        where: { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
        _count: { plan: true },
      }),
      prisma.masterSubscription.aggregate({
        _sum: { amountPaid: true },
      }),
      prisma.masterSubscription.count({ where: { plan: 'FOUNDER' } }),
    ]);
    return {
      active,
      trial,
      revenue: revenue._sum.amountPaid ?? 0,
      founderUsed,
      byPlan: byPlan.map((r) => ({ plan: r.plan, count: r._count.plan })),
    };
  }

  /**
   * Список пользователей с фильтрами
   */
  async getUsers(filters: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
    isVerified?: boolean;
  }) {
    const { skip, take, page, limit } = getPagination(filters.page, filters.limit);

    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { profile: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          masterProfile: true,
          _count: {
            select: {
              clientOrders: true,
              masterOrders: true,
              reviewsReceived: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginatedResponse(users, total, page, limit);
  }

  /**
   * Блокировка/разблокировка пользователя
   */
  async toggleUserBlock(adminId: string, userId: string, reason?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('Пользователь не найден');

    const newStatus = !user.isActive;

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus },
    });

    if (!newStatus && reason) {
      await prisma.blacklist.create({
        data: {
          userId,
          reason,
          blockedById: adminId,
        },
      });
    }

    logger.info(
      { adminId, userId, blocked: !newStatus },
      `Пользователь ${newStatus ? 'разблокирован' : 'заблокирован'}`
    );

    await auditService.log({
      actorId: adminId,
      action: newStatus ? 'unblock_user' : 'block_user',
      entityType: 'User',
      entityId: userId,
      details: { reason, newStatus },
    });

    return { userId, isActive: newStatus };
  }

  /**
   * Верификация мастера (переключатель: выдать или снять отметку)
   */
  async verifyUser(adminId: string, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('Пользователь не найден');

    const newStatus = !user.isVerified;

    await prisma.user.update({
      where: { id: userId },
      data: { isVerified: newStatus },
    });

    logger.info(
      { adminId, userId, isVerified: newStatus },
      `Мастер ${newStatus ? 'верифицирован' : 'снят с верификации'}`
    );

    await auditService.log({
      actorId: adminId,
      action: newStatus ? 'verify_user' : 'unverify_user',
      entityType: 'User',
      entityId: userId,
    });

    return { userId, isVerified: newStatus };
  }

  /**
   * Все заказы (для админа)
   */
  async getAllOrders(filters: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { skip, take, page, limit } = getPagination(filters.page, filters.limit);

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { include: { profile: true } },
          master: { include: { profile: true } },
          category: true,
          _count: { select: { responses: true, reviews: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return paginatedResponse(orders, total, page, limit);
  }

  /**
   * Все платежи (для админа)
   */
  async getAllPayments(filters: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
  }) {
    const { skip, take, page, limit } = getPagination(filters.page, filters.limit);

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.provider) where.provider = filters.provider;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
          order: { select: { title: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return paginatedResponse(payments, total, page, limit);
  }

  /**
   * Получение конфигурации платформы
   */
  async getConfig() {
    return prisma.platformConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Обновление конфигурации платформы
   */
  async updateConfig(adminId: string, key: string, value: string, description?: string) {
    const config = await prisma.platformConfig.upsert({
      where: { key },
      update: {
        value,
        description,
        updatedById: adminId,
      },
      create: {
        key,
        value,
        description,
        updatedById: adminId,
      },
    });

    logger.info({ adminId, key, value }, 'Конфигурация обновлена');

    await auditService.log({
      actorId: adminId,
      action: 'update_config',
      entityType: 'PlatformConfig',
      entityId: key,
      details: { value, description },
    });

    return config;
  }

  /**
   * Чёрный список
   */
  async getBlacklist(page: number = 1, limit: number = 20) {
    const { skip, take } = getPagination(page, limit);

    const [entries, total] = await Promise.all([
      prisma.blacklist.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
          blockedBy: { include: { profile: true } },
        },
      }),
      prisma.blacklist.count(),
    ]);

    return paginatedResponse(entries, total, page, limit);
  }
}

export const adminService = new AdminService();
