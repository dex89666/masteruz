// ============================================
// MasterUz — Instant Order Routes
// ФотоЗаказ за 30 секунд — API маршруты
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { instantOrderService } from './instant-order.service.js';
import { z } from 'zod';

const router = Router();

// ─── Валидация ──────────────────────────────

const analyzeSchema = z.object({
  images: z.array(z.string().min(1)).min(1, 'Минимум 1 фото').max(10, 'Максимум 10 фото'),
  description: z.string().max(2000).optional(),
  voiceText: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const createFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(2000),
  additionalWishes: z.string().max(2000).optional(),
  voiceDescription: z.string().max(5000).optional(),
  address: z.string().min(3).max(300),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  images: z.array(z.string().min(1)).min(1, 'Минимум 1 фото'),
  deadline: z.string().optional(),
  isUrgent: z.boolean().optional(),
  offerAccepted: z.boolean(),
});

const moderateSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════
// КЛИЕНТСКИЕ МАРШРУТЫ
// ═══════════════════════════════════════════

/**
 * POST /instant-order/analyze — AI-анализ фото + описания
 * Возвращает 3 варианта (Good / Better / Best)
 */
router.post('/analyze', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = analyzeSchema.parse(req.body);
    const result = await instantOrderService.analyzePhotos(req.user!.userId, data as any);
    res.json({ success: true, data: result });
  } catch (error: any) {
    // Подробное логирование для отладки
    if (error?.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { message: 'Ошибка валидации данных: ' + error.errors?.map((e: any) => e.message).join(', ') },
      });
    }
    console.error('AI analyze error:', error?.message || error);
    next(error);
  }
});

/**
 * POST /instant-order/create — Создать заказ из выбранного AI-варианта
 */
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createFromTemplateSchema.parse(req.body);
    const order = await instantOrderService.createFromTemplate(req.user!.userId, data as any);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /instant-order/template/:id — Получить AI-шаблон по ID
 */
router.get('/template/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await instantOrderService.getTemplate(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// МАРШРУТЫ МОДЕРАЦИИ (ADMIN / MANAGER)
// ═══════════════════════════════════════════

/**
 * GET /instant-order/admin/moderation — Список AI-заказов на модерации
 */
router.get(
  '/admin/moderation',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await instantOrderService.getPendingModeration(page, limit);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /instant-order/admin/moderate/:orderId — Одобрить/отклонить AI-заказ
 */
router.put(
  '/admin/moderate/:orderId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = moderateSchema.parse(req.body);
      const result = await instantOrderService.moderateOrder(
        req.params.orderId,
        req.user!.userId,
        data.approved,
        data.note
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
