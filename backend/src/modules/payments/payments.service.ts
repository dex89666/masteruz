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
import crypto from 'crypto';

export class PaymentsService {
  /**
   * Обработка успешной оплаты комиссии:
   * — помечает заказ как commission_paid
   * — отправляет Telegram push мастеру с данными клиента
   */
  private async onCommissionPaid(paymentId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true, type: true },
      });

      if (!payment?.orderId || payment.type !== PaymentType.ORDER_COMMISSION) return;

      // Помечаем заказ: комиссия оплачена
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { commissionPaid: true },
      });

      // Отправляем мастеру данные клиента (телефон, адрес, геолокацию) через Telegram
      await notificationService.notifyMasterAssigned(payment.orderId);

      logger.info({ paymentId, orderId: payment.orderId }, 'Комиссия оплачена → мастер уведомлён');
    } catch (error) {
      logger.error({ error, paymentId }, 'Ошибка обработки оплаты комиссии');
    }
  }

  /**
   * Обработка успешной оплаты регистрационного взноса мастера (400 000 сум)
   */
  private async onRegistrationFeePaid(paymentId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { userId: true, type: true },
      });

      if (!payment || payment.type !== PaymentType.REGISTRATION_FEE) return;

      // Активируем мастерский профиль
      await prisma.masterProfile.update({
        where: { userId: payment.userId },
        data: {
          registrationPaid: true,
          registrationPaidAt: new Date(),
        },
      });

      logger.info({ paymentId, userId: payment.userId }, 'Регистрационный взнос оплачен → мастер активирован');
    } catch (error) {
      logger.error({ error, paymentId }, 'Ошибка обработки регистрационного взноса');
    }
  }

  /**
   * Вызов обработчика по типу платежа после успешной оплаты
   */
  private async onPaymentCompleted(paymentId: string) {
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
    }
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
   * Обработка webhook от Click
   */
  async handleClickWebhook(data: any) {
    // Верификация подписи Click (MD5 по спецификации Click API)
    const { click_trans_id, merchant_trans_id, amount, sign_string, sign_time, error: clickError, action } = data;

    if (!click_trans_id || !merchant_trans_id || !sign_string) {
      logger.warn({ data }, '⚠️ Click webhook: отсутствуют обязательные поля');
      throw ApiError.badRequest('Invalid signature');
    }

    // Click подпись: MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
    const signSource = `${click_trans_id}${config.click.serviceId}${config.click.secretKey}${merchant_trans_id}${amount}${action || 0}${sign_time || ''}`;
    const expectedSign = crypto
      .createHash('md5')
      .update(signSource)
      .digest('hex');

    if (sign_string !== expectedSign) {
      logger.warn(
        { click_trans_id, merchant_trans_id, amount, receivedSign: sign_string, expectedSign },
        '🚨 SECURITY: Click webhook invalid signature — possible forgery attempt'
      );
      throw ApiError.badRequest('Invalid signature');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: merchant_trans_id },
    });

    if (!payment) {
      throw ApiError.notFound('Платёж не найден');
    }

    if (clickError === '0') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          providerTxId: String(click_trans_id),
        },
      });

      logger.info({ paymentId: payment.id }, 'Click платёж подтверждён');

      // Обработка по типу платежа
      await this.onPaymentCompleted(payment.id);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: { error: clickError },
        },
      });
    }

    return { success: true };
  }

  /**
   * Обработка webhook от Payme
   */
  async handlePaymeWebhook(data: any) {
    const { method, params } = data;

    // Проверяем авторизацию Payme
    // В реальном проекте проверяем Basic Auth заголовок

    switch (method) {
      case 'CheckPerformTransaction': {
        const payment = await prisma.payment.findUnique({
          where: { id: params.account.payment_id },
        });
        if (!payment) {
          return { error: { code: -31050, message: 'Платёж не найден' } };
        }
        if (toNum(payment.amount) * 100 !== params.amount) {
          return { error: { code: -31001, message: 'Неверная сумма' } };
        }
        return { result: { allow: true } };
      }

      case 'CreateTransaction': {
        const payment = await prisma.payment.update({
          where: { id: params.account.payment_id },
          data: {
            status: PaymentStatus.PROCESSING,
            providerTxId: params.id,
          },
        });
        return {
          result: {
            create_time: Date.now(),
            transaction: payment.id,
            state: 1,
          },
        };
      }

      case 'PerformTransaction': {
        const payment = await prisma.payment.update({
          where: { providerTxId: params.id },
          data: { status: PaymentStatus.COMPLETED },
        });

        logger.info({ paymentId: payment.id }, 'Payme платёж подтверждён');

        // Обработка по типу платежа
        await this.onPaymentCompleted(payment.id);

        return {
          result: {
            perform_time: Date.now(),
            transaction: payment.id,
            state: 2,
          },
        };
      }

      case 'CancelTransaction': {
        const payment = await prisma.payment.update({
          where: { providerTxId: params.id },
          data: { status: PaymentStatus.REFUNDED },
        });
        return {
          result: {
            cancel_time: Date.now(),
            transaction: payment.id,
            state: -1,
          },
        };
      }

      default:
        return { error: { code: -32601, message: 'Метод не найден' } };
    }
  }

  /**
   * Обработка платежа Telegram Stars
   */
  async handleTelegramStarsPayment(paymentId: string, telegramPaymentId: string) {
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        providerTxId: telegramPaymentId,
      },
    });

    logger.info({ paymentId: payment.id }, 'Telegram Stars платёж подтверждён');

    // Обработка по типу платежа
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
    const params = Buffer.from(
      `m=${config.payme.merchantId};ac.payment_id=${paymentId};a=${amount * 100}`
    ).toString('base64');

    return {
      url: `https://checkout.paycom.uz/${params}`,
      merchantId: config.payme.merchantId,
      amount: amount * 100, // Payme использует тийины
      paymentId,
    };
  }
}

export const paymentsService = new PaymentsService();
