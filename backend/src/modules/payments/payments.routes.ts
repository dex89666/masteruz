// ============================================
// MasterUz — Payments Routes
// Агент 3 (Бэкенд) + Агент 7 (Монетизация)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { balanceTopupSchema, registrationFeeSchema, telegramStarsSchema, commissionPaymentSchema } from './payments.schema.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { clampPagination } from '../../utils/helpers.js';

const router = Router();

// ─── Click, Payme, Telegram Stars отключены — онлайн-оплата только через Hamkorbank (UzQR) ───
// Магазины в кабинетах Click и Payme закрыты, их вебхуки и привязка карт Payme удалены.
// Создание платежей отвечает 410, пока не подключена оплата через Hamkorbank.
router.use(['/create', '/balance-topup', '/registration-fee', '/telegram-stars', '/subscribe'], (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: {
      message: 'Онлайн-оплата временно недоступна: переходим на UzQR (Hamkorbank)',
      statusCode: 410,
    },
  });
});

// Создание платежа за комиссию
router.post('/create', authenticate, validateBody(commissionPaymentSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// Пополнение баланса через платёжную систему (Click / Payme / Telegram Stars)
router.post('/balance-topup', authenticate, validateBody(balanceTopupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, provider } = req.body;
    const result = await paymentsService.createBalanceTopupPayment(
      req.user!.userId,
      amount,
      provider
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Создание платежа за регистрационный взнос мастера (400 000 сум)
router.post('/registration-fee', authenticate, validateBody(registrationFeeSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// Telegram Stars — с проверкой владельца платежа
router.post('/telegram-stars', authenticate, validateBody(telegramStarsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.handleTelegramStarsPayment(
      req.user!.userId,
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
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const result = await paymentsService.getUserPayments(req.user!.userId, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
