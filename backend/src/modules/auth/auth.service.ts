// ============================================
// MasterUz — Auth Service
// Агент 3 (Бэкенд-разработчик)
// ============================================

import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { getRedis } from '../../config/redis.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateReferralCode } from '../../utils/helpers.js';
import { verifyTelegramAuth, verifyTelegramMiniApp, TelegramAuthData } from '../../utils/telegram.js';
import { JwtPayload } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';
import { logger } from '../../utils/logger.js';

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
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      // Проверяем, не отозван ли токен
      const redis = getRedis();
      const isRevoked = await redis.get(`revoked:${refreshToken}`);
      if (isRevoked) {
        throw ApiError.unauthorized('Токен отозван');
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw ApiError.unauthorized('Пользователь не найден или заблокирован');
      }

      // Отзываем старый refresh token
      await redis.set(`revoked:${refreshToken}`, '1', 'EX', 60 * 60 * 24 * 30);

      // Генерируем новые токены
      return this.generateTokens({
        userId: user.id,
        telegramId: Number(user.telegramId),
        role: user.role,
      });
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
    };
  }

  /**
   * Выход (отзыв токена)
   */
  async logout(refreshToken: string): Promise<void> {
    const redis = getRedis();
    await redis.set(`revoked:${refreshToken}`, '1', 'EX', 60 * 60 * 24 * 30);
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

  private generateTokens(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
