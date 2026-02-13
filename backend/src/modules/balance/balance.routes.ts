// ============================================
// MasterUz — Balance Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
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

// Пополнить баланс
router.post('/topup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, provider } = req.body;
    // В реальности тут будет вызов платёжного провайдера (Click/Payme/Telegram Stars)
    // Пока — прямое зачисление (для тестирования)
    const result = await balanceService.topUp(
      req.user!.userId,
      Number(amount),
      `Пополнение через ${provider || 'INTERNAL'}`
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
