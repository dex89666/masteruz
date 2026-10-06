// ============================================
// MasterUz — Guarantees Service
// Гарантия на работы — от МАСТЕРА (Оферта п. 7.1, Правила п. 4).
// Срок мастер указывает в отклике (по умолчанию — из своего профиля),
// клиент видит его до выбора мастера. После завершения заказа гарантия
// оформляется автоматически на этот срок. Платформа гарантий не даёт —
// только фиксирует обещание мастера и помогает с обращением.
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { isAdminUser } from '../../utils/helpers.js';
import { logger } from '../../utils/logger.js';

/** Срок по Правилам оказания услуг, если мастер не указал иной. */
export const MIN_WARRANTY_DAYS = 5;

// ─── Получить гарантии клиента ────────────────
export async function getClientGuarantees(userId: string) {
  return prisma.guarantee.findMany({
    where: {
      order: { clientId: userId },
    },
    include: {
      order: {
        select: {
          id: true,
          title: true,
          completedAt: true,
          master: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          category: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Гарантию видят и меняют только участники заказа и админы. */
async function assertParticipant(order: { clientId: string; masterId: string | null }, userId: string) {
  if (order.clientId === userId || order.masterId === userId) return;
  if (await isAdminUser(userId)) return;
  throw ApiError.forbidden('Нет доступа к гарантии этого заказа');
}

// ─── Получить гарантию по заказу ──────────────
export async function getGuaranteeByOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, masterId: true },
  });
  if (!order) throw ApiError.notFound('Заказ не найден');
  await assertParticipant(order, userId);

  const guarantee = await prisma.guarantee.findUnique({ where: { orderId } });
  if (!guarantee) throw ApiError.notFound('Гарантия не найдена');
  return guarantee;
}

/** Срок гарантии мастера по заказу: из принятого отклика, иначе из профиля мастера. */
async function resolveWarrantyDays(orderId: string, masterId: string): Promise<number> {
  const [response, profile] = await Promise.all([
    prisma.orderResponse.findUnique({
      where: { orderId_masterId: { orderId, masterId } },
      select: { warrantyDays: true },
    }),
    prisma.masterProfile.findUnique({ where: { userId: masterId }, select: { warrantyDays: true } }),
  ]);
  const days = response?.warrantyDays ?? profile?.warrantyDays ?? MIN_WARRANTY_DAYS;
  return Math.max(MIN_WARRANTY_DAYS, days);
}

/**
 * Оформляет гарантию мастера на завершённый заказ (идемпотентно).
 * Вызывается автоматически при завершении заказа.
 */
export async function issueMasterWarranty(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, masterId: true, clientId: true, title: true, completedAt: true },
  });
  if (!order) throw ApiError.notFound('Заказ не найден');
  if (order.status !== 'COMPLETED') {
    throw ApiError.badRequest('Гарантия доступна только для завершённых заказов');
  }
  if (!order.masterId) throw ApiError.badRequest('Мастер не назначен');

  const existing = await prisma.guarantee.findUnique({ where: { orderId } });
  if (existing) return existing;

  const days = await resolveWarrantyDays(orderId, order.masterId);
  // Срок считается со дня выполнения заказа (Правила п. 4.1)
  const expiresAt = new Date(order.completedAt ?? Date.now());
  expiresAt.setDate(expiresAt.getDate() + days);

  let guarantee;
  try {
    guarantee = await prisma.guarantee.create({
      data: {
        orderId,
        durationDays: days,
        description: `Гарантия мастера на выполненные работы — ${days} дн.`,
        expiresAt,
      },
    });
  } catch (err: any) {
    // Гонка двух вызовов — гарантия уже создана
    if (err?.code === 'P2002') return prisma.guarantee.findUniqueOrThrow({ where: { orderId } });
    throw err;
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: order.clientId,
        type: 'GUARANTEE_CREATED',
        title: 'Гарантия мастера',
        message: `На работы по заказу «${order.title}» мастер даёт гарантию ${days} дн. — до ${expiresAt.toLocaleDateString('ru')}`,
        data: { orderId, guaranteeId: guarantee.id },
      },
      {
        userId: order.masterId,
        type: 'GUARANTEE_CREATED',
        title: 'Ваша гарантия оформлена',
        message: `По заказу «${order.title}» действует ваша гарантия ${days} дн.`,
        data: { orderId, guaranteeId: guarantee.id },
      },
    ],
  });

  return guarantee;
}

