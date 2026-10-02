// ============================================
// MasterUz — Hamkorbank: приём вебхуков об оплате
//
// Защита (до получения спецификации банка):
//  1. Без настроенного секрета вебхук не принимается вовсе (fail closed).
//  2. IP-фильтр по HAMKOR_WEBHOOK_IPS, если задан.
//  3. Подпись HMAC-SHA256 от «сырого» тела запроса секретом HAMKOR_WEBHOOK_SECRET,
//     в заголовке HAMKOR_SIGNATURE_HEADER (по умолчанию X-Signature), hex.
//     СПЕЦИФИКАЦИЯ: алгоритм, заголовок и формат подписи сверить с документацией банка.
// ============================================

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

function normalizeIp(ip: string): string {
  const trimmed = (ip || '').trim();
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : trimmed;
}

export function signHamkorPayload(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Проверка подлинности вебхука. Тело должно прийти «сырым» (express.raw в app.ts). */
export function verifyHamkorWebhook(req: Request, res: Response, next: NextFunction): void {
  const { webhookSecret, webhookIps, signatureHeader } = config.hamkor;

  if (!webhookSecret) {
    logger.error('hamkor webhook: HAMKOR_WEBHOOK_SECRET не задан — вебхук отклонён');
    res.status(503).json({ success: false, error: { message: 'Webhook not configured' } });
    return;
  }

  const ip = normalizeIp(req.ip || req.socket?.remoteAddress || '');
  if (webhookIps.length > 0 && !webhookIps.includes(ip)) {
    logger.warn({ ip }, '🚨 SECURITY: hamkor webhook с IP не из списка банка');
    res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    return;
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    res.status(400).json({ success: false, error: { message: 'Empty body' } });
    return;
  }

  const got = String(req.header(signatureHeader) || '').trim().toLowerCase();
  const expected = signHamkorPayload(rawBody, webhookSecret);
  const valid =
    /^[0-9a-f]{64}$/.test(got) &&
    crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
  if (!valid) {
    logger.warn({ ip }, '🚨 SECURITY: hamkor webhook — неверная подпись');
    res.status(401).json({ success: false, error: { message: 'Invalid signature' } });
    return;
  }

  try {
    req.body = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    res.status(400).json({ success: false, error: { message: 'Invalid JSON' } });
    return;
  }
  next();
}

/**
 * POST /api/v1/payments/hamkor-webhook — подтверждение транзакции от банка.
 * Пока пустой: только принимает и логирует.
 * TODO: найти платёж по order_id/qrId, проверить сумму и статус, идемпотентно
 * провести оплату (повторный вебхук не должен зачислять деньги дважды).
 */
export async function handleHamkorWebhook(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  logger.info(
    { orderId: body.order_id, qrId: body.qr_id, status: body.status },
    'hamkor webhook: получен (обработка ещё не реализована)',
  );
  res.status(200).json({ success: true, received: true });
}
