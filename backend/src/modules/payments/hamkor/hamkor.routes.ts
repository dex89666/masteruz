// ============================================
// MasterUz — Hamkorbank (UzQR) routes, /api/v1/payments
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth.js';
import { validateBody } from '../../../middleware/validate.js';
import { verifyHamkorWebhook, handleHamkorWebhook } from './hamkor.webhook.js';
import { uzQrService } from './uzqr.service.js';

const router = Router();

const createUzQrSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('BALANCE_TOPUP'), amount: z.number().int().positive() }),
  z.object({ type: z.literal('ORDER_COMMISSION'), orderId: z.string().uuid() }),
]);

// Создать QR на оплату: { type, amount? | orderId? } → { paymentId, qrUrl, expiresAt, amount, mock }
router.post('/uzqr', authenticate, validateBody(createUzQrSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await uzQrService.createUzQrOrder(req.user!.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Статус платежа — окно оплаты опрашивает, пока ждёт подтверждения банка
router.get('/uzqr/:paymentId/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await uzQrService.getPaymentStatus(req.user!.userId, req.params.paymentId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Вебхук банка: без JWT, защищён подписью и IP-фильтром (см. hamkor.webhook.ts)
router.post('/hamkor-webhook', verifyHamkorWebhook, (req, res, next) => {
  handleHamkorWebhook(req, res).catch(next);
});

export default router;
