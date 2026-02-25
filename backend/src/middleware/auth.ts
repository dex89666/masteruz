// ============================================
// MasterUz — JWT Authentication Middleware
// Агент 3 (Бэкенд) + Агент 6 (Безопасность)
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  telegramId: number;
  role: UserRole;
}

// Расширение типа Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware для проверки JWT-токена
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Токен не предоставлен');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Недействительный токен'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Токен истёк'));
    } else {
      next(error);
    }
  }
}

/**
 * Middleware для проверки ролей
 * Проверяет: 1) текущую роль в JWT, 2) admin_user_ids в PlatformConfig
 */
export function authorize(...roles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(ApiError.unauthorized('Не авторизован'));
    }

    // Если текущая роль совпадает — пропускаем
    if (roles.includes(req.user.role)) {
      return next();
    }

    // Если среди разрешённых ролей есть ADMIN/MANAGER — проверяем admin_user_ids
    if (roles.includes('ADMIN' as any) || roles.includes('MANAGER' as any)) {
      try {
        const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_user_ids' } });
        if (adminConfig) {
          const adminIds = adminConfig.value.split(',').map((s: string) => s.trim());
          if (adminIds.includes(req.user.userId)) {
            return next(); // Пользователь в списке админов — пропускаем
          }
        }
      } catch {
        // Если ошибка БД — продолжаем со стандартной проверкой
      }
    }

    return next(ApiError.forbidden('Недостаточно прав'));
  };
}

/**
 * Опциональная аутентификация (не вызывает ошибку если токена нет)
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next();
  }
}

/**
 * Middleware для проверки активности пользователя и блокировки
 */
export async function checkUserActive(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      return next(ApiError.forbidden('Аккаунт заблокирован'));
    }

    next();
  } catch (error) {
    next(error);
  }
}
