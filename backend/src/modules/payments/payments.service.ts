// ============================================
// MasterUz — Payments Service
// Агент 3 (Бэкенд) + Агент 7 (Монетизация)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { PaymentStatus, PaymentType, PaymentProvider } from '@prisma/client';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { toNum } from '../../utils/helpers.js';
import { notificationService } from '../../services/notificationService.js';
import { balanceService } from '../balance/balance.service.js';
import { auditService } from '../../services/auditService.js';
import { alertRouter } from '../../services/alertRouter.js';
import crypto from 'crypto';
export class PaymentsService {
  /**
   * Обработка успешной оплаты комиссии:
   * Атомарная транзакция: статус платежа + флаг заказа
   */
  private async onCommissionPaid(paymentId: string) {
    try {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          select: { orderId: true, type: true },
        });

        if (!payment?.orderId || payment.type !== PaymentType.ORDER_COMMISSION) return;

        await tx.order.update({
          where: { id: payment.orderId },
          data: { commissionPaid: true },
        });
      });

      // Уведомление — вне транзакции (fire-and-forget)
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true },
      });
      if (payment?.orderId) {
        await notificationService.notifyMasterAssigned(payment.orderId);
      }

      logger.info({ paymentId }, 'Комиссия оплачена → мастер уведомлён');
    } catch (error) {
      logger.error({ error, paymentId }, 'Ошибка обработки оплаты комиссии');
    }
  }

  /**
   * Обработка успешной оплаты регистрационного взноса мастера
   * Атомарная транзакция: статус платежа + активация профиля
   */
  private async onRegistrationFeePaid(paymentId: string) {
    try {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          select: { userId: true, type: true },
        });

        if (!payment || payment.type !== PaymentType.REGISTRATION_FEE) return;

        await tx.masterProfile.update({
          where: { userId: payment.userId },
          data: {
            registrationPaid: true,
            registrationPaidAt: new Date(),
          },
        });
      });

      logger.info({ paymentId }, 'Регистрационный взнос оплачен → мастер активирован');
    } catch (error) {
      logger.error({ error, paymentId }, 'Ошибка обработки регистрационного взноса');
    }
  }

  /**
   * Обработка успешного пополнения баланса
   */
  private async onBalanceTopUpPaid(paymentId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { userId: true, amount: true, provider: true },
      });

      if (!payment) return;

      await balanceService.topUp(
        payment.userId,
        toNum(payment.amount),
        `Пополнение через ${payment.provider}`
      );

      logger.info({ paymentId, userId: payment.userId, amount: toNum(payment.amount) }, 'Баланс пополнен через платёжную систему');
    } catch (error) {
      logger.error({ error, paymentId }, 'Ошибка зачисления баланса после оплаты');
    }
  }

  /**
   * Вызов обработчика по типу платежа после успешной оплаты
   */
  async onPaymentCompleted(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { type: true },
    });

    if (!payment) return;

    switch (payment.type) {
      case PaymentType.ORDER_COMMISSION:
        await this.onCommissionPaid(paymentId);
        break;
      case PaymentType.REGISTRATION_FEE:
        await this.onRegistrationFeePaid(paymentId);
        break;
      case PaymentType.BALANCE_TOPUP:
        await this.onBalanceTopUpPaid(paymentId);
        break;
    }
  }

  /**
   * Создание платежа для пополнения баланса (Click / Payme / Telegram Stars)
   */
  async createBalanceTopupPayment(userId: string, amount: number, provider: PaymentProvider) {
    if (amount < 10000) {
      throw ApiError.badRequest('Минимальная сумма пополнения — 10 000 сум');
    }
    if (amount > 100000000) {
      throw ApiError.badRequest('Максимальная сумма пополнения — 100 000 000 сум');
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        type: PaymentType.BALANCE_TOPUP,
        provider,
        status: PaymentStatus.PENDING,
      },
    });

    let paymentData: any;

    switch (provider) {
      case PaymentProvider.CLICK:
        paymentData = this.generateClickPayment(payment.id, amount);
        break;
      case PaymentProvider.PAYME:
        paymentData = this.generatePaymePayment(payment.id, amount);
        break;
      case PaymentProvider.TELEGRAM_STARS:
        // Для Stars — конвертируем сумму в Stars (1 Star ≈ 1300 сум)
        const starsAmount = Math.max(1, Math.ceil(amount / 1300));
        paymentData = {
          paymentId: payment.id,
          amount,
          starsAmount,
          title: `Пополнение баланса MasterUz`,
          description: `Пополнение на ${amount.toLocaleString('ru')} сум`,
        };
        break;
      default:
        throw ApiError.badRequest('Неподдерживаемый провайдер платежей');
    }

    logger.info({ paymentId: payment.id, provider, amount, userId }, 'Платёж на пополнение баланса создан');

    return { payment, paymentData };
  }

  /**
   * Создание платежа за регистрационный взнос мастера (400 000 сум)
   */
  async createRegistrationPayment(userId: string, provider: PaymentProvider) {
    // Проверяем, что мастер ещё не оплатил
    const masterProfile = await prisma.masterProfile.findUnique({
      where: { userId },
    });

    if (!masterProfile) {
      throw ApiError.notFound('Профиль мастера не найден');
    }

    if (masterProfile.registrationPaid) {
      throw ApiError.conflict('Регистрационный взнос уже оплачен');
    }

    // Проверяем, нет ли уже pending платежа
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId,
        type: PaymentType.REGISTRATION_FEE,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPending) {
      // Отменяем старый pending
      await prisma.payment.update({
        where: { id: existingPending.id },
        data: { status: PaymentStatus.FAILED },
      });
    }

    const amount = config.platform.masterRegistrationFee;

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount,
        type: PaymentType.REGISTRATION_FEE,
        provider,
        status: PaymentStatus.PENDING,
      },
    });

    let paymentData: any;

    switch (provider) {
      case PaymentProvider.CLICK:
        paymentData = this.generateClickPayment(payment.id, amount);
        break;
      case PaymentProvider.PAYME:
        paymentData = this.generatePaymePayment(payment.id, amount);
        break;
      case PaymentProvider.TELEGRAM_STARS:
        paymentData = { paymentId: payment.id, amount };
        break;
      default:
        throw ApiError.badRequest('Неподдерживаемый провайдер платежей');
    }

    logger.info({ paymentId: payment.id, provider, amount }, 'Платёж за регистрацию создан');

    return { payment, paymentData };
  }

  /**
   * Создание платежа за комиссию (мастер оплачивает при принятии заказа)
   */
  async createCommissionPayment(
    userId: string,
    orderId: string,
    provider: PaymentProvider
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw ApiError.notFound('Заказ не найден');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        userId,
        amount: order.commissionAmount,
        type: PaymentType.ORDER_COMMISSION,
        provider,
        status: PaymentStatus.PENDING,
      },
    });

    // Генерируем ссылку/данные для провайдера
    let paymentData: any;

    switch (provider) {
      case PaymentProvider.CLICK:
        paymentData = this.generateClickPayment(payment.id, toNum(order.commissionAmount));
        break;
      case PaymentProvider.PAYME:
        paymentData = this.generatePaymePayment(payment.id, toNum(order.commissionAmount));
        break;
      case PaymentProvider.TELEGRAM_STARS:
        paymentData = { paymentId: payment.id, amount: toNum(order.commissionAmount) };
        break;
      default:
        throw ApiError.badRequest('Неподдерживаемый провайдер платежей');
    }

    logger.info({ paymentId: payment.id, provider }, 'Платёж создан');

    return { payment, paymentData };
  }
  /**
   * Обработка платежа Telegram Stars
   * Проверяет: владельца платежа, статус PENDING, уникальность telegramPaymentId
   */
  async handleTelegramStarsPayment(userId: string, paymentId: string, telegramPaymentId: string) {
    if (!paymentId || !telegramPaymentId) {
      throw ApiError.badRequest('paymentId и telegramPaymentId обязательны');
    }

    const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) {
      throw ApiError.notFound('Платёж не найден');
    }

    // Проверка владельца — пользователь может завершить только свой платёж
    if (existing.userId !== userId) {
      logger.warn({ paymentId, userId, ownerUserId: existing.userId }, '🚨 SECURITY: попытка завершить чужой платёж Telegram Stars');
      throw ApiError.forbidden('Нет доступа к этому платежу');
    }

    // Идемпотентность
    if (existing.status === PaymentStatus.COMPLETED) {
      logger.info({ paymentId }, 'Telegram Stars: платёж уже обработан, пропуск');
      return existing;
    }

    // Можно завершить только PENDING-платёж
    if (existing.status !== PaymentStatus.PENDING) {
      throw ApiError.conflict(`Платёж в статусе ${existing.status}, ожидается PENDING`);
    }

    // Защита от повторного использования telegramPaymentId (double-spend)
    const duplicate = await prisma.payment.findFirst({
      where: { providerTxId: telegramPaymentId, provider: PaymentProvider.TELEGRAM_STARS },
    });
    if (duplicate) {
      logger.warn({ paymentId, telegramPaymentId, duplicateId: duplicate.id }, '🚨 SECURITY: дублирующий telegramPaymentId');
      throw ApiError.conflict('Этот платёж Telegram Stars уже использован');
    }

    // Атомарный захват: переводим PENDING → COMPLETED одним условным апдейтом.
    // Если параллельный вызов уже завершил платёж — count=0, зачисления не будет.
    const claimed = await prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.COMPLETED,
        providerTxId: telegramPaymentId,
      },
    });
    if (claimed.count === 0) {
      logger.info({ paymentId }, 'Telegram Stars: платёж уже обработан (гонка), пропуск');
      return prisma.payment.findUnique({ where: { id: paymentId } }) as any;
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } }) as NonNullable<Awaited<ReturnType<typeof prisma.payment.findUnique>>>;

    logger.info({ paymentId: payment.id, userId }, 'Telegram Stars платёж подтверждён');

    await auditService.log({
      actorId: userId,
      action: 'payment_completed',
      entityType: 'payment',
      entityId: payment.id,
      details: { provider: 'TELEGRAM_STARS', amount: toNum(payment.amount), type: payment.type, providerTxId: telegramPaymentId },
    });

    await this.onPaymentCompleted(payment.id);

    return payment;
  }

  /**
   * Получение истории платежей пользователя
   */
  async getUserPayments(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { title: true, status: true } },
        },
      }),
      prisma.payment.count({ where: { userId } }),
    ]);

    return {
      data: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Приватные методы генерации платёжных данных ───

  private generateClickPayment(paymentId: string, amount: number) {
    return {
      url: `https://my.click.uz/services/pay?service_id=${config.click.serviceId}&merchant_id=${config.click.merchantId}&amount=${amount}&transaction_param=${paymentId}`,
      merchantId: config.click.merchantId,
      serviceId: config.click.serviceId,
      amount,
      transactionParam: paymentId,
    };
  }

  private generatePaymePayment(paymentId: string, amount: number) {
    const tiyin = Math.round(amount * 100); // Payme использует тийины
    const params = Buffer.from(
      `m=${config.payme.merchantId};ac.payment_id=${paymentId};a=${tiyin}`
    ).toString('base64');

    return {
      url: `https://checkout.paycom.uz/${params}`,
      merchantId: config.payme.merchantId,
      amount: tiyin,
      paymentId,
    };
  }
}

export const paymentsService = new PaymentsService();
