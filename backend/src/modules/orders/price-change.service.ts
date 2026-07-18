// ============================================
// MasterUz — Изменение цены заказа по ходу работ
// ============================================
//
// Бизнес-правила (согласованы с владельцем продукта):
//  1. Мастер может предложить новую цену работ (доп. работы / уточнение объёма).
//  2. ЛЮБОЕ изменение требует явного подтверждения клиента.
//  3. Рост ≤ price_change_limit_pct (20%)  → достаточно согласия клиента.
//     Рост >  price_change_limit_pct       → сначала модерация админом, затем клиент.
//     Суммарный рост от изначальной цены ограничен price_change_max_total_pct (50%).
//  4. Если клиент отказался — мастер заявляет фактически выполненный объём
//     (kind=SETTLEMENT). Клиент подтверждает → заказ закрывается по сумме
//     «выезд + фактически выполненное». Не согласен → спор (DISPUTED), решает админ.
//
// Деньги: депозит уже удержан с баланса клиента при создании заказа
// (см. orders.service). Здесь мы только пересчитываем цену/комиссию/остаток —
// фактические списания происходят при завершении заказа.

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { OrderStatus, PriceChangeKind, PriceChangeStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { toNum, moneyAdd, moneySub, moneyMul, calculateCommission } from '../../utils/helpers.js';
import {
  getConfigNumber,
  getTieredEffectiveCommissionRate,
  PLATFORM_CONFIG_KEYS,
} from '../../services/platformConfigService.js';
import { auditService } from '../../services/auditService.js';
import { recordFraudSignal } from '../../services/fraudDetectionService.js';
import { notificationService } from '../../services/notificationService.js';

// Статусы заказа, в которых мастер может менять цену.
const CHANGEABLE_STATUSES: OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.IN_PROGRESS,
];

export class PriceChangeService {
  /**
   * Мастер предлагает новую цену работ.
   * Возвращает заявку в статусе PENDING (ждёт клиента) либо MODERATION
   * (рост выше лимита — сначала админ).
   */
  async propose(
    masterId: string,
    orderId: string,
    data: { newPrice: number; reason: string; photos?: string[] }
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');
    if (!CHANGEABLE_STATUSES.includes(order.status)) {
      throw ApiError.badRequest(`Нельзя менять цену в статусе ${order.status}`);
    }
    if (!data.reason?.trim()) {
      throw ApiError.badRequest('Укажите причину изменения цены');
    }

    const oldPrice = toNum(order.price);
    const newPrice = data.newPrice;
    if (!(newPrice > 0)) throw ApiError.badRequest('Цена должна быть больше нуля');
    if (newPrice === oldPrice) throw ApiError.badRequest('Новая цена совпадает с текущей');

    // Одновременно может висеть только одна заявка.
    const pending = await prisma.priceChangeRequest.findFirst({
      where: { orderId, status: { in: [PriceChangeStatus.PENDING, PriceChangeStatus.MODERATION] } },
    });
    if (pending) throw ApiError.conflict('По заказу уже есть активная заявка на изменение цены');

    const [limitPct, maxTotalPct] = await Promise.all([
      getConfigNumber(PLATFORM_CONFIG_KEYS.priceChangeLimitPct, 20),
      getConfigNumber(PLATFORM_CONFIG_KEYS.priceChangeMaxTotalPct, 50),
    ]);

    // Суммарный рост считаем от изначальной цены заказа (первая заявка хранит её в oldPrice).
    const firstRequest = await prisma.priceChangeRequest.findFirst({
      where: { orderId, kind: PriceChangeKind.PRICE_CHANGE },
      orderBy: { createdAt: 'asc' },
      select: { oldPrice: true },
    });
    const originalPrice = firstRequest ? toNum(firstRequest.oldPrice) : oldPrice;

    const isIncrease = newPrice > oldPrice;
    let status: PriceChangeStatus = PriceChangeStatus.PENDING;

    if (isIncrease) {
      const totalGrowthPct = ((newPrice - originalPrice) / originalPrice) * 100;
      if (totalGrowthPct > maxTotalPct) {
        throw ApiError.badRequest(
          `Суммарный рост цены ${totalGrowthPct.toFixed(1)}% превышает лимит ${maxTotalPct}%. ` +
          `Максимальная цена: ${moneyMul(originalPrice, 1 + maxTotalPct / 100).toLocaleString('ru')} сум`
        );
      }

      const stepGrowthPct = ((newPrice - oldPrice) / oldPrice) * 100;
      // Рост выше лимита за один шаг → обязательная модерация админом.
      if (stepGrowthPct > limitPct) status = PriceChangeStatus.MODERATION;
    } else {
      // ЗАЩИТА ОТ ОБХОДА ПЛАТФОРМЫ.
      // Снижение официальной цены — классическая схема ухода от комиссии:
      // стороны занижают сумму в приложении и добирают разницу наличными.
      // Поэтому ЛЮБОЕ снижение проходит модерацию админом + пишется фрод-сигнал.
      status = PriceChangeStatus.MODERATION;

      const dropPct = ((oldPrice - newPrice) / oldPrice) * 100;
      await recordFraudSignal({
        userId: masterId,
        signal: 'PRICE_DECREASE_REQUEST',
        context: {
          orderId,
          clientId: order.clientId,
          oldPrice,
          newPrice,
          dropPct: Number(dropPct.toFixed(2)),
          reason: data.reason.trim(),
        },
      });
    }

    const request = await prisma.priceChangeRequest.create({
      data: {
        orderId,
        masterId,
        kind: PriceChangeKind.PRICE_CHANGE,
        status,
        oldPrice,
        newPrice,
        reason: data.reason.trim(),
        photos: data.photos ?? [],
      },
    });

    logger.info({ orderId, masterId, oldPrice, newPrice, status }, 'Предложено изменение цены');

    // Уведомления — вне основного потока: клиенту (PENDING) или модераторам (MODERATION).
    notificationService.notifyPriceChangeCreated(request.id).catch((err) =>
      logger.error({ err, requestId: request.id }, 'Ошибка уведомления об изменении цены')
    );

    return request;
  }

