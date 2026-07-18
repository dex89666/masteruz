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

// ─── Протокол Payme Merchant API ──────────────────────────────────
// Состояния транзакции Payme
const PAYME_STATE = {
  CREATED: 1,          // транзакция создана, ожидает проведения
  COMPLETED: 2,        // проведена (оплачена)
  CANCELLED: -1,       // отменена до проведения
  CANCELLED_AFTER: -2, // отменена/возвращена после проведения
} as const;

// Коды ошибок Payme (JSON-RPC)
const PAYME_ERR = {
  INVALID_AMOUNT: -31001,   // неверная сумма
  TX_NOT_FOUND: -31003,     // транзакция не найдена
  CANT_PERFORM: -31008,     // невозможно выполнить операцию
  CANT_CANCEL: -31007,      // невозможно отменить (услуга оказана)
  ACCOUNT_NOT_FOUND: -31050, // заказ/платёж по account не найден
  METHOD_NOT_FOUND: -32601,  // метод не найден
  UNAUTHORIZED: -32504,      // недостаточно привилегий (авторизация)
} as const;

type PaymeMessage = { ru: string; uz: string; en: string };

function paymeMessage(ru: string, uz: string, en: string): PaymeMessage {
  return { ru, uz, en };
}

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

    // Идемпотентность: повторный webhook для уже обработанного платежа
    if (payment.status === PaymentStatus.COMPLETED) {
      logger.info({ paymentId: payment.id }, 'Click webhook: платёж уже обработан, пропуск');
      return { success: true };
    }

    if (clickError === '0') {
      // Атомарный захват: переводим в COMPLETED только если ещё не завершён.
      // Защищает от двойного зачисления при параллельных ретраях webhook.
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.COMPLETED } },
        data: {
          status: PaymentStatus.COMPLETED,
          providerTxId: String(click_trans_id),
        },
      });
      if (claimed.count === 0) {
        logger.info({ paymentId: payment.id }, 'Click webhook: платёж уже обработан (гонка), пропуск зачисления');
        return { success: true };
      }

      logger.info({ paymentId: payment.id }, 'Click платёж подтверждён');

      await auditService.log({
        actorId: payment.userId,
        action: 'payment_completed',
        entityType: 'payment',
        entityId: payment.id,
        details: { provider: 'CLICK', amount: toNum(payment.amount), type: payment.type, providerTxId: String(click_trans_id) },
      });

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

      // FINANCE-алерт: платёж от провайдера упал на webhook.
      alertRouter.dispatch({
        type: 'payment_failed',
        title: '💳 Платёж Click отклонён',
        message:
          `Платёж ${payment.id} от провайдера Click завершился ошибкой.\n` +
          `Сумма: ${toNum(payment.amount).toLocaleString('ru')} сум\n` +
          `Тип: ${payment.type}\n` +
          `Код ошибки Click: ${clickError ?? '—'}\n` +
          `User ID: ${payment.userId}`,
        data: {
          paymentId: payment.id,
          provider: 'CLICK',
          amount: toNum(payment.amount),
          type: payment.type,
          userId: payment.userId,
          error: clickError,
        },
      }).catch(() => {});
    }

    return { success: true };
  }

  // ─── Payme Merchant API: хелперы ───

  /** Сумма платежа в тийинах (целое). */
  private amountToTiyin(amount: any): number {
    return Math.round(toNum(amount) * 100);
  }

  /** Истёк ли таймаут транзакции (по протоколу — 12 часов). */
  private isTransactionExpired(createTime: Date): boolean {
    return Date.now() - createTime.getTime() > config.payme.transactionTimeoutMs;
  }

  /** Формирует JSON-RPC ответ с результатом (эхо id запроса). */
  private paymeOk(data: any, result: any) {
    return { jsonrpc: '2.0', id: data?.id ?? null, result };
  }

  /** Формирует JSON-RPC ответ с ошибкой (эхо id запроса). */
  private paymeFail(data: any, code: number, message: PaymeMessage, extra?: string) {
    const error: any = { code, message };
    if (extra !== undefined) error.data = extra;
    return { jsonrpc: '2.0', id: data?.id ?? null, error };
  }

  /**
   * Проверяет платёж по account.payment_id и сумме.
   * Возвращает { payment } при успехе либо { error } (готовый JSON-RPC ответ).
   */
  private async checkPayable(data: any, params: any): Promise<{ payment?: any; error?: any }> {
    const paymentId = params?.account?.payment_id;
    if (!paymentId) {
      return {
        error: this.paymeFail(
          data,
          PAYME_ERR.ACCOUNT_NOT_FOUND,
          paymeMessage('Не указан номер заказа', 'Buyurtma raqami ko‘rsatilmagan', 'Order id is missing'),
          'payment_id'
        ),
      };
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return {
        error: this.paymeFail(
          data,
          PAYME_ERR.ACCOUNT_NOT_FOUND,
          paymeMessage('Платёж не найден', 'To‘lov topilmadi', 'Payment not found'),
          'payment_id'
        ),
      };
    }

    if (this.amountToTiyin(payment.amount) !== params.amount) {
      return {
        error: this.paymeFail(
          data,
          PAYME_ERR.INVALID_AMOUNT,
          paymeMessage('Неверная сумма', 'Noto‘g‘ri summa', 'Invalid amount')
        ),
      };
    }

    // Платёж уже завершён/возвращён/провален — повторно оплатить нельзя.
    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.PROCESSING) {
      return {
        error: this.paymeFail(
          data,
          PAYME_ERR.CANT_PERFORM,
          paymeMessage(
            'Заказ уже обработан или недоступен для оплаты',
            'Buyurtma allaqachon qayta ishlangan',
            'Order is already processed or not payable'
          )
        ),
      };
    }

    return { payment };
  }

  /**
   * Обработка webhook от Payme (Merchant API).
   * Полная реализация протокола: CheckPerformTransaction, CreateTransaction,
   * PerformTransaction, CancelTransaction, CheckTransaction, GetStatement.
   */
  async handlePaymeWebhook(data: any) {
    const { method, params } = data ?? {};

    switch (method) {
      // ── Проверка возможности проведения ──────────────────────────
      case 'CheckPerformTransaction': {
        const { payment, error } = await this.checkPayable(data, params);
        if (error) return error;
        return this.paymeOk(data, {
          allow: true,
          detail: this.buildFiscalDetail(payment),
        });
      }

      // ── Создание транзакции ──────────────────────────────────────
      case 'CreateTransaction': {
        const paymeId = params.id;

        // Идемпотентность: транзакция с этим id уже существует.
        const existing = await prisma.paymentTransaction.findUnique({ where: { paymeId } });
        if (existing) {
          if (existing.state !== PAYME_STATE.CREATED) {
            return this.paymeFail(
              data,
              PAYME_ERR.CANT_PERFORM,
              paymeMessage('Невозможно выполнить операцию', 'Amalni bajarib bo‘lmaydi', 'Unable to perform operation')
            );
          }
          if (this.isTransactionExpired(existing.createTime)) {
            await prisma.paymentTransaction.update({
              where: { id: existing.id },
              data: { state: PAYME_STATE.CANCELLED, reason: 4, cancelTime: new Date() },
            });
            return this.paymeFail(
              data,
              PAYME_ERR.CANT_PERFORM,
              paymeMessage('Срок транзакции истёк', 'Tranzaksiya muddati tugadi', 'Transaction timed out')
            );
          }
          return this.paymeOk(data, {
            create_time: existing.createTime.getTime(),
            transaction: existing.id,
            state: PAYME_STATE.CREATED,
          });
        }

        // Новая транзакция: перепроверяем платёж.
        const { payment, error } = await this.checkPayable(data, params);
        if (error) return error;

        // Нельзя создать вторую активную транзакцию для того же платежа.
        const active = await prisma.paymentTransaction.findFirst({
          where: { paymentId: payment.id, state: PAYME_STATE.CREATED },
        });
        if (active) {
          return this.paymeFail(
            data,
            PAYME_ERR.CANT_PERFORM,
            paymeMessage('Заказ уже в процессе оплаты', 'Buyurtma to‘lov jarayonida', 'Order is already in process')
          );
        }

        const tx = await prisma.paymentTransaction.create({
          data: {
            paymeId,
            paymentId: payment.id,
            amount: params.amount,
            state: PAYME_STATE.CREATED,
            createTime: new Date(params.time),
          },
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PROCESSING, providerTxId: paymeId },
        });

        logger.info({ paymentId: payment.id, paymeId }, 'Payme: транзакция создана');

        return this.paymeOk(data, {
          create_time: tx.createTime.getTime(),
          transaction: tx.id,
          state: PAYME_STATE.CREATED,
        });
      }

      // ── Проведение транзакции ────────────────────────────────────
      case 'PerformTransaction': {
        const tx = await prisma.paymentTransaction.findUnique({ where: { paymeId: params.id } });
        if (!tx) {
          return this.paymeFail(
            data,
            PAYME_ERR.TX_NOT_FOUND,
            paymeMessage('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found')
          );
        }

        // Идемпотентность: уже проведена.
        if (tx.state === PAYME_STATE.COMPLETED) {
          return this.paymeOk(data, {
            perform_time: tx.performTime ? tx.performTime.getTime() : Date.now(),
            transaction: tx.id,
            state: PAYME_STATE.COMPLETED,
          });
        }

        if (tx.state !== PAYME_STATE.CREATED) {
          return this.paymeFail(
            data,
            PAYME_ERR.CANT_PERFORM,
            paymeMessage('Невозможно провести транзакцию', 'Tranzaksiyani bajarib bo‘lmaydi', 'Unable to perform transaction')
          );
        }

        if (this.isTransactionExpired(tx.createTime)) {
          await prisma.paymentTransaction.update({
            where: { id: tx.id },
            data: { state: PAYME_STATE.CANCELLED, reason: 4, cancelTime: new Date() },
          });
          return this.paymeFail(
            data,
            PAYME_ERR.CANT_PERFORM,
            paymeMessage('Срок транзакции истёк', 'Tranzaksiya muddati tugadi', 'Transaction timed out')
          );
        }

        const performTime = new Date();

        // Атомарный захват транзакции Payme: только из состояния CREATED.
        const txClaimed = await prisma.paymentTransaction.updateMany({
          where: { id: tx.id, state: PAYME_STATE.CREATED },
          data: { state: PAYME_STATE.COMPLETED, performTime },
        });
        if (txClaimed.count === 0) {
          const fresh = await prisma.paymentTransaction.findUnique({ where: { id: tx.id } });
          return this.paymeOk(data, {
            perform_time: fresh?.performTime ? fresh.performTime.getTime() : performTime.getTime(),
            transaction: tx.id,
            state: fresh?.state ?? PAYME_STATE.COMPLETED,
          });
        }

        // Атомарный захват платежа: защита от двойного зачисления при ретраях.
        const paymentClaimed = await prisma.payment.updateMany({
          where: { id: tx.paymentId, status: { not: PaymentStatus.COMPLETED } },
          data: { status: PaymentStatus.COMPLETED },
        });

        if (paymentClaimed.count > 0) {
          const payment = await prisma.payment.findUnique({ where: { id: tx.paymentId } });
          if (payment) {
            logger.info({ paymentId: payment.id, paymeId: params.id }, 'Payme платёж подтверждён');

            await auditService.log({
              actorId: payment.userId,
              action: 'payment_completed',
              entityType: 'payment',
              entityId: payment.id,
              details: { provider: 'PAYME', amount: toNum(payment.amount), type: payment.type, providerTxId: params.id },
            });

            await this.onPaymentCompleted(payment.id);

            // Фискализация чека. Ошибка чека не откатывает платёж.
            try {
              await this.createReceipt(payment);
            } catch (err) {
              logger.warn({ err, paymentId: payment.id }, 'Payme: ошибка фискализации (receipts.create) — платёж не откатываем');
            }
          }
        }

        return this.paymeOk(data, {
          perform_time: performTime.getTime(),
          transaction: tx.id,
          state: PAYME_STATE.COMPLETED,
        });
      }

      // ── Отмена транзакции ────────────────────────────────────────
      case 'CancelTransaction': {
        const tx = await prisma.paymentTransaction.findUnique({ where: { paymeId: params.id } });
        if (!tx) {
          return this.paymeFail(
            data,
            PAYME_ERR.TX_NOT_FOUND,
            paymeMessage('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found')
          );
        }

        // Идемпотентность: уже отменена.
        if (tx.state === PAYME_STATE.CANCELLED || tx.state === PAYME_STATE.CANCELLED_AFTER) {
          return this.paymeOk(data, {
            cancel_time: tx.cancelTime ? tx.cancelTime.getTime() : Date.now(),
            transaction: tx.id,
            state: tx.state,
          });
        }

        const cancelTime = new Date();
        const wasPerformed = tx.state === PAYME_STATE.COMPLETED;
        const newState = wasPerformed ? PAYME_STATE.CANCELLED_AFTER : PAYME_STATE.CANCELLED;

        await prisma.paymentTransaction.update({
          where: { id: tx.id },
          data: { state: newState, cancelTime, reason: params.reason ?? null },
        });

        const payment = await prisma.payment.update({
          where: { id: tx.paymentId },
          data: { status: wasPerformed ? PaymentStatus.REFUNDED : PaymentStatus.FAILED },
        });

        await auditService.log({
          actorId: payment.userId,
          action: wasPerformed ? 'payment_refunded' : 'payment_cancelled',
          entityType: 'payment',
          entityId: payment.id,
          details: { provider: 'PAYME', amount: toNum(payment.amount), providerTxId: params.id, reason: params.reason ?? null },
        });

        // FINANCE-алерт: крупный возврат после проведения требует внимания.
        if (wasPerformed) {
          const refundAmount = toNum(payment.amount);
          const LARGE_REFUND_THRESHOLD = Number(process.env.FINANCE_LARGE_REFUND_THRESHOLD ?? 500_000);
          if (refundAmount >= LARGE_REFUND_THRESHOLD) {
            alertRouter.dispatch({
              type: 'refund_large',
              title: '💸 Крупный возврат Payme',
              message:
                `Возврат ${refundAmount.toLocaleString('ru')} сум по платежу ${payment.id}.\n` +
                `Тип: ${payment.type}\n` +
                `User ID: ${payment.userId}\n` +
                `Payme TX: ${params.id}`,
              data: {
                paymentId: payment.id,
                provider: 'PAYME',
                amount: refundAmount,
                userId: payment.userId,
                providerTxId: params.id,
              },
            }).catch(() => {});
          }
        }

        return this.paymeOk(data, {
          cancel_time: cancelTime.getTime(),
          transaction: tx.id,
          state: newState,
        });
      }

      // ── Проверка состояния транзакции ────────────────────────────
      case 'CheckTransaction': {
        const tx = await prisma.paymentTransaction.findUnique({ where: { paymeId: params.id } });
        if (!tx) {
          return this.paymeFail(
            data,
            PAYME_ERR.TX_NOT_FOUND,
            paymeMessage('Транзакция не найдена', 'Tranzaksiya topilmadi', 'Transaction not found')
          );
        }
        return this.paymeOk(data, {
          create_time: tx.createTime.getTime(),
          perform_time: tx.performTime ? tx.performTime.getTime() : 0,
          cancel_time: tx.cancelTime ? tx.cancelTime.getTime() : 0,
          transaction: tx.id,
          state: tx.state,
          reason: tx.reason ?? null,
        });
      }

      // ── Выписка транзакций (сверка) ──────────────────────────────
      case 'GetStatement': {
        const from = new Date(params.from);
        const to = new Date(params.to);
        const txs = await prisma.paymentTransaction.findMany({
          where: { createTime: { gte: from, lte: to } },
          orderBy: { createTime: 'asc' },
        });
        return this.paymeOk(data, {
          transactions: txs.map((t) => ({
            id: t.paymeId,
            time: t.createTime.getTime(),
            amount: toNum(t.amount),
            account: { payment_id: t.paymentId },
            create_time: t.createTime.getTime(),
            perform_time: t.performTime ? t.performTime.getTime() : 0,
            cancel_time: t.cancelTime ? t.cancelTime.getTime() : 0,
            transaction: t.id,
            state: t.state,
            reason: t.reason ?? null,
          })),
        });
      }

      default:
        return this.paymeFail(
          data,
          PAYME_ERR.METHOD_NOT_FOUND,
          paymeMessage('Метод не найден', 'Metod topilmadi', 'Method not found')
        );
    }
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
   * Завершает платёж, оплаченный через Subscribe API (one-click / привязанная карта).
   * Идемпотентно: атомарный захват PENDING/PROCESSING → COMPLETED, аудит,
   * доменная логика по типу платежа и фискализация чека.
   */
  async finalizeSubscribeCharge(paymentId: string, providerTxId?: string) {
    const claimed = await prisma.payment.updateMany({
      where: { id: paymentId, status: { not: PaymentStatus.COMPLETED } },
      data: { status: PaymentStatus.COMPLETED, provider: PaymentProvider.PAYME, providerTxId: providerTxId ?? undefined },
    });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;

    if (claimed.count === 0) {
      logger.info({ paymentId }, 'Subscribe charge: платёж уже завершён, пропуск');
      return payment;
    }

    await auditService.log({
      actorId: payment.userId,
      action: 'payment_completed',
      entityType: 'payment',
      entityId: payment.id,
      details: { provider: 'PAYME_SUBSCRIBE', amount: toNum(payment.amount), type: payment.type, providerTxId: providerTxId ?? null },
    });

    await this.onPaymentCompleted(payment.id);

    try {
      await this.createReceipt(payment);
    } catch (err) {
      logger.warn({ err, paymentId: payment.id }, 'Subscribe charge: ошибка фискализации (receipts.create) — платёж не откатываем');
    }

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

  /**
   * Человекочитаемое наименование позиции для чека по типу платежа.
   */
  private async receiptTitle(payment: any): Promise<string> {
    try {
      if (payment.type === PaymentType.ORDER_COMMISSION && payment.orderId) {
        const order = await prisma.order.findUnique({ where: { id: payment.orderId }, select: { title: true } });
        return order?.title ? `Комиссия — ${order.title}` : 'Комиссия заказа';
      }
      if (payment.type === PaymentType.REGISTRATION_FEE) return 'Регистрационный взнос';
      if (payment.type === PaymentType.BALANCE_TOPUP) return 'Пополнение баланса';
    } catch {
      // не критично — вернём дефолт
    }
    return 'Платёж MasterUz';
  }

  /**
   * Формирует позиции чека для фискализации (receipts.create / detail).
   * Формула Payme: transaction AMOUNT == Σ((price*count) - discount).
   * Здесь одна позиция на всю сумму. ИКПУ/package_code/НДС берутся из конфига
   * (PAYME_FISCAL_*), при динамических ИКПУ код можно переопределить per-item.
   */
  private buildReceiptItems(payment: any, title: string) {
    const tiyin = this.amountToTiyin(payment.amount);
    const fiscal = config.payme.fiscal;
    return [
      {
        title,
        price: tiyin,
        count: 1,
        code: fiscal.ikpuCode || (payment.orderId ?? payment.id),
        package_code: fiscal.packageCode || '',
        vat_percent: fiscal.vatPercent,
      },
    ];
  }

  /**
   * Блок detail для CheckPerformTransaction (фискальные данные до оплаты).
   * Использует те же позиции, что и receipts.create.
   */
  private buildFiscalDetail(payment: any) {
    // detail строим только если задан ИКПУ (иначе Payme фискализирует по кассе).
    if (!config.payme.fiscal.ikpuCode) return undefined;
    const tiyin = this.amountToTiyin(payment.amount);
    return {
      receipt_type: config.payme.fiscal.receiptType,
      items: [
        {
          title: 'Платёж MasterUz',
          price: tiyin,
          count: 1,
          code: config.payme.fiscal.ikpuCode,
          package_code: config.payme.fiscal.packageCode || '',
          vat_percent: config.payme.fiscal.vatPercent,
        },
      ],
    };
  }

  /**
   * Создаёт фискальный чек через Payme `receipts.create`.
   * Ошибки фискализации логируем, но не откатываем основной платёж.
   * Публичный метод — вызывается из PerformTransaction и напрямую в тестах.
   */
  async createReceipt(payment: any) {
    if (!payment) return;

    const merchantId = config.payme.useSandbox ? (config.payme.sandboxMerchantId || config.payme.merchantId) : config.payme.merchantId;
    const merchantKey = config.payme.useSandbox ? (config.payme.sandboxMerchantKey || config.payme.merchantKey) : config.payme.merchantKey;

    if (!merchantId || !merchantKey) {
      logger.warn({ paymentId: payment.id }, 'Payme: отсутствуют credentials для фискализации (PAYME_MERCHANT_KEY)');
      return;
    }

    const baseUrl = config.payme.useSandbox ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz';

    const title = await this.receiptTitle(payment);
    const amount = this.amountToTiyin(payment.amount); // тийины
    const items = this.buildReceiptItems(payment, title);

    const body = {
      id: Date.now(),
      method: 'receipts.create',
      params: {
        amount,
        account: { order_id: payment.id },
        detail: {
          receipt_type: config.payme.fiscal.receiptType,
          items,
        },
      },
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _fetch = (globalThis as any).fetch as (u: string, init?: any) => Promise<{ ok: boolean; json: () => Promise<any>; text?: () => Promise<string> }>;
      const res = await _fetch(`${baseUrl}/api`, {
        method: 'POST',
        headers: {
          'X-Auth': `${merchantId}:${merchantKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await (res.text ? res.text() : Promise.resolve(''));
        logger.warn({ paymentId: payment.id, status: res.ok, text: txt }, 'Payme receipts.create: non-OK response');
        return;
      }

      const data = await res.json();
      if (data?.error) {
        logger.warn({ paymentId: payment.id, error: data.error }, 'Payme receipts.create returned error');
      } else {
        logger.info({ paymentId: payment.id, result: data.result }, 'Payme: чек создан (receipts.create)');
      }
    } catch (err) {
      logger.warn({ err, paymentId: payment.id }, 'Payme receipts.create failed');
    }
  }
}

export const paymentsService = new PaymentsService();
