// ============================================
// MasterUz — Balance Service (Антифрод / Эскроу)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { Prisma } from '@prisma/client';
import { toNum, moneyAdd, moneySub } from '../../utils/helpers.js';

// Используем строковые литералы для типов транзакций (совместимо с Prisma enum)
const TxType = {
  TOPUP: 'TOPUP',
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  PENALTY: 'PENALTY',
  REFUND: 'REFUND',
  COMMISSION: 'COMMISSION',
  PAYOUT: 'PAYOUT',
  ADMIN_TOPUP: 'ADMIN_TOPUP',
  ADMIN_WITHDRAW: 'ADMIN_WITHDRAW',
} as const;

type PrismaTx = Prisma.TransactionClient;

export class BalanceService {
  /**
   * Получить текущий баланс пользователя
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw ApiError.notFound('Пользователь не найден');
    return toNum(user.balance);
  }

  /**
   * Пополнить баланс
   */
  async topUp(userId: string, amount: number, description?: string) {
    if (amount <= 0) throw ApiError.badRequest('Сумма должна быть больше 0');

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const balanceBefore = toNum(user.balance);
      const balanceAfter = moneyAdd(balanceBefore, amount);

      const [updatedUser, transaction] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.TOPUP,
            amount,
            balanceBefore,
            balanceAfter,
            description: description || 'Пополнение баланса',
          },
        }),
      ]);

      return { balance: toNum(updatedUser.balance), transaction };
    });

    logger.info({ userId, amount }, 'Баланс пополнен');
    return result;
  }

  /**
   * Админское зачисление средств пользователю
   */
  async adminTopUp(userId: string, amount: number, adminId: string, reason?: string) {
    if (amount <= 0) throw ApiError.badRequest('Сумма должна быть больше 0');

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, username: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const balanceBefore = toNum(user.balance);
      const balanceAfter = moneyAdd(balanceBefore, amount);

      const [updatedUser, transaction] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.ADMIN_TOPUP as any,
            amount,
            balanceBefore,
            balanceAfter,
            description: reason || `Зачисление администратором (${adminId})`,
            metadata: { adminId, reason: reason || 'Зачисление администратором' } as any,
          },
        }),
      ]);

      return { balance: toNum(updatedUser.balance), transaction };
    });

    logger.info({ userId, amount, adminId, reason }, 'Админ зачислил средства');
    return result;
  }

  /**
   * Админское списание средств с пользователя
   */
  async adminWithdraw(userId: string, amount: number, adminId: string, reason?: string) {
    if (amount <= 0) throw ApiError.badRequest('Сумма должна быть больше 0');

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, username: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const balanceBefore = toNum(user.balance);
      const balanceAfter = moneySub(balanceBefore, amount);

      const [updatedUser, transaction] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.ADMIN_WITHDRAW as any,
            amount: -amount,
            balanceBefore,
            balanceAfter,
            description: reason || `Списание администратором (${adminId})`,
            metadata: { adminId, reason: reason || 'Списание администратором' } as any,
          },
        }),
      ]);

      return { balance: toNum(updatedUser.balance), transaction };
    });

    logger.info({ userId, amount, adminId, reason }, 'Админ списал средства');
    return result;
  }

  /**
   * Заблокировать средства (эскроу) при создании заказа
   */
  async holdFunds(userId: string, amount: number, orderId: string) {
    if (amount <= 0) throw ApiError.badRequest('Сумма блокировки должна быть больше 0');

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const bal = toNum(user.balance);
      if (bal < amount) {
        throw ApiError.badRequest(
          `Недостаточно средств. Баланс: ${bal.toLocaleString('ru')} сум, ` +
          `нужно: ${amount.toLocaleString('ru')} сум`
        );
      }

      const balanceBefore = bal;
      const balanceAfter = moneySub(balanceBefore, amount);

      const [updatedUser, transaction] = await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.ESCROW_HOLD,
            amount: -amount,
            balanceBefore,
            balanceAfter,
            orderId,
            description: `Блокировка средств по заказу`,
          },
        }),
      ]);

      return { balance: toNum(updatedUser.balance), transaction };
    });

    logger.info({ userId, amount, orderId }, 'Средства заблокированы (эскроу)');
    return result;
  }

  /**
   * Разблокировать средства (перевод мастеру после подтверждения)
   */
  async releaseFunds(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, escrowAmount: true, clientId: true, masterId: true,
        price: true, commissionAmount: true, visitFee: true,
      },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.masterId) throw ApiError.badRequest('Мастер не назначен');
    if (toNum(order.escrowAmount) <= 0) throw ApiError.badRequest('Нет заблокированных средств');

    // Мастер получает: цена заказа - комиссия платформы
    const escrow = toNum(order.escrowAmount);
    const commission = toNum(order.commissionAmount);
    const masterPayout = moneySub(escrow, commission);

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      // Начисляем мастеру
      const master = await tx.user.findUnique({
        where: { id: order.masterId! },
        select: { balance: true },
      });
      if (!master) throw ApiError.notFound('Мастер не найден');

      const masterBalanceBefore = toNum(master.balance);
      const masterBalanceAfter = moneyAdd(masterBalanceBefore, masterPayout);

      await Promise.all([
        // Зачисляем мастеру
        tx.user.update({
          where: { id: order.masterId! },
          data: { balance: masterBalanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId: order.masterId!,
            type: TxType.PAYOUT,
            amount: masterPayout,
            balanceBefore: masterBalanceBefore,
            balanceAfter: masterBalanceAfter,
            orderId,
            description: `Оплата за выполненный заказ`,
          },
        }),
        // Фиксируем комиссию платформы
        tx.balanceTransaction.create({
          data: {
            userId: order.masterId!,
            type: TxType.COMMISSION,
            amount: -commission,
            balanceBefore: masterBalanceAfter,
            balanceAfter: masterBalanceAfter,
            orderId,
            description: `Комиссия платформы (${commission} сум)`,
          },
        }),
        // Обнуляем эскроу на заказе
        tx.order.update({
          where: { id: orderId },
          data: { escrowAmount: 0, commissionPaid: true },
        }),
      ]);

      return { masterPayout, commission };
    });

    logger.info({ orderId, masterPayout, commission }, 'Средства переведены мастеру');
    return result;
  }

  /**
   * Возврат средств клиенту (при отмене до принятия)
   */
  async refundFunds(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, escrowAmount: true, clientId: true },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    const escrowAmt = toNum(order.escrowAmount);
    if (escrowAmt <= 0) return;

    await prisma.$transaction(async (tx: PrismaTx) => {
      const client = await tx.user.findUnique({
        where: { id: order.clientId },
        select: { balance: true },
      });
      if (!client) throw ApiError.notFound('Клиент не найден');

      const balanceBefore = toNum(client.balance);
      const balanceAfter = moneyAdd(balanceBefore, escrowAmt);

      await Promise.all([
        tx.user.update({
          where: { id: order.clientId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId: order.clientId,
            type: TxType.REFUND,
            amount: escrowAmt,
            balanceBefore,
            balanceAfter,
            orderId,
            description: 'Возврат средств при отмене заказа',
          },
        }),
        tx.order.update({
          where: { id: orderId },
          data: { escrowAmount: 0 },
        }),
      ]);
    });

    logger.info({ orderId, amount: escrowAmt }, 'Средства возвращены клиенту');
  }

  /**
   * Списать комиссию с мастера (при принятии заказа на оценку)
   */
  async chargeCommission(userId: string, amount: number, orderId: string) {
    if (amount <= 0) return;

    await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const bal = toNum(user.balance);
      if (bal < amount) {
        throw ApiError.badRequest(
          `Недостаточно средств. Баланс: ${bal.toLocaleString('ru')} сум, ` +
          `нужно: ${amount.toLocaleString('ru')} сум`
        );
      }

      const balanceBefore = bal;
      const balanceAfter = moneySub(balanceBefore, amount);

      await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.COMMISSION,
            amount: -amount,
            balanceBefore,
            balanceAfter,
            orderId,
            description: `Комиссия за принятие заказа: ${amount.toLocaleString('ru')} сум`,
          },
        }),
      ]);
    });

    logger.info({ userId, amount, orderId }, 'Комиссия списана с мастера');
  }

  /**
   * Списать штраф за отмену
   */
  async chargePenalty(userId: string, amount: number, orderId: string, reason: string) {
    if (amount <= 0) return;

    await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      if (!user) throw ApiError.notFound('Пользователь не найден');

      const balanceBefore = toNum(user.balance);
      const balanceAfter = moneySub(balanceBefore, amount);

      await Promise.all([
        tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        }),
        tx.balanceTransaction.create({
          data: {
            userId,
            type: TxType.PENALTY,
            amount: -amount,
            balanceBefore,
            balanceAfter,
            orderId,
            description: reason,
          },
        }),
      ]);
    });

    logger.info({ userId, amount, orderId, reason }, 'Штраф списан');
  }

  /**
   * История транзакций пользователя
   */
  async getTransactions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.balanceTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.balanceTransaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

export const balanceService = new BalanceService();
