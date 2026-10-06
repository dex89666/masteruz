// ============================================
// MasterUz — Оплата по QR (UzQR, Hamkorbank)
//
//  createUzQrOrder   — платёж в БД (PENDING) + динамический QR от банка
//  getPaymentStatus  — статус для окна оплаты (фронт опрашивает, пока ждёт)
//  handleNotification — уведомление банка: сверка суммы, идемпотентное
//                       проведение, зачисление по типу платежа, сообщение в Telegram
// ============================================

import { Prisma, PaymentProvider, PaymentStatus, PaymentType } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { config } from '../../../config/index.js';
import { ApiError } from '../../../utils/ApiError.js';
import { logger } from '../../../utils/logger.js';
import { toNum } from '../../../utils/helpers.js';
import { sendTelegramMessage } from '../../../utils/telegramBot.js';
import { auditService } from '../../../services/auditService.js';
import { paymentsService } from '../payments.service.js';
import { createDynamicQr } from './hamkor.client.js';

export type UzQrPurpose =
  | { type: 'BALANCE_TOPUP'; amount: number }
  | { type: 'ORDER_COMMISSION'; orderId: string };

export interface UzQrOrder {
  paymentId: string;
  amount: number;
  qrUrl: string;
  expiresAt: string;
  mock: boolean;
}

/** Уведомление банка, приведённое к нашим полям. */
export interface HamkorNotification {
  paymentId: string;
  bankTxId: string;
  status: 'PAID' | 'FAILED' | 'OTHER';
  amountTiyin: number;
}

const MIN_TOPUP = 10_000;
const MAX_TOPUP = 100_000_000;

const PURPOSE_TITLE: Partial<Record<PaymentType, string>> = {
  BALANCE_TOPUP: 'Пополнение баланса',
  ORDER_COMMISSION: 'Оплата комиссии по заказу',
};

/** Сумма и привязки платежа — с проверкой, что платить можно и платит тот, кто должен. */
async function resolvePurpose(userId: string, purpose: UzQrPurpose) {
  switch (purpose.type) {
    case 'BALANCE_TOPUP': {
      const amount = Number(purpose.amount);
      if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
        throw ApiError.badRequest('Сумма пополнения — от 10 000 до 100 000 000 сум');
      }
      return { type: PaymentType.BALANCE_TOPUP, amount, orderId: null as string | null };
    }
    case 'ORDER_COMMISSION': {
      const order = await prisma.order.findUnique({
        where: { id: purpose.orderId },
        select: { id: true, masterId: true, commissionAmount: true, commissionPaid: true },
      });
      if (!order) throw ApiError.notFound('Заказ не найден');
      if (order.masterId !== userId) throw ApiError.forbidden('Комиссию по заказу оплачивает его мастер');
      if (order.commissionPaid) throw ApiError.conflict('Комиссия уже оплачена');
      const amount = toNum(order.commissionAmount);
      if (!(amount > 0)) throw ApiError.badRequest('По заказу нет комиссии к оплате');
      return { type: PaymentType.ORDER_COMMISSION, amount, orderId: order.id };
    }
  }
}

