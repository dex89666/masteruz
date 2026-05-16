// ============================================
// MasterUz — Users Service
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { UserRole } from '@prisma/client';
import type { UpdateProfileInput, CreateMasterProfileInput, UpdateMasterProfileInput, UpdateMasterCategoriesInput } from './users.schema.js';
import { geoService } from '../geo/geo.service.js';
import { logger } from '../../utils/logger.js';
import { subscriptionService } from '../../services/subscriptionService.js';

export class UsersService {
  /**
   * Гарантирует наличие MasterProfile для пользователя с ролью MASTER.
   * Самолечение от рассинхронизации, когда роль уже выставлена, а профиль не создан
   * (например, частичный сбой createMasterProfile до того, как обернули в транзакцию).
   * Возвращает существующий или только что созданный MasterProfile.
   * Если user.role !== 'MASTER' — выбрасывает 404, потому что это уже клиент.
   */
  async ensureMasterProfile(userId: string) {
    const existing = await prisma.masterProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw ApiError.notFound('Пользователь не найден');
    if (user.role !== UserRole.MASTER) {
      throw ApiError.notFound('Профиль мастера не найден');
    }

    // Роль MASTER без профиля — досоздаём с дефолтами
    logger.warn({ userId }, 'MasterProfile отсутствовал для роли MASTER — досоздаю');
    return prisma.masterProfile.create({
      data: { userId, specializations: ['general'] },
    });
  }

