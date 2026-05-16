// ============================================
// MasterUz — Notifications Routes
// Центр уведомлений пользователя
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

/**
 * GET /notifications — список уведомлений
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const cursor = (req.query.cursor as string) || null;

    // Keyset-пагинация: быстро при тысячах уведомлений
    if (cursor) {
      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          cursor: { id: cursor },
          skip: 1,
        }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      const hasMore = notifications.length > limit;
      const items = hasMore ? notifications.slice(0, limit) : notifications;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return res.json({
        success: true,
        data: {
          notifications: items,
          unreadCount,
          pagination: { limit, nextCursor, hasMore },
        },
      });
    }

    // Первая страница — без offset, тоже keyset
    const page = parseInt(req.query.page as string) || 1;
    const useOffset = page > 1;
    const skip = useOffset ? (page - 1) * limit : 0;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        skip,
      }),
      // total больше не считаем при первой загрузке через cursor — оставляем для совместимости старого фронта
      useOffset ? prisma.notification.count({ where: { userId } }) : Promise.resolve(0),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    res.json({
      success: true,
      data: {
        notifications: items,
        unreadCount,
        pagination: {
          total: useOffset ? total : undefined,
          page,
          limit,
          totalPages: useOffset ? Math.ceil(total / limit) : undefined,
          nextCursor,
          hasMore,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/unread-count — количество непрочитанных
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /notifications/:id/read — пометить как прочитанное
 */
router.put('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /notifications/read-all — пометить все как прочитанные
 */
router.put('/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, data: { message: 'Все уведомления прочитаны' } });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /notifications/:id — удалить уведомление
 */
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true, data: { message: 'Уведомление удалено' } });
  } catch (error) {
    next(error);
  }
});

export default router;
