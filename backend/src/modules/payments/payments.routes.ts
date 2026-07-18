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
import subscribeRoutes from '../subscribe/subscribe.routes.js';

const router = Router();

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

// Click webhook
router.post('/webhook/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.handleClickWebhook(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Payme webhook (Merchant API) — Basic Auth + IP whitelist
import { ipWhitelist } from '../../middleware/ipWhitelist.js';

// Ошибка авторизации Payme: JSON-RPC -32504 (HTTP 200 по протоколу).
function paymeAuthError(reqBody: any) {
  return {
    jsonrpc: '2.0',
    id: reqBody?.id ?? null,
    error: {
      code: -32504,
      message: {
        ru: 'Недостаточно привилегий для выполнения операции',
        uz: 'Операцияни бажариш учун ҳуқуқлар етарли эмас',
        en: 'Insufficient privileges to perform this operation',
      },
    },
  };
}

router.post('/webhook/payme', ipWhitelist, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Payme шлёт Basic Auth: base64("Paycom:<merchantKey>").
    // Секрет — merchantKey (пароль); логин ("Paycom" или merchantId) не проверяем.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      logger.warn({ ip: req.ip }, '🚨 SECURITY: Payme webhook без заголовка авторизации');
      return res.status(200).json(paymeAuthError(req.body));
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const sep = decoded.indexOf(':');
    const password = sep >= 0 ? decoded.slice(sep + 1) : '';

    const expectedKey = config.payme.useSandbox
      ? (config.payme.sandboxMerchantKey || config.payme.merchantKey)
      : config.payme.merchantKey;

    if (!expectedKey || password !== expectedKey) {
      logger.warn(
        { ip: req.ip },
        '🚨 SECURITY: Payme webhook неверные учётные данные — возможна попытка подделки'
      );
      return res.status(200).json(paymeAuthError(req.body));
    }

    const result = await paymentsService.handlePaymeWebhook(req.body);
    res.json(result);
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

// Подмаршруты Subscribe API: /api/payments/subscribe/*
router.use('/subscribe', subscribeRoutes);

export default router;