  /**
   * Обновление профиля пользователя
   */
  async updateProfile(userId: string, data: UpdateProfileInput) {
    // Обновляем User fields (phone, email)
    if (data.phone || data.email) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: data.phone,
          email: data.email,
        },
      });
    }

    // Авто-геокодинг: если пришёл адрес/город, но координат нет — пробуем
    // получить их через Yandex Geocoder. Это критично для уведомлений мастеров:
    // фильтр по гео работает только при наличии latitude/longitude в профиле.
    let { latitude, longitude } = data;
    if ((latitude == null || longitude == null) && (data.address || data.city || data.district)) {
      const addressParts = [data.district, data.city, data.address].filter(Boolean);
      const fullAddress = addressParts.join(', ');
      const geocoded = await geoService.geocodeAddress(fullAddress);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        logger.info({ userId, fullAddress, latitude, longitude }, 'Адрес геокодирован при обновлении профиля');
      }
    }

    // Обновляем UserProfile
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        bio: data.bio,
        latitude,
        longitude,
        address: data.address,
        city: data.city,
        district: data.district,
      },
      create: {
        userId,
        firstName: data.firstName || 'Пользователь',
        lastName: data.lastName,
        bio: data.bio,
        latitude,
        longitude,
        address: data.address,
        city: data.city,
        district: data.district,
      },
    });

    return profile;
  }

  /**
   * Создание профиля мастера
   */
  async createMasterProfile(userId: string, data: CreateMasterProfileInput) {
    // Атомарно: проверка дубля + смена роли + создание профиля + привязка категорий.
    // Без транзакции возможен «полупрофиль»: роль уже MASTER, а masterProfile не создан,
    // и пользователь застревает с ошибками «Профиль мастера не найден» во всех экшенах.
    const masterProfileId = await prisma.$transaction(async (tx) => {
      const existing = await tx.masterProfile.findUnique({ where: { userId } });
      if (existing) {
        throw ApiError.conflict('Профиль мастера уже существует');
      }

      const mp = await tx.masterProfile.create({
        data: {
          userId,
          specializations: data.specializations,
          experienceYears: data.experienceYears || 0,
          maxDistanceKm: data.maxDistanceKm,
          hourlyRate: data.hourlyRate,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { role: UserRole.MASTER },
      });

      if (data.categoryIds && data.categoryIds.length > 0) {
        await tx.masterCategory.createMany({
          data: data.categoryIds.map((categoryId) => ({
            masterProfileId: mp.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      return mp.id;
    });

    // Trial PRO 14 дней — поощряем нового мастера. Idempotent, ошибки не блокируют регистрацию.
    subscriptionService.startTrial(userId).catch((err) => {
      logger.warn({ err, userId }, 'не удалось активировать trial PRO');
    });

    return prisma.masterProfile.findUnique({
      where: { id: masterProfileId },
      include: {
        masterCategories: { include: { category: true } },
      },
    });
  }

  /**
   * Обновление профиля мастера
   */
  async updateMasterProfile(userId: string, data: UpdateMasterProfileInput) {
    await this.ensureMasterProfile(userId);

    return prisma.masterProfile.update({
      where: { userId },
      data: {
        specializations: data.specializations,
        experienceYears: data.experienceYears,
        isAvailable: data.isAvailable,
        maxDistanceKm: data.maxDistanceKm,
        hourlyRate: data.hourlyRate,
      },
    });
  }

  /**
   * Обновление категорий мастера (полная перезапись)
   */
  async updateMasterCategories(userId: string, data: UpdateMasterCategoriesInput) {
    const masterProfile = await this.ensureMasterProfile(userId);

    // Удаляем старые привязки и создаём новые в транзакции
    await prisma.$transaction([
      prisma.masterCategory.deleteMany({
        where: { masterProfileId: masterProfile.id },
      }),
      prisma.masterCategory.createMany({
        data: data.categoryIds.map((categoryId) => ({
          masterProfileId: masterProfile.id,
          categoryId,
        })),
        skipDuplicates: true,
      }),
    ]);

    return prisma.masterProfile.findUnique({
      where: { id: masterProfile.id },
      include: {
        masterCategories: {
          include: { category: true },
        },
      },
    });
  }

  /**
   * Получение категорий мастера
   */
  async getMasterCategories(userId: string) {
    // Самолечение: если роль MASTER, но профиль не создан — создаём пустой.
    await this.ensureMasterProfile(userId).catch(() => null);

    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId },
      include: {
        masterCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                nameUz: true,
                nameEn: true,
                slug: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    return masterProfile?.masterCategories.map((mc) => mc.category) ?? [];
  }

  /**
   * Удаление профиля мастера. Возвращает пользователя обратно в роль CLIENT.
   * История заказов, отзывов и платежей сохраняется — она связана с User, не с MasterProfile.
   * После удаления пользователь сможет повторно зарегистрироваться как мастер.
   */
  async deleteMasterProfile(userId: string) {
    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId },
    });

    if (!masterProfile) {
      throw ApiError.notFound('Профиль мастера не найден');
    }

    // Каскад удалит masterCategories автоматически (onDelete: Cascade в schema.prisma)
    await prisma.$transaction([
      prisma.masterProfile.delete({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { role: UserRole.CLIENT },
      }),
    ]);

    logger.info({ userId }, 'Профиль мастера удалён, роль возвращена в CLIENT');
    return { success: true };
  }

  /**
   * Загрузка сертификата
   */
  async uploadCertificate(userId: string, title: string, fileUrl: string) {
    return prisma.certificate.create({
      data: {
        userId,
        title,
        fileUrl,
      },
    });
  }

  /**
   * Получение профиля мастера по ID
   */
  async getMasterProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        masterProfile: {
          include: {
            masterCategories: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    nameUz: true,
                    nameEn: true,
                    slug: true,
                    icon: true,
                  },
                },
              },
            },
          },
        },
        certificates: true,
        reviewsReceived: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('Мастер не найден');
    }

    const activeSub = await prisma.masterSubscription.findFirst({
      where: { masterId: userId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
      select: { id: true, plan: true, currentPeriodEnd: true },
    });

    return { ...user, isPro: !!activeSub, proSubscription: activeSub };
  }

  /**
   * Получение профиля по Telegram ID
   */
  async getByTelegramId(telegramId: number) {
    return prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        profile: true,
        masterProfile: true,
      },
    });
  }

  /**
   * Поиск мастеров с фильтрацией
   */
  async searchMasters(params: {
    page?: number;
    limit?: number;
    city?: string;
    specialization?: string;
    categoryId?: string;
    minRating?: number;
    search?: string;
    sortBy?: 'rating' | 'completedOrders' | 'experience';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      role: UserRole.MASTER,
      isActive: true,
      masterProfile: { isNot: null },
    };

    if (params.city) {
      where.profile = { city: params.city };
    }

    if (params.specialization) {
      where.masterProfile = {
        ...where.masterProfile,
        specializations: { has: params.specialization },
      };
    }

    // Фильтрация по категории (через MasterCategory M:N)
    if (params.categoryId) {
      where.masterProfile = {
        ...where.masterProfile,
        masterCategories: {
          some: { categoryId: params.categoryId },
        },
      };
    }

    if (params.minRating) {
      where.masterProfile = {
        ...where.masterProfile,
        rating: { gte: params.minRating },
      };
    }

    if (params.search) {
      where.OR = [
        { profile: { firstName: { contains: params.search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: params.search, mode: 'insensitive' } } },
        { username: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (params.sortBy === 'rating') {
      orderBy.masterProfile = { rating: params.sortOrder || 'desc' };
    } else if (params.sortBy === 'completedOrders') {
      orderBy.masterProfile = { completedOrders: params.sortOrder || 'desc' };
    } else if (params.sortBy === 'experience') {
      orderBy.masterProfile = { experienceYears: params.sortOrder || 'desc' };
    } else {
      orderBy.masterProfile = { rating: 'desc' };
    }

    const [masters, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: true,
          masterProfile: {
            include: {
              masterCategories: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      nameUz: true,
                      nameEn: true,
                      slug: true,
                      icon: true,
                    },
                  },
                },
              },
            },
          },
          reviewsReceived: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: { reviewer: { include: { profile: true } } },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const proIds = masters.length
      ? new Set(
          (
            await prisma.masterSubscription.findMany({
              where: {
                masterId: { in: masters.map((m) => m.id) },
                status: 'ACTIVE',
                currentPeriodEnd: { gt: new Date() },
              },
              select: { masterId: true },
            })
          ).map((r) => r.masterId),
        )
      : new Set<string>();

    return {
      data: masters.map((m) => ({ ...m, isPro: proIds.has(m.id) })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

export const usersService = new UsersService();
