// ============================================
// MasterUz — Online Status Routes
// Отслеживание онлайн/офлайн статуса мастеров
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';

const router = Router();

/**
 * POST /api/users/heartbeat — мастер пингует, что он онлайн
 * Вызывается фронтендом каждые 30 секунд
 */
router.post('/heartbeat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId },
    });

    if (masterProfile) {
      await prisma.masterProfile.update({
        where: { userId },
        data: {
          isOnline: true,
          lastSeenAt: new Date(),
        },
      });
    }

    res.json({ success: true, data: { online: true } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users/go-offline — мастер вышел (beforeunload / logout)
 */
router.post('/go-offline', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    await prisma.masterProfile.updateMany({
      where: { userId },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });

    res.json({ success: true, data: { online: false } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/online-masters — получить список онлайн мастеров
 */
router.get('/online-masters', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Мастер считается онлайн, если lastSeenAt < 2 минут назад
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const onlineMasters = await prisma.user.findMany({
      where: {
        role: 'MASTER',
        isActive: true,
        masterProfile: {
          isOnline: true,
          lastSeenAt: { gte: twoMinutesAgo },
        },
      },
      include: {
        profile: true,
        masterProfile: true,
      },
      take: 100,
    });

    // Также ставим оффлайн тех, кто давно не пингал
    await prisma.masterProfile.updateMany({
      where: {
        isOnline: true,
        lastSeenAt: { lt: twoMinutesAgo },
      },
      data: { isOnline: false },
    });

    res.json({ success: true, data: onlineMasters });
  } catch (error) {
    next(error);
  }
});

export default router;