  /**
   * Мастер заявляет фактически выполненный объём после отказа клиента.
   * Итоговая сумма заказа станет: выезд + заявленная сумма.
   */
  async proposeSettlement(
    masterId: string,
    orderId: string,
    data: { completedAmount: number; reason: string; photos?: string[] }
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.masterId !== masterId) throw ApiError.forbidden('Вы не назначены на этот заказ');

    // Расчёт возможен только после отказа клиента от новой цены.
    const rejected = await prisma.priceChangeRequest.findFirst({
      where: { orderId, kind: PriceChangeKind.PRICE_CHANGE, status: PriceChangeStatus.REJECTED },
      orderBy: { respondedAt: 'desc' },
    });
    if (!rejected) throw ApiError.badRequest('Расчёт доступен только после отказа клиента от новой цены');

    const pending = await prisma.priceChangeRequest.findFirst({
      where: { orderId, status: { in: [PriceChangeStatus.PENDING, PriceChangeStatus.MODERATION] } },
    });
    if (pending) throw ApiError.conflict('По заказу уже есть активная заявка');

    const oldPrice = toNum(order.price);
    if (data.completedAmount < 0) throw ApiError.badRequest('Сумма не может быть отрицательной');
    // Заявить больше согласованной цены при отказе нельзя.
    if (data.completedAmount > oldPrice) {
      throw ApiError.badRequest(
        `Сумма выполненных работ не может превышать согласованную цену ${oldPrice.toLocaleString('ru')} сум`
      );
    }
    if (!data.reason?.trim()) throw ApiError.badRequest('Опишите фактически выполненные работы');

    // ЗАЩИТА ОТ ОБХОДА: расчёт по факту — это всегда занижение суммы заказа.
    // Главный риск — сговор (обеим сторонам выгодно занизить и добрать наличными),
    // поэтому подтверждения клиента недостаточно: сначала модерация админом.
    const request = await prisma.priceChangeRequest.create({
      data: {
        orderId,
        masterId,
        kind: PriceChangeKind.SETTLEMENT,
        status: PriceChangeStatus.MODERATION,
        oldPrice,
        newPrice: data.completedAmount,
        reason: data.reason.trim(),
        photos: data.photos ?? [],
      },
    });

    const dropPct = oldPrice > 0 ? ((oldPrice - data.completedAmount) / oldPrice) * 100 : 0;
    await recordFraudSignal({
      userId: masterId,
      signal: 'SETTLEMENT_UNDERDECLARE',
      context: {
        orderId,
        clientId: order.clientId,
        agreedPrice: oldPrice,
        declaredAmount: data.completedAmount,
        dropPct: Number(dropPct.toFixed(2)),
        reason: data.reason.trim(),
      },
    });

    logger.info({ orderId, masterId, completedAmount: data.completedAmount }, 'Заявлен расчёт по факту → модерация');

    // Расчёт по факту всегда уходит модераторам.
    notificationService.notifyPriceChangeCreated(request.id).catch((err) =>
      logger.error({ err, requestId: request.id }, 'Ошибка уведомления о расчёте по факту')
    );

