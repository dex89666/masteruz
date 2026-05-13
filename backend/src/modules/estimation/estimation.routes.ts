// ============================================
// MasterUz — Estimation Routes
// Выезд на оценку + смета + модерация
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { estimationService } from './estimation.service.js';
import { clampPagination } from '../../utils/helpers.js';
import { z } from 'zod';

const router = Router();

// ─── Валидация ──────────────────────────────

const createEstimationSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  address: z.string().min(3).max(300),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  images: z.array(z.string()).min(1, 'Прикрепите минимум 1 фото'),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
});

const createEstimateSchema = z.object({
  workItems: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().nonnegative(),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
    unit: z.string().optional(),
    cancelled: z.boolean().optional(),
  })).min(1, 'Добавьте хотя бы одну работу'),
  materialItems: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().nonnegative(),
    unit: z.string().min(1),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
    cancelled: z.boolean().optional(),
  })).default([]),
  estimatedDays: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  photos: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
});

// ═══════════════════════════════════════════
// КЛИЕНТСКИЕ МАРШРУТЫ
// ═══════════════════════════════════════════

/**
 * POST /estimation — Создать заказ на оценку
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEstimationSchema.parse(req.body);
    const order = await estimationService.createEstimationOrder(req.user!.userId, data as any);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /estimation/:orderId/estimate — Получить смету заказа
 */
router.get('/:orderId/estimate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimates = await estimationService.getEstimateByOrder(req.params.orderId, req.user!.userId);
    res.json({ success: true, data: estimates });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /estimation/:estimateId/approve — Клиент одобряет смету
 */
router.put('/:estimateId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await estimationService.approveEstimate(req.params.estimateId, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /estimation/:estimateId/reject — Клиент отказывается от сметы
 */
router.put('/:estimateId/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const result = await estimationService.rejectEstimate(req.params.estimateId, req.user!.userId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// МАСТЕРСКИЕ МАРШРУТЫ
// ═══════════════════════════════════════════

/**
 * PUT /estimation/:orderId/accept — Мастер принимает заказ на оценку
 */
router.put('/:orderId/accept', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await estimationService.acceptEstimation(req.params.orderId, req.user!.userId);
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /estimation/:orderId/estimate — Мастер создаёт смету
 */
router.post('/:orderId/estimate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEstimateSchema.parse(req.body);
    const estimate = await estimationService.createEstimate(req.params.orderId, req.user!.userId, data as any);
    res.status(201).json({ success: true, data: estimate });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /estimation/estimate/:estimateId/send — Мастер отправляет смету
 */
router.put('/estimate/:estimateId/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimate = await estimationService.sendEstimate(req.params.estimateId, req.user!.userId);
    res.json({ success: true, data: estimate });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// АДМИНСКИЕ МАРШРУТЫ (модерация)
// ═══════════════════════════════════════════

/**
 * GET /estimation/admin/orders — Все заказы на оценку
 */
router.get('/admin/orders', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const result = await estimationService.getEstimationOrders({
      status: req.query.status as string,
      page,
      limit,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /estimation/admin/moderation — Сметы на модерации
 */
router.get('/admin/moderation', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimates = await estimationService.getPendingModeration();
    res.json({ success: true, data: estimates });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /estimation/admin/moderate/:estimateId — Модерация сметы
 */
router.put('/admin/moderate/:estimateId', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved, note } = req.body;
    const result = await estimationService.moderateEstimate(
      req.params.estimateId,
      req.user!.userId,
      approved === true,
      note
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
