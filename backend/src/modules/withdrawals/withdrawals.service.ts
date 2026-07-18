// ============================================
// MasterUz — Вывод средств мастером
// ============================================
//
// Мастер выводит заработанное с внутреннего баланса на свою карту.
//
// ГЛАВНОЕ ПРАВИЛО: деньги списываются с баланса В МОМЕНТ СОЗДАНИЯ заявки,
// а не при её одобрении. Иначе мастер мог бы подать несколько заявок на всю
// сумму или потратить те же деньги, пока заявка в очереди, — и платформа
// ушла бы в минус. При отклонении/отзыве сумма возвращается.
//
// Обработка ручная: админ видит очередь, переводит деньги и отмечает заявку
// выполненной. Архитектура готова к подключению API выплат позже — достаточно
// заменить тело markCompleted на вызов провайдера.

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { toNum, moneyAdd, moneySub, moneyMul } from '../../utils/helpers.js';
import { auditService } from '../../services/auditService.js';
import { alertRouter } from '../../services/alertRouter.js';
import {
  getConfigNumber,
  getConfigBool,
  PLATFORM_CONFIG_KEYS,
} from '../../services/platformConfigService.js';

// Статусы, из которых заявку ещё можно отменить/отклонить (деньги вернутся).
const REFUNDABLE: string[] = ['PENDING', 'PROCESSING'];

export class WithdrawalsService {
  /**
   * Создать заявку на вывод.
   * Баланс списывается атомарно: условный updateMany не даст уйти в минус
   * при параллельных запросах (двойной клик, две вкладки).
   */
  async create(userId: string, data: { amount: number; cardId: string }) {
    const enabled = await getConfigBool(PLATFORM_CONFIG_KEYS.withdrawalEnabled, true);
    if (!enabled) throw ApiError.badRequest('Вывод средств временно недоступен');

    const minAmount = await getConfigNumber(PLATFORM_CONFIG_KEYS.withdrawalMinAmount, 50_000);
    const commissionRate = await getConfigNumber(PLATFORM_CONFIG_KEYS.withdrawalCommissionRate, 0);

    const amount = Math.round(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiError.badRequest('Некорректная сумма');
    }
    if (amount < minAmount) {
      throw ApiError.badRequest(
        `Минимальная сумма вывода — ${minAmount.toLocaleString('ru')} сум`,
      );
    }

    // Карта должна принадлежать пользователю и быть активной.
    const card = await prisma.linkedCard.findUnique({ where: { id: data.cardId } });
    if (!card || card.userId !== userId) throw ApiError.notFound('Карта не найдена');
    if (!card.isActive) throw ApiError.badRequest('Карта неактивна');

    // Одна активная заявка за раз: иначе очередь превращается в кашу,
    // а мастер теряет контроль над тем, сколько денег «в пути».
    const active = await prisma.withdrawalRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (active) {
      throw ApiError.conflict('У вас уже есть заявка на вывод в обработке');
    }

    const commission = commissionRate > 0 ? moneyMul(amount, commissionRate / 100) : 0;
    const payoutAmount = moneySub(amount, commission);

    const request = await prisma.$transaction(async (tx: any) => {
      // Атомарное списание: условие balance >= amount внутри самого UPDATE.
      // Проверять баланс отдельным SELECT нельзя — между чтением и записью
      // проходит время, за которое параллельный запрос спишет те же деньги.
      const claimed = await tx.user.updateMany({
        where: { id: userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (claimed.count === 0) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
        throw ApiError.badRequest(
          `Недостаточно средств. Доступно: ${toNum(user?.balance ?? 0).toLocaleString('ru')} сум`,
        );
      }

      const fresh = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
      const balanceAfter = toNum(fresh?.balance ?? 0);

      await tx.balanceTransaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount: -amount,
          balanceBefore: moneyAdd(balanceAfter, amount),
          balanceAfter,
          description: `Заявка на вывод ${amount.toLocaleString('ru')} сум на карту ${card.cardNumber}`,
        },
      });

      // Реквизиты — снимком: карту могут удалить, а поручение должно остаться.
      return tx.withdrawalRequest.create({
        data: {
          userId,
          amount,
          commission,
          payoutAmount,
          cardId: card.id,
          cardNumber: card.cardNumber,
          cardHolder: card.cardHolder,
          cardProvider: card.provider,
        },
      });
    });

    logger.info({ userId, requestId: request.id, amount }, 'Создана заявка на вывод средств');

    await auditService.log({
      actorId: userId,
      action: 'withdrawal_requested',
      entityType: 'withdrawal_request',
      entityId: request.id,
      details: { amount, commission, payoutAmount, card: card.cardNumber },
    });

