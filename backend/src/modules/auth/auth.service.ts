// ============================================
// MasterUz — Auth Service
// Агент 3 (Бэкенд-разработчик)
// ============================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { getRedis } from '../../config/redis.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateReferralCode } from '../../utils/helpers.js';
import { verifyTelegramAuth, verifyTelegramMiniApp, TelegramAuthData } from '../../utils/telegram.js';
import { JwtPayload } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { isSuperAdmin } from '../../utils/helpers.js';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    telegramId: number;
    role: UserRole;
    username: string | null;
    isVerified: boolean;
    profile: {
      firstName: string;
      lastName: string | null;
      avatarUrl: string | null;
    } | null;
  };
  isNewUser: boolean;
}

export class AuthService {
  /**
   * Авторизация через Telegram Login Widget
   */
  async loginWithTelegram(data: TelegramAuthData): Promise<AuthResult> {
    // Верификация данных от Telegram
    const isValid = verifyTelegramAuth(data);
    if (!isValid) {
      throw ApiError.unauthorized('Невалидные данные Telegram авторизации');
    }

    return this.findOrCreateUser({
      telegramId: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      photoUrl: data.photo_url,
    });
  }

  /**
   * Авторизация через Telegram Mini App
   */
  async loginWithMiniApp(initData: string): Promise<AuthResult> {
    const data = verifyTelegramMiniApp(initData);
    if (!data || !data.user) {
      throw ApiError.unauthorized('Невалидные данные Mini App');
    }

    return this.findOrCreateUser({
      telegramId: data.user.id,
      firstName: data.user.first_name,
      lastName: data.user.last_name,
      username: data.user.username,
      photoUrl: data.user.photo_url,
    });
  }

