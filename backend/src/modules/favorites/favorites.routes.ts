// ============================================
// MasterUz — Favorites Routes (Избранные мастера)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

/**
 * GET /favorites — список избранных мастеров
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const favorites = await prisma.favoriteMaster.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        master: {
          include: {
            profile: true,
            masterProfile: true,
          },
        },
      },
    });

    res.json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /favorites/:masterId — добавить в избранное
 */
router.post('/:masterId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { masterId } = req.params;

    if (userId === masterId) {
      throw ApiError.badRequest('Нельзя добавить себя в избранное');
    }

    // Проверяем что мастер существует
    const master = await prisma.masterProfile.findUnique({
      where: { userId: masterId },
    });

    if (!master) throw ApiError.notFound('Мастер не найден');

    const favorite = await prisma.favoriteMaster.create({
      data: {
        clientId: userId,
        masterId,
      },
      include: {
        master: {
          include: { profile: true, masterProfile: true },
        },
      },
    });

    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /favorites/:masterId — удалить из избранного
 */
router.delete('/:masterId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { masterId } = req.params;

    await prisma.favoriteMaster.delete({
      where: {
        clientId_masterId: {
          clientId: userId,
          masterId,
        },
      },
    });

    res.json({ success: true, data: { message: 'Удалено из избранного' } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /favorites/check/:masterId — проверить, в избранном ли мастер
 */
router.get('/check/:masterId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { masterId } = req.params;

    const fav = await prisma.favoriteMaster.findUnique({
      where: {
        clientId_masterId: {
          clientId: userId,
          masterId,
        },
      },
    });

    res.json({ success: true, data: { isFavorite: !!fav } });
  } catch (error) {
    next(error);
  }
});

export default router;
