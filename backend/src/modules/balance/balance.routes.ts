// ============================================
// MasterUz — Balance Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { balanceService } from './balance.service.js';

const router = Router();

// Получить баланс
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await balanceService.getBalance(req.user!.userId);
    res.json({ success: true, data: { balance } });
  } catch (error) {
    next(error);
  }
});

// Пополнить баланс — ТОЛЬКО ADMIN (прямое зачисление для тестирования)
router.post('/topup', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, provider, userId: targetUserId } = req.body;
    // Админ может пополнить баланс указанному пользователю или себе
    const effectiveUserId = targetUserId || req.user!.userId;
    const result = await balanceService.topUp(
      effectiveUserId,
      Number(amount),
      `Пополнение через ${provider || 'INTERNAL'} (admin: ${req.user!.userId})`
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// История транзакций
router.get('/transactions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await balanceService.getTransactions(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
