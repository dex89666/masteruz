// ============================================
// MasterUz — Payments Routes
// Агент 3 (Бэкенд) + Агент 7 (Монетизация)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Создание платежа за комиссию
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, provider } = req.body;
    const result = await paymentsService.createCommissionPayment(
      req.user!.userId,
      orderId,
      provider
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Создание платежа за регистрационный взнос мастера (400 000 сум)
router.post('/registration-fee', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.body;
    const result = await paymentsService.createRegistrationPayment(
      req.user!.userId,
      provider
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Click webhook
router.post('/webhook/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.handleClickWebhook(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Payme webhook
router.post('/webhook/payme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.handlePaymeWebhook(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Telegram Stars
router.post('/telegram-stars', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.handleTelegramStarsPayment(
      req.body.paymentId,
      req.body.telegramPaymentId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// История платежей
router.get('/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await paymentsService.getUserPayments(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