    // Финансистам — заявка требует ручного перевода.
    alertRouter
      .dispatch({
        type: 'withdrawal_requested',
        title: '💸 Заявка на вывод средств',
        message:
          `Сумма: ${amount.toLocaleString('ru')} сум\n` +
          (commission > 0 ? `Комиссия: ${commission.toLocaleString('ru')} сум\n` : '') +
          `К переводу: ${payoutAmount.toLocaleString('ru')} сум\n` +
          `Карта: ${card.cardNumber}${card.cardHolder ? ` (${card.cardHolder})` : ''}\n` +
          `Мастер ID: ${userId}\n\n` +
          `Обработать в админке → Выводы средств.`,
        data: { requestId: request.id, userId, amount, payoutAmount },
      })
      .catch(() => {});

    return request;
  }

  /** Заявки пользователя. */
  async listMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawalRequest.count({ where: { userId } }),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Мастер отзывает свою заявку — деньги возвращаются на баланс. */
  async cancel(userId: string, requestId: string) {
    const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.userId !== userId) throw ApiError.forbidden('Это не ваша заявка');
    if (request.status !== 'PENDING') {
      throw ApiError.badRequest('Заявку уже нельзя отозвать — она в обработке');
    }
    return this.refund(requestId, 'CANCELLED', userId, 'Отозвана мастером');
  }

  /** Очередь обработки для админа. */
  async listForAdmin(status: string | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [data, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        skip,
        take: limit,
        // Старые заявки — первыми: мастер не должен ждать дольше очереди.
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Админ взял заявку в работу — мастер видит, что перевод готовится. */
  async markProcessing(adminId: string, requestId: string) {
    const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.status !== 'PENDING') {
      throw ApiError.badRequest(`Заявка в статусе ${request.status}`);
    }
    return prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING', processedById: adminId },
    });
  }

  /**
   * Админ отметил, что деньги отправлены.
   * Баланс НЕ трогаем: он уже списан при создании заявки.
   */
  async markCompleted(adminId: string, requestId: string, adminNote?: string) {
    const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (!REFUNDABLE.includes(request.status)) {
      throw ApiError.badRequest(`Заявка уже закрыта (${request.status})`);
    }

    const updated = await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        processedById: adminId,
        processedAt: new Date(),
        adminNote,
      },
    });

    await auditService.log({
      actorId: adminId,
      action: 'withdrawal_completed',
      entityType: 'withdrawal_request',
      entityId: requestId,
      details: {
        userId: request.userId,
        payoutAmount: toNum(request.payoutAmount),
        card: request.cardNumber,
        adminNote,
      },
    });

    logger.info({ requestId, adminId }, 'Вывод средств отмечен выполненным');
    return updated;
  }

  /** Админ отклонил заявку — деньги возвращаются мастеру. */
  async reject(adminId: string, requestId: string, reason: string) {
    if (!reason?.trim()) throw ApiError.badRequest('Укажите причину отклонения');
    const request = await prisma.withdrawalRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (!REFUNDABLE.includes(request.status)) {
      throw ApiError.badRequest(`Заявка уже закрыта (${request.status})`);
    }
    return this.refund(requestId, 'REJECTED', adminId, reason.trim());
  }

  /**
   * Возврат суммы на баланс при отмене/отклонении.
   * Захват статуса условным updateMany: если заявку параллельно закрыли,
   * count=0 и деньги не вернутся дважды.
   */
  private async refund(
    requestId: string,
    newStatus: 'REJECTED' | 'CANCELLED',
    actorId: string,
    reason: string,
  ) {
    const result = await prisma.$transaction(async (tx: any) => {
      const claimed = await tx.withdrawalRequest.updateMany({
        where: { id: requestId, status: { in: REFUNDABLE } },
        data: {
          status: newStatus,
          processedById: actorId,
          processedAt: new Date(),
          rejectReason: reason,
        },
      });
      if (claimed.count === 0) {
        throw ApiError.conflict('Заявка уже обработана');
      }

      const request = await tx.withdrawalRequest.findUnique({ where: { id: requestId } });
      const amount = toNum(request.amount);

      const user = await tx.user.findUnique({
        where: { id: request.userId },
        select: { balance: true },
      });
      const balanceBefore = toNum(user?.balance ?? 0);
      const balanceAfter = moneyAdd(balanceBefore, amount);

      await tx.user.update({ where: { id: request.userId }, data: { balance: balanceAfter } });
      await tx.balanceTransaction.create({
        data: {
          userId: request.userId,
          type: 'WITHDRAWAL_REFUND',
          amount,
          balanceBefore,
          balanceAfter,
          description: `Возврат по заявке на вывод: ${reason}`,
        },
      });

      return request;
    });

    await auditService.log({
      actorId,
      action: newStatus === 'REJECTED' ? 'withdrawal_rejected' : 'withdrawal_cancelled',
      entityType: 'withdrawal_request',
      entityId: requestId,
      details: { userId: result.userId, amount: toNum(result.amount), reason },
    });

    logger.info({ requestId, newStatus, reason }, 'Заявка на вывод закрыта, средства возвращены');
    return result;
  }
}

export const withdrawalsService = new WithdrawalsService();