  /**
   * Обновление токена
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload & { jti?: string; family?: string };

      // Проверяем, не отозван ли токен
      const redis = getRedis();
      const isRevoked = await redis.get(`revoked:${refreshToken}`);
      if (isRevoked) {
        // Reuse detection: токен уже использовался → вероятно угон.
        // Убиваем всё семейство (все refresh, порожденные от этого логина).
        if (payload.family) {
          await redis.del(`refresh-family:${payload.userId}:${payload.family}`).catch(() => {});
        }
        throw ApiError.unauthorized('Токен отозван');
      }

      // Проверяем, что jti совпадает с current в family — иначе семейство убито/устарело
      if (payload.family && payload.jti) {
        const currentJti = await redis.get(`refresh-family:${payload.userId}:${payload.family}`);
        if (currentJti && currentJti !== payload.jti) {
          await redis.del(`refresh-family:${payload.userId}:${payload.family}`).catch(() => {});
          throw ApiError.unauthorized('Токен устарел');
        }
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw ApiError.unauthorized('Пользователь не найден или заблокирован');
      }

      // Сначала генерируем новые токены (сохраняя family), затем отзываем старый
      const newTokens = this.generateTokens({
        userId: user.id,
        telegramId: Number(user.telegramId),
        role: user.role,
      }, payload.family);

      // Отзываем старый refresh token после успешной генерации
      await redis.set(`revoked:${refreshToken}`, '1', 'EX', 60 * 60 * 24 * 30);

      return newTokens;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Невалидный refresh token');
    }
  }

  /**
   * Получение текущего пользователя
   */
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        masterProfile: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('Пользователь не найден');
    }

    // Проверяем, является ли пользователь админом (по PlatformConfig.admin_user_ids или superAdmin)
    let isAdminUser = user.role === 'ADMIN' || user.role === 'MANAGER' || isSuperAdmin(user.username);
    if (!isAdminUser) {
      try {
        const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
        if (adminConfig) {
          const adminUserIds = adminConfig.value.split(',').map((s: string) => s.trim());
          isAdminUser = adminUserIds.includes(userId);
        }
      } catch {}
    }

    // Для суперадминов — автоматически добавляем в admin_user_ids и создаём masterProfile
    if (isSuperAdmin(user.username)) {
      try {
        const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
        const adminIds = adminConfig ? adminConfig.value.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        if (!adminIds.includes(userId)) {
          const newList = [...adminIds, userId].join(',');
          await prisma.platformConfig.upsert({
            where: { key: 'admin_user_ids' },
            update: { value: newList },
            create: { key: 'admin_user_ids', value: newList, description: 'Список user ID с правами админа' },
          });
        }
      } catch {}

      // Создаём masterProfile если нет
      try {
        const existingMp = await prisma.masterProfile.findUnique({ where: { userId } });
        if (!existingMp) {
          await prisma.masterProfile.create({
            data: { userId, specializations: ['general'], experienceYears: 5, registrationPaid: true },
          });
        }
      } catch {}
    }

    return {
      id: user.id,
      telegramId: Number(user.telegramId),
      username: user.username,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      referralCode: user.referralCode,
      profile: user.profile,
      masterProfile: user.masterProfile,
      createdAt: user.createdAt,
      isAdminUser,
    };
  }

  /**
   * Выход (отзыв токена + убийство family — все refresh, порождённые от этого логина)
   */
  async logout(refreshToken: string): Promise<void> {
    const redis = getRedis();
    await redis.set(`revoked:${refreshToken}`, '1', 'EX', 60 * 60 * 24 * 30);
    try {
      const payload = jwt.decode(refreshToken) as (JwtPayload & { family?: string }) | null;
      if (payload?.family && payload?.userId) {
        await redis.del(`refresh-family:${payload.userId}:${payload.family}`);
      }
    } catch {
      /* ignore — токен мог быть мусором */
    }
  }

  // ─── Приватные методы ─────────────────────

  private async findOrCreateUser(data: {
    telegramId: number;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
  }): Promise<AuthResult> {
    let isNewUser = false;

    // Ищем или создаём пользователя
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(data.telegramId) },
      include: { profile: true },
    });

    if (!user) {
      isNewUser = true;
      const referralCode = generateReferralCode();

      user = await prisma.user.create({
        data: {
          telegramId: BigInt(data.telegramId),
          username: data.username || null,
          referralCode,
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName || null,
              avatarUrl: data.photoUrl || null,
            },
          },
        },
        include: { profile: true },
      });

      logger.info({ telegramId: data.telegramId }, 'Новый пользователь зарегистрирован');
    } else {
      // Обновляем профиль
      if (user.profile) {
        await prisma.userProfile.update({
          where: { userId: user.id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName || user.profile.lastName,
            avatarUrl: data.photoUrl || user.profile.avatarUrl,
          },
        });
      }
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Аккаунт заблокирован');
    }

    // === Автоматическая настройка суперадмина ===
    if (isSuperAdmin(data.username)) {
      // Если роль ещё не ADMIN — ставим ADMIN
      if (user.role !== 'ADMIN') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN' },
          include: { profile: true },
        });
      }

      // Добавляем в admin_user_ids если ещё нет
      try {
        const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
        const adminIds = adminConfig ? adminConfig.value.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        if (!adminIds.includes(user.id)) {
          const newList = [...adminIds, user.id].join(',');
          await prisma.platformConfig.upsert({
            where: { key: 'admin_user_ids' },
            update: { value: newList },
            create: { key: 'admin_user_ids', value: newList, description: 'Список user ID с правами админа' },
          });
        }
      } catch {}

      // Создаём masterProfile если нет (чтобы мог быть и мастером)
      try {
        const existingMp = await prisma.masterProfile.findUnique({ where: { userId: user.id } });
        if (!existingMp) {
          await prisma.masterProfile.create({
            data: {
              userId: user.id,
              specializations: ['general'],
              experienceYears: 5,
              registrationPaid: true,
            },
          });
        } else if (!existingMp.registrationPaid) {
          await prisma.masterProfile.update({
            where: { userId: user.id },
            data: { registrationPaid: true },
          });
        }
      } catch {}

      logger.info({ username: data.username, userId: user.id }, 'Суперадмин авторизован');
    }

    // Генерируем токены
    const tokens = this.generateTokens({
      userId: user.id,
      telegramId: Number(user.telegramId),
      role: user.role,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        telegramId: Number(user.telegramId),
        role: user.role,
        username: user.username,
        isVerified: user.isVerified,
        profile: user.profile
          ? {
              firstName: user.profile.firstName,
              lastName: user.profile.lastName,
              avatarUrl: user.profile.avatarUrl,
            }
          : null,
      },
      isNewUser,
    };
  }

  private generateTokens(payload: JwtPayload, family?: string): { accessToken: string; refreshToken: string } {
    const jti = crypto.randomUUID();
    const familyId = family ?? crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign({ ...payload, jti }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { ...payload, jti: refreshJti, family: familyId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions,
    );

    // Семейство хранит «current jti» — если придёт refresh с другим jti, это реиспользование.
    getRedis()
      .set(`refresh-family:${payload.userId}:${familyId}`, refreshJti, 'EX', 60 * 60 * 24 * 30)
      .catch(() => { /* fail-open: в худшем случае просто без reuse-detection */ });

    return { accessToken, refreshToken };
  }

  /** Публичный метод для генерации токенов (используется при switch-role) */
  generateTokensPublic(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    return this.generateTokens(payload);
  }
}

export const authService = new AuthService();