/** Для фоновых вызовов: ошибка оформления гарантии не должна ломать завершение заказа. */
export async function safeIssueMasterWarranty(orderId: string) {
  try {
    await issueMasterWarranty(orderId);
  } catch (err) {
    logger.warn({ orderId, err: (err as Error).message }, 'Не удалось оформить гарантию мастера');
  }
}

// ─── Оформить гарантию вручную (старые заказы, завершённые до автоматики) ──
export async function createGuarantee(orderId: string, userId: string) {
  if (!orderId) throw ApiError.badRequest('orderId обязателен');
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, masterId: true },
  });
  if (!order) throw ApiError.notFound('Заказ не найден');
  await assertParticipant(order, userId);
  // Срок задаёт мастер — значение из запроса клиента не принимаем
  return issueMasterWarranty(orderId);
}

// ─── Обращение клиента по гарантии ────────────────
export async function claimGuarantee(orderId: string, userId: string) {
  const guarantee = await prisma.guarantee.findUnique({
    where: { orderId },
    include: {
      order: { select: { clientId: true, masterId: true, title: true } },
    },
  });

  if (!guarantee) throw ApiError.notFound('Гарантия не найдена');
  if (guarantee.order.clientId !== userId) {
    throw ApiError.forbidden('Только клиент может обратиться по гарантии');
  }
  if (!guarantee.isActive) throw ApiError.badRequest('Гарантия неактивна');
  if (guarantee.claimedAt) throw ApiError.badRequest('Заявка по гарантии уже подана');
  if (guarantee.expiresAt < new Date()) {
    throw ApiError.badRequest('Срок гарантии истёк');
  }

  const updated = await prisma.guarantee.update({
    where: { orderId },
    data: { claimedAt: new Date() },
  });

  if (guarantee.order.masterId) {
    await prisma.notification.create({
      data: {
        userId: guarantee.order.masterId,
        type: 'GUARANTEE_CLAIMED',
        title: 'Обращение по гарантии',
        message: `Клиент обратился по вашей гарантии к заказу «${guarantee.order.title}». Свяжитесь с ним в чате заказа.`,
        data: { orderId },
      },
    });
  }

  return updated;
}

// ─── Мастер отмечает, что гарантийный случай устранён ─────────────
export async function resolveGuarantee(orderId: string, userId: string) {
  const guarantee = await prisma.guarantee.findUnique({
    where: { orderId },
    include: {
      order: { select: { masterId: true, clientId: true, title: true } },
    },
  });

  if (!guarantee) throw ApiError.notFound('Гарантия не найдена');
  if (guarantee.order.masterId !== userId && !(await isAdminUser(userId))) {
    throw ApiError.forbidden('Закрыть гарантийное обращение может только мастер');
  }
  if (!guarantee.claimedAt) throw ApiError.badRequest('Нет активной заявки по гарантии');
  if (guarantee.resolvedAt) throw ApiError.badRequest('Заявка уже разрешена');

  const updated = await prisma.guarantee.update({
    where: { orderId },
    data: { resolvedAt: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: guarantee.order.clientId,
      type: 'GUARANTEE_RESOLVED',
      title: 'Гарантийное обращение закрыто',
      message: `Мастер отметил гарантийный вопрос по заказу «${guarantee.order.title}» как решённый. Если это не так — напишите в поддержку.`,
      data: { orderId },
    },
  });

  return updated;
}

// ─── Статистика гарантий (админ) ──────────────
export async function getGuaranteeStats() {
  const [total, active, claimed, resolved, expired] = await Promise.all([
    prisma.guarantee.count(),
    prisma.guarantee.count({ where: { isActive: true, claimedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.guarantee.count({ where: { claimedAt: { not: null }, resolvedAt: null } }),
    prisma.guarantee.count({ where: { resolvedAt: { not: null } } }),
    prisma.guarantee.count({ where: { expiresAt: { lt: new Date() }, claimedAt: null } }),
  ]);

  return { total, active, claimed, resolved, expired };
}
