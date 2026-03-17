// ============================================
// MasterUz — Promo Codes Routes
// Система промокодов и скидок
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { toNum } from '../../utils/helpers.js';

const router = Router();

/**
 * POST /promo/validate — проверить промокод
 */
router.post('/validate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, orderPrice } = req.body;
    const userId = req.user!.userId;

    if (!code) throw ApiError.badRequest('Введите промокод');

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo) throw ApiError.notFound('Промокод не найден');
    if (!promo.isActive) throw ApiError.badRequest('Промокод неактивен');
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw ApiError.badRequest('Срок действия промокода истёк');
    }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      throw ApiError.badRequest('Промокод исчерпан');
    }
    if (promo.minOrderPrice && orderPrice && orderPrice < toNum(promo.minOrderPrice)) {
      throw ApiError.badRequest(`Минимальная сумма заказа: ${toNum(promo.minOrderPrice).toLocaleString('ru')} сум`);
    }

    // Проверяем, не использовал ли уже этот пользователь промокод
    const alreadyUsed = await prisma.promoCodeUsage.findUnique({
      where: {
        promoCodeId_userId: {
          promoCodeId: promo.id,
          userId,
        },
      },
    });

    if (alreadyUsed) throw ApiError.badRequest('Вы уже использовали этот промокод');

    // Рассчитываем скидку
    let discount = 0;
    const dv = toNum(promo.discountValue);
    if (promo.discountType === 'percentage') {
      discount = orderPrice ? Math.round(orderPrice * dv / 100) : 0;
    } else {
      discount = dv;
    }

    res.json({
      success: true,
      data: {
        promoCodeId: promo.id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: dv,
        calculatedDiscount: discount,
        description: promo.discountType === 'percentage'
          ? `Скидка ${dv}%`
          : `Скидка ${dv.toLocaleString('ru')} сум`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /promo/apply — применить промокод к заказу
 */
router.post('/apply', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promoCodeId, orderId, discount } = req.body;
    const userId = req.user!.userId;

    const usage = await prisma.promoCodeUsage.create({
      data: {
        promoCodeId,
        userId,
        orderId: orderId || null,
        discount: discount || 0,
      },
    });

    // Инкрементируем usedCount
    await prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { usedCount: { increment: 1 } },
    });

    res.status(201).json({ success: true, data: usage });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// Admin-endpoints для промокодов
// ═══════════════════════════════════════════

/**
 * GET /promo — список всех промокодов (admin)
 */
router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { usages: true } },
      },
    });

    res.json({ success: true, data: promos });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /promo/create — создать промокод (admin)
 */
router.post('/create', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, discountType, discountValue, maxUses, minOrderPrice, expiresAt } = req.body;

    if (!code || !discountType || !discountValue) {
      throw ApiError.badRequest('code, discountType и discountValue обязательны');
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue,
        maxUses: maxUses || null,
        minOrderPrice: minOrderPrice || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ success: true, data: promo });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /promo/:id — обновить промокод (admin)
 */
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive, maxUses, expiresAt } = req.body;

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, data: promo });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /promo/:id — удалить промокод (admin)
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.promoCode.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, data: { message: 'Промокод деактивирован' } });
  } catch (error) {
    next(error);
  }
});

export default router;