class UzQrService {
  /** Создаёт платёж и динамический QR. Незавершённые QR того же назначения гасятся. */
  async createUzQrOrder(userId: string, purpose: UzQrPurpose): Promise<UzQrOrder> {
    if (!config.hamkor.enabled) {
      throw new ApiError(410, 'Онлайн-оплата временно недоступна: переходим на UzQR (Hamkorbank)');
    }
    const { type, amount, orderId } = await resolvePurpose(userId, purpose);

    // Один открытый QR на одно назначение: старый больше не принимаем
    await prisma.payment.updateMany({
      where: { userId, type, orderId, provider: PaymentProvider.HAMKOR, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED },
    });

    const payment = await prisma.payment.create({
      data: { userId, orderId, amount, type, provider: PaymentProvider.HAMKOR, status: PaymentStatus.PENDING },
    });

    try {
      const qr = await createDynamicQr({ amount, orderId: payment.id });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { metadata: { qrId: qr.qrId, qrUrl: qr.qrPayload, expiresAt: qr.expiresAt, mock: qr.mock } },
      });
      logger.info({ paymentId: payment.id, type, amount, mock: qr.mock }, 'uzqr: создан QR на оплату');
      return { paymentId: payment.id, amount, qrUrl: qr.qrPayload, expiresAt: qr.expiresAt, mock: qr.mock };
    } catch (err) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
      throw err;
    }
  }

  /** Статус платежа — только владельцу. */
  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { userId: true, status: true, amount: true, type: true, provider: true, metadata: true },
    });
    if (!payment || payment.userId !== userId || payment.provider !== PaymentProvider.HAMKOR) {
      throw ApiError.notFound('Платёж не найден');
    }
    const meta = (payment.metadata ?? {}) as { expiresAt?: string };
    return { status: payment.status, amount: toNum(payment.amount), type: payment.type, expiresAt: meta.expiresAt ?? null };
  }

  /**
   * Уведомление банка (подпись уже проверена в verifyHamkorWebhook).
   * Повторное уведомление ничего не меняет: платёж проводится ровно один раз.
   */
  async handleNotification(n: HamkorNotification): Promise<{ result: string }> {
    const payment = await prisma.payment.findUnique({ where: { id: n.paymentId } });
    if (!payment || payment.provider !== PaymentProvider.HAMKOR) {
      logger.warn({ paymentId: n.paymentId }, 'hamkor: уведомление по неизвестному платежу');
      return { result: 'unknown_payment' };
    }

    if (n.status === 'FAILED') {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
        data: { status: PaymentStatus.FAILED },
      });
      return { result: 'failed' };
    }
    if (n.status !== 'PAID') return { result: 'ignored' };

    const expectedTiyin = Math.round(toNum(payment.amount) * 100);
    if (n.amountTiyin !== expectedTiyin) {
      logger.error(
        { paymentId: payment.id, expectedTiyin, gotTiyin: n.amountTiyin },
        '🚨 hamkor: сумма оплаты не совпадает с платежом — не проводим',
      );
      await auditService.log({
        actorId: payment.userId,
        action: 'PAYMENT_AMOUNT_MISMATCH',
        entityType: 'Payment',
        entityId: payment.id,
        details: { provider: 'HAMKOR', expectedTiyin, gotTiyin: n.amountTiyin, bankTxId: n.bankTxId },
      });
      return { result: 'amount_mismatch' };
    }

    // Атомарный захват: из PENDING/PROCESSING (или FAILED — QR погашен, а деньги пришли) в COMPLETED
    let claimed = 0;
    try {
      const res = await prisma.payment.updateMany({
        where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED] } },
        data: { status: PaymentStatus.COMPLETED, providerTxId: n.bankTxId },
      });
      claimed = res.count;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.error({ paymentId: payment.id, bankTxId: n.bankTxId }, '🚨 hamkor: транзакция банка уже привязана к другому платежу');
        return { result: 'duplicate_tx' };
      }
      throw err;
    }
    if (claimed === 0) return { result: 'already_completed' };

    await auditService.log({
      actorId: payment.userId,
      action: 'PAYMENT_COMPLETED',
      entityType: 'Payment',
      entityId: payment.id,
      details: { provider: 'HAMKOR', bankTxId: n.bankTxId, amount: toNum(payment.amount), type: payment.type },
    });
    await paymentsService.onPaymentCompleted(payment.id);
    await this.notifyPaid(payment.id);
    logger.info({ paymentId: payment.id, type: payment.type }, '💳 hamkor: оплата проведена');
    return { result: 'completed' };
  }

  /** Сообщение в Telegram об успешной оплате. Ошибка отправки оплату не отменяет. */
  private async notifyPaid(paymentId: string): Promise<void> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { amount: true, type: true, user: { select: { telegramId: true } } },
      });
      if (!payment?.user?.telegramId) return;
      const title = PURPOSE_TITLE[payment.type] ?? 'Оплата';
      const sum = toNum(payment.amount).toLocaleString('ru-RU');
      await sendTelegramMessage({
        chatId: payment.user.telegramId.toString(),
        text: `✅ <b>Оплата прошла</b>\n\n${title}: <b>${sum} сум</b>\nСпасибо, что пользуетесь MasterUz!`,
      });
    } catch (err) {
      logger.warn({ err, paymentId }, 'hamkor: не удалось отправить уведомление об оплате');
    }
  }
}

export const uzQrService = new UzQrService();
