// ============================================
// MasterUz — Chat Routes (переписка по заказу)
// Клиент ↔ Мастер в рамках заказа
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

/**
 * GET /chat/:orderId — история сообщений заказа
 */
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    // Проверяем что пользователь — участник заказа
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.clientId !== userId && order.masterId !== userId) {
      throw ApiError.forbidden('Вы не участник этого заказа');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          include: { profile: true },
        },
      },
    });

    // Помечаем непрочитанные как прочитанные
    await prisma.chatMessage.updateMany({
      where: {
        orderId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /chat/:orderId — отправить сообщение
 */
router.post('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;
    const { text, imageUrl } = req.body;

    if (!text && !imageUrl) {
      throw ApiError.badRequest('Сообщение не может быть пустым');
    }

    // Проверяем участие
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true, status: true },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.clientId !== userId && order.masterId !== userId) {
      throw ApiError.forbidden('Вы не участник этого заказа');
    }

    const message = await prisma.chatMessage.create({
      data: {
        orderId,
        senderId: userId,
        text: text || null,
        imageUrl: imageUrl || null,
      },
      include: {
        sender: {
          include: { profile: true },
        },
      },
    });

    // Создаём уведомление для получателя
    const recipientId = order.clientId === userId ? order.masterId : order.clientId;
    if (recipientId) {
      const senderProfile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true },
      });

      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'CHAT_MESSAGE',
          title: 'Новое сообщение',
          message: `${senderProfile?.firstName || 'Пользователь'}: ${text?.substring(0, 100) || '📷 Фото'}`,
          data: { orderId, messageId: message.id },
        },
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /chat/:orderId/unread — количество непрочитанных
 */
router.get('/:orderId/unread', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const count = await prisma.chatMessage.count({
      where: {
        orderId,
        senderId: { not: userId },
        isRead: false,
      },
    });

    res.json({ success: true, data: { unread: count } });
  } catch (error) {
    next(error);
  }
});

export default router;
