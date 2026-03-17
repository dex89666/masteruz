// ============================================
// MasterUz — Online Status Routes (Redis-backed)
// Heartbeat → Redis SETEX (120s TTL), not Prisma
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

const router = Router();

const ONLINE_KEY_PREFIX = 'online:';      // online:{userId} → "1"
const ONLINE_SET_KEY = 'online_masters';   // SET of all online master userIds
const HEARTBEAT_TTL = 120;                 // 2 минуты — ключ автоматически истечёт

/**
 * POST /api/users/heartbeat — мастер пингует, что он онлайн
 * Записывает в Redis с TTL 120s (auto-expire = auto-offline)
 */
router.post('/heartbeat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const redis = getRedis();
    const { latitude, longitude } = req.body || {};

    // Устанавливаем ключ с TTL — при истечении мастер автоматически считается оффлайн
    await Promise.all([
      redis.setex(`${ONLINE_KEY_PREFIX}${userId}`, HEARTBEAT_TTL, Date.now().toString()),
      redis.sadd(ONLINE_SET_KEY, userId),
    ]);

    // Сохраняем геопозицию мастера если передана
    if (latitude && longitude && typeof latitude === 'number' && typeof longitude === 'number') {
      prisma.userProfile.updateMany({
        where: { userId },
        data: { latitude, longitude },
      }).catch((err: any) => logger.error({ err }, 'Ошибка сохранения геопозиции'));
    }

    res.json({ success: true, data: { online: true } });
  } catch (error) {
    logger.error({ error }, 'Heartbeat error, falling back to Prisma');
    // Fallback: если Redis недоступен, используем Prisma
    try {
      const userId = req.user!.userId;
      const { latitude, longitude } = req.body || {};
      await prisma.masterProfile.updateMany({
        where: { userId },
        data: { isOnline: true, lastSeenAt: new Date() },
      });
      if (latitude && longitude) {
        await prisma.userProfile.updateMany({
          where: { userId },
          data: { latitude, longitude },
        });
      }
      res.json({ success: true, data: { online: true } });
    } catch (err) {
      next(err);
    }
  }
});

/**
 * POST /api/users/go-offline — мастер вышел (beforeunload / logout)
 */
router.post('/go-offline', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const redis = getRedis();

    await Promise.all([
      redis.del(`${ONLINE_KEY_PREFIX}${userId}`),
      redis.srem(ONLINE_SET_KEY, userId),
    ]);

    // Обновляем Prisma для долгосрочного хранения lastSeenAt
    await prisma.masterProfile.updateMany({
      where: { userId },
      data: { isOnline: false, lastSeenAt: new Date() },
    });

    res.json({ success: true, data: { online: false } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/online-masters — получить список онлайн мастеров
 * Читает из Redis SET, проверяет TTL ключей, подгружает профили из Prisma
 */
router.get('/online-masters', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redis = getRedis();

    // Получаем всех кандидатов из SET
    const memberIds = await redis.smembers(ONLINE_SET_KEY);

    // Проверяем, кто реально онлайн (TTL-ключ ещё существует)
    const onlineIds: string[] = [];
    const staleIds: string[] = [];

    await Promise.all(
      memberIds.map(async (userId) => {
        const val = await redis.get(`${ONLINE_KEY_PREFIX}${userId}`);
        if (val) {
          onlineIds.push(userId);
        } else {
          staleIds.push(userId); // TTL истёк — удаляем из SET
        }
      })
    );

    // Чистим stale записи из SET (в фоне, не блокируем ответ)
    if (staleIds.length > 0) {
      redis.srem(ONLINE_SET_KEY, ...staleIds).catch(() => {});
    }

    // Подгружаем профили онлайн мастеров
    const onlineMasters = onlineIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: onlineIds },
            role: 'MASTER',
            isActive: true,
          },
          include: {
            profile: true,
            masterProfile: true,
          },
          take: 100,
        })
      : [];

    res.json({ success: true, data: onlineMasters });
  } catch (error) {
    logger.error({ error }, 'online-masters Redis error, falling back to Prisma');
    // Fallback: Prisma query
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const onlineMasters = await prisma.user.findMany({
        where: {
          role: 'MASTER',
          isActive: true,
          masterProfile: { isOnline: true, lastSeenAt: { gte: twoMinutesAgo } },
        },
        include: { profile: true, masterProfile: true },
        take: 100,
      });
      res.json({ success: true, data: onlineMasters });
    } catch (err) {
      next(err);
    }
  }
});

export default router;
