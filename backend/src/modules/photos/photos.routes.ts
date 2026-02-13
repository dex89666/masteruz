// ============================================
// MasterUz — Photos Routes (Фото до/после)
// Мастер загружает фото «до» и «после» работы
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

/**
 * GET /photos/:orderId — все фото заказа
 */
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photos = await prisma.orderPhoto.findMany({
      where: { orderId: req.params.orderId },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });

    res.json({ success: true, data: photos });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /photos/:orderId — добавить фото
 */
router.post('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;
    const { url, type, caption } = req.body;

    if (!url || !type || !['before', 'after'].includes(type)) {
      throw ApiError.badRequest('url и type (before/after) обязательны');
    }

    // Проверяем что пользователь — мастер на этом заказе
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { masterId: true, clientId: true },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.masterId !== userId && order.clientId !== userId) {
      throw ApiError.forbidden('Вы не участник этого заказа');
    }

    // Считаем текущий sortOrder
    const count = await prisma.orderPhoto.count({
      where: { orderId, type },
    });

    const photo = await prisma.orderPhoto.create({
      data: {
        orderId,
        url,
        type,
        caption: caption || null,
        sortOrder: count,
      },
    });

    // Уведомляем клиента
    if (order.masterId === userId && order.clientId) {
      await prisma.notification.create({
        data: {
          userId: order.clientId,
          type: 'ORDER_PHOTO',
          title: type === 'before' ? 'Фото "до" работы' : 'Фото "после" работы',
          message: `Мастер загрузил фото ${type === 'before' ? 'до начала' : 'после завершения'} работы`,
          data: { orderId, photoId: photo.id, type },
        },
      });
    }

    res.status(201).json({ success: true, data: photo });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /photos/:photoId — удалить фото
 */
router.delete('/:photoId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.orderPhoto.delete({
      where: { id: req.params.photoId },
    });
    res.json({ success: true, data: { message: 'Фото удалено' } });
  } catch (error) {
    next(error);
  }
});

export default router;
