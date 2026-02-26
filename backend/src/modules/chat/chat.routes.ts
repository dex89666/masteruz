// ============================================
// MasterUz — Chat Routes (переписка по заказу)
// Клиент ↔ Мастер — без контактных данных, только имена
// Авто-модерация + флаги для менеджера
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { moderateMessage, censorMessage } from './chatModeration.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /chat/:orderId — история сообщений заказа
 * Доступ: участники заказа + админы/менеджеры
 * Контактные данные НЕ передаются — только имена
 */
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    // Проверяем что пользователь — участник заказа или админ
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const isParticipant = order.clientId === userId || order.masterId === userId;

    if (!isParticipant && !isAdmin) {
      throw ApiError.forbidden('Вы не участник этого заказа');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          include: { profile: { select: { firstName: true, avatarUrl: true } } },
        },
      },
    });

    // Убираем контактные данные — только имя и аватар
    const sanitizedMessages = messages.map(msg => ({
      id: msg.id,
      orderId: msg.orderId,
      senderId: msg.senderId,
      text: msg.isBlocked ? '🚫 Сообщение заблокировано модерацией' : msg.text,
      imageUrl: msg.imageUrl,
      isSystem: msg.isSystem,
      isRead: msg.isRead,
      isFlagged: isAdmin ? msg.isFlagged : undefined,
      flagReason: isAdmin ? msg.flagReason : undefined,
      isBlocked: msg.isBlocked,
      createdAt: msg.createdAt,
      sender: {
        id: msg.sender.id,
        firstName: msg.sender.profile?.firstName || 'Пользователь',
        avatarUrl: msg.sender.profile?.avatarUrl,
        // НЕ передаём: phone, email, telegramId, username
      },
    }));

    // Помечаем непрочитанные как прочитанные (только для участников)
    if (isParticipant) {
      await prisma.chatMessage.updateMany({
        where: {
          orderId,
          senderId: { not: userId },
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    res.json({ success: true, data: sanitizedMessages });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /chat/:orderId — отправить сообщение
 * Авто-модерация: проверка на запрещённые фразы
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

    // ─── Авто-модерация текста ────────────
    let processedText = text || null;
    let isFlagged = false;
    let isBlocked = false;
    let flagReason: string | null = null;

    if (text) {
      const modResult = moderateMessage(text);

      if (modResult.isBlocked) {
        // Блокируем нецензурное сообщение — цензурируем
        processedText = censorMessage(text);
        isBlocked = false; // Показываем цензурированную версию
        isFlagged = true;
        flagReason = modResult.reasons.join('; ');
        logger.warn({ orderId, userId, reasons: modResult.reasons }, 'Сообщение содержит мат — цензурировано');
      } else if (modResult.isFlagged) {
        // Флагируем подозрительное — но не блокируем
        isFlagged = true;
        flagReason = modResult.reasons.join('; ');
        logger.warn({ orderId, userId, reasons: modResult.reasons }, 'Подозрительное сообщение в чате');
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        orderId,
        senderId: userId,
        text: processedText,
        imageUrl: imageUrl || null,
        isFlagged,
        flagReason,
        isBlocked,
      },
      include: {
        sender: {
          include: { profile: { select: { firstName: true, avatarUrl: true } } },
        },
      },
    });

    // Создаём уведомление для получателя
    const recipientId = order.clientId === userId ? order.masterId : order.clientId;
    if (recipientId) {
      const senderName = message.sender.profile?.firstName || 'Пользователь';

      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'CHAT_MESSAGE',
          title: 'Новое сообщение',
          message: `${senderName}: ${processedText?.substring(0, 100) || '📷 Фото'}`,
          data: { orderId, messageId: message.id },
        },
      });
    }

    // Если сообщение флагированное — уведомляем модераторов
    if (isFlagged) {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'CHAT_FLAG',
            title: '🚩 Подозрительное сообщение в чате',
            message: `Заказ #${orderId.substring(0, 8)}: "${processedText?.substring(0, 80)}" — ${flagReason}`,
            data: { orderId, messageId: message.id, flagReason },
          },
        });
      }
    }

    // Ответ без контактных данных
    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        text: message.isBlocked ? '🚫 Сообщение заблокировано' : message.text,
        imageUrl: message.imageUrl,
        isSystem: message.isSystem,
        isRead: message.isRead,
        isFlagged: message.isFlagged,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          firstName: message.sender.profile?.firstName || 'Пользователь',
          avatarUrl: message.sender.profile?.avatarUrl,
        },
      },
      ...(isFlagged && !isBlocked ? {
        warning: '⚠️ Обмен контактами и обход платформы запрещён. Повторные нарушения приведут к блокировке.',
      } : {}),
    });
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

// ═══════════════════════════════════════════
// АДМИНСКИЕ МАРШРУТЫ — модерация чата
// ═══════════════════════════════════════════

/**
 * GET /chat/admin/archive — архив всех чатов (список заказов с перепиской)
 * Админ может видеть все чаты для доказательств и разбора споров
 */
router.get('/admin/archive', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;

    // Находим заказы, у которых есть сообщения в чате
    const where: any = {
      chatMessages: { some: {} },
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              username: true,
              profile: { select: { firstName: true, avatarUrl: true } },
            },
          },
          master: {
            select: {
              id: true,
              username: true,
              profile: { select: { firstName: true, avatarUrl: true } },
            },
          },
          _count: {
            select: { chatMessages: true },
          },
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              text: true,
              createdAt: true,
              sender: {
                select: {
                  profile: { select: { firstName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    // Форматируем ответ
    const archiveData = orders.map(o => ({
      orderId: o.id,
      title: o.title,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      client: o.client ? {
        id: o.client.id,
        name: o.client.profile?.firstName || o.client.username || 'Клиент',
        avatarUrl: o.client.profile?.avatarUrl,
      } : null,
      master: o.master ? {
        id: o.master.id,
        name: o.master.profile?.firstName || o.master.username || 'Мастер',
        avatarUrl: o.master.profile?.avatarUrl,
      } : null,
      messageCount: o._count.chatMessages,
      lastMessage: o.chatMessages[0] ? {
        text: o.chatMessages[0].text?.substring(0, 100) || '',
        senderName: o.chatMessages[0].sender?.profile?.firstName || 'Пользователь',
        createdAt: o.chatMessages[0].createdAt,
      } : null,
    }));

    res.json({ success: true, data: archiveData, total, page, limit });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /chat/admin/flagged — все флагированные сообщения
 */
router.get('/admin/flagged', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { isFlagged: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { include: { profile: { select: { firstName: true } } } },
          order: { select: { id: true, title: true, clientId: true, masterId: true } },
        },
      }),
      prisma.chatMessage.count({ where: { isFlagged: true } }),
    ]);

    res.json({ success: true, data: messages, total, page, limit });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /chat/admin/:messageId/block — заблокировать сообщение
 */
router.put('/admin/:messageId/block', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.chatMessage.update({
      where: { id: req.params.messageId },
      data: {
        isBlocked: true,
        moderatedById: req.user!.userId,
        moderatedAt: new Date(),
      },
    });

    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /chat/admin/:messageId/unflag — снять флаг
 */
router.put('/admin/:messageId/unflag', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.chatMessage.update({
      where: { id: req.params.messageId },
      data: {
        isFlagged: false,
        moderatedById: req.user!.userId,
        moderatedAt: new Date(),
      },
    });

    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

export default router;
