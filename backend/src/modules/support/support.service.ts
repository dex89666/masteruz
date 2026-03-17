// ============================================
// MasterUz — Support Chat Service
// Чат поддержки: админ/менеджер ↔ пользователь
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

export class SupportChatService {
  /**
   * Админ/менеджер создаёт чат с пользователем
   */
  async createChat(adminId: string, userId: string, subject?: string) {
    // Проверяем, что админ не создаёт чат сам с собой
    if (adminId === userId) {
      throw ApiError.badRequest('Нельзя создать чат с самим собой');
    }

    // Проверяем пользователя
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw ApiError.notFound('Пользователь не найден');

    // Проверяем, нет ли уже открытого чата
    const existing = await prisma.supportChat.findFirst({
      where: {
        userId,
        adminId,
        isClosed: false,
      },
    });
    if (existing) return existing;

    const chat = await prisma.supportChat.create({
      data: {
        userId,
        adminId,
        subject: subject || 'Сообщение от поддержки',
      },
      include: {
        user: { include: { profile: true } },
        admin: { include: { profile: true } },
      },
    });

    logger.info({ chatId: chat.id, adminId, userId }, 'Support chat создан');
    return chat;
  }

  /**
   * Отправка сообщения в чат поддержки
   */
  async sendMessage(chatId: string, senderId: string, text: string) {
    const chat = await prisma.supportChat.findUnique({
      where: { id: chatId },
    });
    if (!chat) throw ApiError.notFound('Чат не найден');
    if (chat.isClosed) throw ApiError.badRequest('Чат закрыт');

    // Проверка: только участники чата могут отправлять
    if (senderId !== chat.userId && senderId !== chat.adminId) {
      throw ApiError.forbidden('Вы не являетесь участником этого чата');
    }

    const message = await prisma.supportMessage.create({
      data: {
        chatId,
        senderId,
        text,
      },
      include: {
        sender: { include: { profile: true } },
      },
    });

    // Обновляем updatedAt чата
    await prisma.supportChat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Получить сообщения чата
   */
  async getMessages(chatId: string, userId: string) {
    const chat = await prisma.supportChat.findUnique({
      where: { id: chatId },
    });
    if (!chat) throw ApiError.notFound('Чат не найден');

    // Проверка доступа
    if (userId !== chat.userId && userId !== chat.adminId) {
      // Админы/менеджеры могут видеть все чаты
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
        throw ApiError.forbidden('Нет доступа к этому чату');
      }
    }

    const messages = await prisma.supportMessage.findMany({
      where: { chatId },
      include: {
        sender: { include: { profile: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Отмечаем как прочитанные
    await prisma.supportMessage.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return messages;
  }

  /**
   * Получить чаты пользователя (для клиента/мастера)
   */
  async getUserChats(userId: string) {
    return prisma.supportChat.findMany({
      where: { userId },
      include: {
        admin: { include: { profile: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: { senderId: { not: userId }, isRead: false },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Получить все чаты (для админ-панели)
   */
  async getAdminChats(adminId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = adminId ? { adminId } : {};

    const [chats, total] = await Promise.all([
      prisma.supportChat.findMany({
        where,
        include: {
          user: { include: { profile: true } },
          admin: { include: { profile: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supportChat.count({ where }),
    ]);

    return { data: chats, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * Закрыть чат
   */
  async closeChat(chatId: string, userId: string) {
    const chat = await prisma.supportChat.findUnique({ where: { id: chatId } });
    if (!chat) throw ApiError.notFound('Чат не найден');

    // Только админ/менеджер может закрыть
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      throw ApiError.forbidden('Только админ или менеджер может закрыть чат');
    }

    return prisma.supportChat.update({
      where: { id: chatId },
      data: { isClosed: true },
    });
  }

  /**
   * Количество непрочитанных сообщений для пользователя
   */
  async getUnreadCount(userId: string) {
    const count = await prisma.supportMessage.count({
      where: {
        chat: { userId },
        senderId: { not: userId },
        isRead: false,
      },
    });
    return count;
  }
}

export const supportChatService = new SupportChatService();
