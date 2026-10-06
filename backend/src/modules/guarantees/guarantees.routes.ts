// ============================================
// MasterUz — Guarantee Routes (Refactored)
// Система гарантий на выполненные работы
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as guaranteesService from './guarantees.service.js';

const router = Router();

/**
 * GET /guarantees/my — мои гарантии (клиент)
 */
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guarantees = await guaranteesService.getClientGuarantees(req.user!.userId);
    res.json({ success: true, data: guarantees });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /guarantees/:orderId — гарантия по заказу
 */
router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guarantee = await guaranteesService.getGuaranteeByOrder(req.params.orderId, req.user!.userId);
    res.json({ success: true, data: guarantee });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /guarantees — оформить гарантию мастера (для заказов, завершённых до автоматики)
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Срок гарантии задаёт мастер (отклик/профиль) — из запроса берём только orderId
    const guarantee = await guaranteesService.createGuarantee(req.body?.orderId, req.user!.userId);
    res.status(201).json({ success: true, data: guarantee });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /guarantees/:orderId/claim — заявка на гарантийный ремонт
 */
router.post('/:orderId/claim', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await guaranteesService.claimGuarantee(req.params.orderId, req.user!.userId);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /guarantees/:orderId/resolve — закрыть гарантийную заявку
 */
router.post('/:orderId/resolve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await guaranteesService.resolveGuarantee(req.params.orderId, req.user!.userId);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
