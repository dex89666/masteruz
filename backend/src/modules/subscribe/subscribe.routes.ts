import { Router, Request, Response, NextFunction } from 'express';
import { subscribeService } from './subscribe.service';
import { paymentsService } from '../payments/payments.service';
import { validateBody } from '../../middleware/validate';
import { subscribeRpcSchema } from './subscribe.schema';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../config/database';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';
import { toNum } from '../../utils/helpers';

const router = Router();

// Формирует блок detail (фискализация) для receipts.create, если задан ИКПУ.
function buildReceiptDetail(tiyin: number) {
  const f = config.payme.fiscal;
  if (!f.ikpuCode) return undefined; // без ИКПУ Payme фискализирует по кассе
  return {
    receipt_type: f.receiptType,
    items: [
      {
        title: 'Платёж MasterUz',
        price: tiyin,
        count: 1,
        code: f.ikpuCode,
        package_code: f.packageCode || '',
        vat_percent: f.vatPercent,
      },
    ],
  };
}

// Прокси RPC к Subscribe API. Требуется авторизация (пользователь) на сервере.
router.post('/rpc', authenticate, validateBody(subscribeRpcSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { method, params } = req.body;
    const result = await subscribeService.rpcForward(method, params);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Charge endpoint — оплата в один клик привязанной картой.
// Реальный поток Payme Subscribe: receipts.create → receipts.pay(token).
// Ожидает: { paymentId, cardToken }
router.post('/charge', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, cardToken } = req.body;
    const userId = req.user!.userId;

    if (!paymentId || !cardToken) return res.status(400).json({ error: 'Missing paymentId or cardToken' });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (payment.status !== 'PENDING') return res.status(400).json({ error: `Payment status is ${payment.status}` });

    const tiyin = Math.round(toNum(payment.amount) * 100);

    // 1) Создаём чек.
    const receiptRes = await subscribeService.createReceipt({
      amount: tiyin,
      account: { order_id: payment.id },
      detail: buildReceiptDetail(tiyin),
    });
    const receiptId = receiptRes.result?.receipt?._id;
    if (!receiptId) {
      logger.warn({ paymentId, userId, result: receiptRes.result }, 'subscribe.charge — receipts.create без _id');
      return res.status(400).json({ error: 'Failed to create receipt', data: receiptRes.result });
    }

    // 2) Оплачиваем чек привязанной картой.
    const payRes = await subscribeService.payReceipt(receiptId, cardToken);
    // Payme: state === 4 означает «чек оплачен».
    if (payRes.result?.receipt?.state !== 4) {
      logger.warn({ paymentId, userId, receiptId, result: payRes.result }, 'subscribe.charge — чек не оплачен');
      return res.status(400).json({ error: 'Charge was not completed', data: payRes.result });
    }

    // 3) Завершаем платёж: атомарно, с аудитом, доменной логикой и фискализацией.
    await paymentsService.finalizeSubscribeCharge(paymentId, receiptId);

    logger.info({ paymentId, userId, receiptId, provider: 'PAYME_SUBSCRIBE' }, 'subscribe.charge — платёж завершён');

    res.json({ success: true, data: { paymentId, status: 'COMPLETED', receiptId } });
  } catch (err) {
    next(err);
  }
});

// ─── Saved cards management ─────────────────────────────────────
// GET /cards — список привязанных карт пользователя
router.get('/cards', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const cards = await prisma.savedCard.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } });
    res.json({ success: true, data: cards });
  } catch (err) {
    next(err);
  }
});

// POST /cards — сохранить карту после успешного bind
router.post('/cards', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { token, lastFour, brand, expiryMonth, expiryYear, makeDefault } = req.body;
    if (!token || !lastFour) return res.status(400).json({ error: 'Missing token or lastFour' });

    // Если первая карта — сделать default
    const existing = await prisma.savedCard.findMany({ where: { userId } });
    const willDefault = makeDefault || existing.length === 0;

    if (willDefault) {
      await prisma.savedCard.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }

    const card = await prisma.savedCard.create({ data: { userId, token, lastFour, brand, expiryMonth, expiryYear, isDefault: willDefault } });
    res.json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
});

// DELETE /cards/:id — удалить привязанную карту
router.delete('/cards/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id;
    const card = await prisma.savedCard.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (card.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    await prisma.savedCard.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /cards/:id/default — сделать карту default
router.put('/cards/:id/default', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id;
    const card = await prisma.savedCard.findUnique({ where: { id } });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (card.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.savedCard.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const updated = await prisma.savedCard.update({ where: { id }, data: { isDefault: true } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