    return request;
  }

  /** Админ пропускает заявку с ростом выше лимита к клиенту (или отклоняет). */
  async moderate(adminId: string, requestId: string, approve: boolean, note?: string) {
    const request = await prisma.priceChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.status !== PriceChangeStatus.MODERATION) {
      throw ApiError.badRequest(`Заявка не на модерации (статус ${request.status})`);
    }

    const updated = await prisma.priceChangeRequest.update({
      where: { id: requestId },
      data: {
        // Одобрено админом → уходит клиенту на подтверждение.
        status: approve ? PriceChangeStatus.PENDING : PriceChangeStatus.CANCELLED,
        moderatedById: adminId,
        moderatedAt: new Date(),
        moderatorNote: note,
      },
    });

    await auditService.log({
      actorId: adminId,
      action: approve ? 'price_change_moderated_ok' : 'price_change_moderated_reject',
      entityType: 'price_change_request',
      entityId: requestId,
      details: { orderId: request.orderId, newPrice: toNum(request.newPrice), note },
    });

    // Одобрено → просим клиента подтвердить. Отклонено → сообщаем мастеру.
    notificationService.notifyPriceChangeModerated(requestId, approve).catch((err) =>
      logger.error({ err, requestId }, 'Ошибка уведомления о модерации цены')
    );

    return updated;
  }

  /**
   * Клиент подтверждает заявку.
   * PRICE_CHANGE → пересчитываем цену, комиссию, депозит-остаток.
   * SETTLEMENT   → фиксируем итоговую сумму «выезд + фактически выполненное».
   */
  async approve(clientId: string, requestId: string) {
    const request = await prisma.priceChangeRequest.findUnique({
      where: { id: requestId },
      include: { order: true },
    });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.order.clientId !== clientId) throw ApiError.forbidden('Это не ваш заказ');
    if (request.status !== PriceChangeStatus.PENDING) {
      throw ApiError.badRequest(`Заявка недоступна для подтверждения (статус ${request.status})`);
    }

    const order = request.order;
    const visitFee = toNum(order.visitFee ?? 0);
    const newWorkPrice = toNum(request.newPrice);

    // Пересчёт комиссии по новой цене работ (ступенчатая шкала + история пары).
    const commissionRate = await getTieredEffectiveCommissionRate(newWorkPrice, clientId, order.masterId);
    const workCommission = calculateCommission(newWorkPrice, commissionRate);
    const visitFeeCommissionRate = await getConfigNumber(PLATFORM_CONFIG_KEYS.visitFeeCommissionRate, 0);
    const visitFeeCommission = visitFee > 0 ? calculateCommission(visitFee, visitFeeCommissionRate) : 0;
    const commissionAmount = moneyAdd(workCommission, visitFeeCommission);

    const totalAmount = moneyAdd(newWorkPrice, visitFee);

    // Депозит уже удержан с баланса клиента при создании заказа.
    // Если итоговая сумма оказалась МЕНЬШЕ депозита (цену снизили / клиент
    // отказался и работ выполнено мало) — переплату возвращаем клиенту сразу,
    // иначе releaseFunds выплатил бы мастеру весь депозит целиком.
    const originalDeposit = toNum(order.depositAmount);
    const effectiveDeposit = Math.min(originalDeposit, totalAmount);
    const excess = moneySub(originalDeposit, effectiveDeposit);
    const remainingAmount = Math.max(0, moneySub(totalAmount, effectiveDeposit));

    const currentEscrow = toNum(order.escrowAmount ?? 0);
    const newEscrow = Math.min(currentEscrow, effectiveDeposit);

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          price: newWorkPrice,
          commissionRate,
          commissionAmount,
          remainingAmount,
          depositAmount: effectiveDeposit,
          ...(currentEscrow > 0 ? { escrowAmount: newEscrow } : {}),
          // Расчёт по факту завершает работы — заказ уходит на оплату остатка.
          ...(request.kind === PriceChangeKind.SETTLEMENT
            ? { status: OrderStatus.AWAITING_REMAINDER, masterConfirmedAt: new Date() }
            : {}),
        },
      });

      // Возврат переплаты депозита клиенту.
      if (excess > 0) {
        const client = await tx.user.findUnique({ where: { id: clientId }, select: { balance: true } });
        const balanceBefore = toNum(client?.balance ?? 0);
        const balanceAfter = moneyAdd(balanceBefore, excess);
        await tx.user.update({ where: { id: clientId }, data: { balance: balanceAfter } });
        await tx.balanceTransaction.create({
          data: {
            userId: clientId,
            type: 'REFUND',
            amount: excess,
            balanceBefore,
            balanceAfter,
            orderId: order.id,
            description:
              `Возврат переплаты депозита: итоговая сумма ${totalAmount.toLocaleString('ru')} сум ` +
              `меньше внесённого депозита ${originalDeposit.toLocaleString('ru')} сум`,
          },
        });
      }

      await tx.priceChangeRequest.update({
        where: { id: requestId },
        data: { status: PriceChangeStatus.APPROVED, respondedAt: new Date() },
      });

      return updated;
    });

    await auditService.log({
      actorId: clientId,
      action: request.kind === PriceChangeKind.SETTLEMENT ? 'settlement_approved' : 'price_change_approved',
      entityType: 'order',
      entityId: order.id,
      details: {
        oldPrice: toNum(request.oldPrice),
        newPrice: newWorkPrice,
        totalAmount,
        remainingAmount,
        commissionAmount,
        refundedExcess: excess,
      },
    });

    logger.info(
      { orderId: order.id, newWorkPrice, totalAmount, remainingAmount, excess, kind: request.kind },
      'Изменение цены подтверждено клиентом'
    );

    notificationService.notifyPriceChangeResponded(requestId, true).catch((err) =>
      logger.error({ err, requestId }, 'Ошибка уведомления о подтверждении цены')
    );

    return { order: updatedOrder, request };
  }

  /**
   * Клиент отказывается.
   * PRICE_CHANGE → мастер должен заявить фактически выполненный объём (SETTLEMENT).
   *                Выезд оплачивается в любом случае.
   * SETTLEMENT   → клиент не согласен с заявленным объёмом → спор, решает админ.
   */
  async reject(clientId: string, requestId: string, comment?: string) {
    const request = await prisma.priceChangeRequest.findUnique({
      where: { id: requestId },
      include: { order: true },
    });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.order.clientId !== clientId) throw ApiError.forbidden('Это не ваш заказ');
    if (request.status !== PriceChangeStatus.PENDING) {
      throw ApiError.badRequest(`Заявка недоступна для отклонения (статус ${request.status})`);
    }

    const isSettlement = request.kind === PriceChangeKind.SETTLEMENT;

    const [, updatedRequest] = await prisma.$transaction([
      prisma.order.update({
        where: { id: request.orderId },
        data: isSettlement
          ? {
              // Спор по объёму фактически выполненного — решает админ.
              status: OrderStatus.DISPUTED,
              disputeReason:
                `Клиент не согласен с заявленным объёмом работ ` +
                `(${toNum(request.newPrice).toLocaleString('ru')} сум).` +
                (comment ? ` Комментарий: ${comment}` : ''),
            }
          : {},
      }),
      prisma.priceChangeRequest.update({
        where: { id: requestId },
        data: { status: PriceChangeStatus.REJECTED, respondedAt: new Date() },
      }),
    ]);

    await auditService.log({
      actorId: clientId,
      action: isSettlement ? 'settlement_rejected' : 'price_change_rejected',
      entityType: 'order',
      entityId: request.orderId,
      details: { requestId, newPrice: toNum(request.newPrice), comment },
    });

    logger.info({ orderId: request.orderId, requestId, isSettlement }, 'Клиент отклонил заявку');

    // Мастеру — отказ; при споре по расчёту дополнительно эскалация в поддержку.
    notificationService.notifyPriceChangeResponded(requestId, false).catch((err) =>
      logger.error({ err, requestId }, 'Ошибка уведомления об отклонении цены')
    );

    return updatedRequest;
  }

  /** Мастер отзывает свою заявку, пока клиент не ответил. */
  async cancel(masterId: string, requestId: string) {
    const request = await prisma.priceChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound('Заявка не найдена');
    if (request.masterId !== masterId) throw ApiError.forbidden('Это не ваша заявка');
    if (![PriceChangeStatus.PENDING, PriceChangeStatus.MODERATION].includes(request.status as any)) {
      throw ApiError.badRequest('Заявку уже нельзя отозвать');
    }

    return prisma.priceChangeRequest.update({
      where: { id: requestId },
      data: { status: PriceChangeStatus.CANCELLED, respondedAt: new Date() },
    });
  }

  /**
   * Очередь модерации для админа: заявки, ждущие проверки.
   * Сюда попадают все снижения цены и расчёты по факту (защита от обхода),
   * а также рост выше лимита.
   */
  async listForModeration(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.priceChangeRequest.findMany({
        where: { status: PriceChangeStatus.MODERATION },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // самые старые — первыми
        include: {
          order: {
            select: {
              id: true, title: true, price: true, visitFee: true,
              depositAmount: true, status: true, clientId: true,
            },
          },
          master: { select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.priceChangeRequest.count({ where: { status: PriceChangeStatus.MODERATION } }),
    ]);

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Список заявок по заказу (для клиента, мастера и админа). */
  async listByOrder(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.clientId !== userId && order.masterId !== userId) {
      throw ApiError.forbidden('Нет доступа к этому заказу');
    }

    return prisma.priceChangeRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const priceChangeService = new PriceChangeService();
