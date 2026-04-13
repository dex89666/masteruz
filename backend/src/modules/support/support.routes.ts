// ============================================
// MasterUz — Support Chat Routes
// Чат поддержки: админ/менеджер ↔ пользователь
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { supportChatService } from './support.service.js';
import { clampPagination } from '../../utils/helpers.js';
import { z } from 'zod';

const router = Router();

// ─── Валидация ──────────────────────────────

const createChatSchema = z.object({
  userId: z.string().uuid(),
  subject: z.string().max(200).optional(),
});

const sendMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

// ═══════════════════════════════════════════
// ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ
// ═══════════════════════════════════════════

/**
 * GET /support-chat/ — Мои чаты поддержки (для клиента/мастера)
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chats = await supportChatService.getUserChats(req.user!.userId);
    res.json({ success: true, data: chats });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support-chat/unread — Количество непрочитанных сообщений
 */
router.get('/unread', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await supportChatService.getUnreadCount(req.user!.userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support-chat/:chatId/messages — Сообщения конкретного чата
 */
router.get('/:chatId/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await supportChatService.getMessages(req.params.chatId, req.user!.userId);
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /support-chat/:chatId/messages — Отправить сообщение
 */
router.post('/:chatId/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = sendMessageSchema.parse(req.body);
    const message = await supportChatService.sendMessage(req.params.chatId, req.user!.userId, text);
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// АДМИНСКИЕ МАРШРУТЫ
// ═══════════════════════════════════════════

/**
 * POST /support-chat/admin — Создать чат с пользователем (только ADMIN/MANAGER)
 */
router.post('/admin', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, subject } = createChatSchema.parse(req.body);
    const chat = await supportChatService.createChat(req.user!.userId, userId, subject);
    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support-chat/admin/all — Все чаты поддержки (для админ-панели)
 */
router.get('/admin/all', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const result = await supportChatService.getAdminChats(undefined, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /support-chat/admin/:chatId/close — Закрыть чат
 */
router.put('/admin/:chatId/close', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await supportChatService.closeChat(req.params.chatId, req.user!.userId);
    res.json({ success: true, data: chat });
  } catch (error) {
    next(error);
  }
});

export default router;
