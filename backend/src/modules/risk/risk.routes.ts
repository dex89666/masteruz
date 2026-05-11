// ============================================
// MasterUz — Customer Risk Routes
// Iteration 2: эндпоинты риск-скоринга
// ============================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  getRiskScore,
  recalculateRiskScore,
  safeRecalculate,
} from '../../services/customerRiskService.js';

const router = Router();

// ─── GET /api/risk/users/:id — узнать риск-скор клиента ──────────────────
// Доступ: мастер (только для клиентов, с которыми есть/был общий заказ)
//         или сам клиент (свой скор)
//         или админ
router.get('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetClientId = req.params.id;
    const me = req.user!;

    // Сам клиент видит свой скор
    if (me.userId === targetClientId) {
      const data = await getRiskScore(targetClientId);
      return res.json({ success: true, data });
    }

    // Админ видит все
    if (me.role === 'ADMIN') {
      const data = await getRiskScore(targetClientId);
      return res.json({ success: true, data });
    }

    // Мастер — только если есть общий заказ
    if (me.role === 'MASTER') {
      const sharedOrder = await prisma.order.findFirst({
        where: { clientId: targetClientId, masterId: me.userId },
        select: { id: true },
      });
      if (!sharedOrder) {
        throw ApiError.forbidden('Нет доступа к скорингу этого клиента');
      }
      const data = await getRiskScore(targetClientId);
      return res.json({ success: true, data });
    }

    throw ApiError.forbidden('Нет прав');
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/risk/recalculate — принудительный пересчёт ────────────────
// Доступ: только сам клиент или админ
router.post('/recalculate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const me = req.user!;
    const targetId = (req.body?.userId as string) || me.userId;
    if (targetId !== me.userId && me.role !== 'ADMIN') {
      throw ApiError.forbidden('Можно пересчитывать только свой скор');
    }
    const snapshot = await recalculateRiskScore(targetId);
    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/risk/master-review — отзыв мастера о клиенте ──────────────
const reviewSchema = z.object({
  orderId: z.string().uuid(),
  overall: z.number().int().min(1).max(5),
  wasRude: z.boolean().optional().default(false),
  wasNoShow: z.boolean().optional().default(false),
  haggledHard: z.boolean().optional().default(false),
  changedScope: z.boolean().optional().default(false),
  delayedPayment: z.boolean().optional().default(false),
  comment: z.string().max(1000).optional(),
});

router.post(
  '/master-review',
  authenticate,
  validateBody(reviewSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const me = req.user!;
      if (me.role !== 'MASTER' && me.role !== 'ADMIN') {
        throw ApiError.forbidden('Только мастера могут оставлять отзыв о клиенте');
      }

      const data = req.body as z.infer<typeof reviewSchema>;
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { id: true, masterId: true, clientId: true, status: true },
      });
      if (!order) throw ApiError.notFound('Заказ не найден');
      if (order.masterId !== me.userId && me.role !== 'ADMIN') {
        throw ApiError.forbidden('Можно оценивать только свои заказы');
      }
      if (!['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(order.status)) {
        throw ApiError.badRequest('Отзыв доступен только после завершения, отмены или спора');
      }

      const review = await prisma.masterReviewClient.upsert({
        where: {
          orderId_masterId: {
            orderId: data.orderId,
            masterId: order.masterId!,
          },
        },
        create: {
          orderId: data.orderId,
          masterId: order.masterId!,
          clientId: order.clientId,
          overall: data.overall,
          wasRude: data.wasRude,
          wasNoShow: data.wasNoShow,
          haggledHard: data.haggledHard,
          changedScope: data.changedScope,
          delayedPayment: data.delayedPayment,
          comment: data.comment,
        },
        update: {
          overall: data.overall,
          wasRude: data.wasRude,
          wasNoShow: data.wasNoShow,
          haggledHard: data.haggledHard,
          changedScope: data.changedScope,
          delayedPayment: data.delayedPayment,
          comment: data.comment,
        },
      });

      // Пересчёт скора клиента
      await safeRecalculate(order.clientId);

      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
