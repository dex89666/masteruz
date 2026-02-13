// ============================================
// MasterUz — Referrals Routes
// Агент 7 (Менеджер по монетизации)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { referralsService } from './referrals.service.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Получение реферальной ссылки
router.get('/link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await referralsService.getReferralLink(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Статистика рефералов
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await referralsService.getReferralStats(req.user!.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Применение реферального кода
router.post('/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referralCode } = req.body;
    const result = await referralsService.applyReferralCode(req.user!.userId, referralCode);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
