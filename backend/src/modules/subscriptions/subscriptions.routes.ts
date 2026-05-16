// ============================================
// MasterUz — Subscriptions Routes
// ────────────────────────────────────────────
// GET  /api/subscriptions/plans   — публичная сетка тарифов
// GET  /api/subscriptions/me      — текущая подписка пользователя
// POST /api/subscriptions/trial   — стартовать trial (только мастер, единожды)
// POST /api/subscriptions/purchase — отметить успешную покупку (server-to-server из webhook оплаты)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { subscriptionService, PLANS } from '../../services/subscriptionService.js';
import { prisma } from '../../config/database.js';

const router = Router();

/**
 * GET /api/subscriptions/plans
 */
router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId as string | undefined;
    const data = await subscriptionService.listPlans(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/subscriptions/me — текущая активная подписка + история (последние 10)
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [active, history] = await Promise.all([
      subscriptionService.getActiveSubscription(userId),
      prisma.masterSubscription.findMany({
        where: { masterId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    res.json({ success: true, data: { active, history, isPro: !!active } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscriptions/trial — активировать trial (idempotent)
 */
router.post('/trial', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'MASTER') {
      throw ApiError.forbidden('Trial доступен только мастерам');
    }
    const sub = await subscriptionService.startTrial(userId);
    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscriptions/purchase — server-side активация после оплаты.
 * Тело: { plan, paymentId }. paymentId должен принадлежать пользователю и быть SUCCESS.
 */
router.post('/purchase', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { plan, paymentId } = req.body as { plan?: string; paymentId?: string };
    if (!plan || !paymentId) throw ApiError.badRequest('plan и paymentId обязательны');
    if (!(plan in PLANS)) throw ApiError.badRequest('Неизвестный план');

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) throw ApiError.notFound('Платёж не найден');
    if (payment.status !== 'COMPLETED') throw ApiError.badRequest('Платёж не успешен');
    if (payment.type !== 'SUBSCRIPTION') throw ApiError.badRequest('Платёж не для подписки');

    // Защита от двойной активации одного платежа
    const existing = await prisma.masterSubscription.findUnique({ where: { paymentId } });
    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    const sub = await subscriptionService.purchase({
      masterId: userId,
      plan: plan as any,
      paymentId,
      amountPaid: Number(payment.amount),
    });
    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/subscriptions/purchase-from-balance — оплата с внутреннего баланса.
 * Тело: { plan }. Атомарно списывает priceSum и активирует подписку.
 */
router.post('/purchase-from-balance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { plan } = req.body as { plan?: string };
    if (!plan) throw ApiError.badRequest('plan обязателен');
    if (!(plan in PLANS)) throw ApiError.badRequest('Неизвестный план');

    const sub = await subscriptionService.purchaseFromBalance({
      masterId: userId,
      plan: plan as any,
    });
    res.json({ success: true, data: sub });
  } catch (err: any) {
    if (err?.message?.includes('Недостаточно средств') || err?.message?.includes('только мастерам')) {
      next(ApiError.badRequest(err.message));
      return;
    }
    next(err);
  }
});

export default router;
