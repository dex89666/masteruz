// ============================================
// MasterUz — Вывод средств: маршруты
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { withdrawalsService } from './withdrawals.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { clampPagination } from '../../utils/helpers.js';
import {
  createWithdrawalSchema,
  rejectWithdrawalSchema,
  completeWithdrawalSchema,
} from './withdrawals.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

// ─── Мастер ──────────────────────────────────────────────────────

// Создать заявку. Баланс списывается сразу — см. комментарий в сервисе.
router.post('/', authenticate, validateBody(createWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await withdrawalsService.create(req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

// Свои заявки
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const result = await withdrawalsService.listMine(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Отозвать свою заявку — сумма вернётся на баланс
router.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await withdrawalsService.cancel(req.user!.userId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── Админ / менеджер ────────────────────────────────────────────

// Очередь заявок (?status=PENDING)
router.get('/admin', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = clampPagination(req.query.page, req.query.limit);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await withdrawalsService.listForAdmin(status, page, limit);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  });

// Взять в работу
router.post('/admin/:id/processing', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await withdrawalsService.markProcessing(req.user!.userId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

// Деньги отправлены
router.post('/admin/:id/complete', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateBody(completeWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await withdrawalsService.markCompleted(
        req.user!.userId, req.params.id, req.body.adminNote,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

// Отклонить — сумма вернётся мастеру
router.post('/admin/:id/reject', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateBody(rejectWithdrawalSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await withdrawalsService.reject(
        req.user!.userId, req.params.id, req.body.reason,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

export default router;
