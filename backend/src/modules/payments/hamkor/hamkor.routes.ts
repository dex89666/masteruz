// ============================================
// MasterUz — Hamkorbank (UzQR) routes, /api/v1/payments
// ============================================

import { Router } from 'express';
import { verifyHamkorWebhook, handleHamkorWebhook } from './hamkor.webhook.js';

const router = Router();

// Вебхук банка: без JWT, защищён подписью и IP-фильтром (см. hamkor.webhook.ts)
router.post('/hamkor-webhook', verifyHamkorWebhook, (req, res, next) => {
  handleHamkorWebhook(req, res).catch(next);
});

export default router;
