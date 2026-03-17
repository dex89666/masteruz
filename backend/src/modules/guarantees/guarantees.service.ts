// ============================================
// MasterUz — Guarantees Service
// Бизнес-логика гарантий на работы
// ============================================

import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/ApiError.js';

const prisma = new PrismaClient();

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
          master: { include: { profile: true } },
          category: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Получить гарантию по заказу ──────────────
export async function getGuaranteeByOrder(orderId: string) {
  const guarantee = await prisma.guarantee.findUnique({
    where: { orderId },
    include: {
      order: {
        include: {
          master: { include: { profile: true } },
          client: { include: { profile: true } },
          category: true,
        },
      },
    },
  });

  if (!guarantee) throw ApiError.notFound('Гарантия не найдена');
  return guarantee;
}

// ─── Создать гарантию ─────────────────────────
export async function createGuarantee(
  orderId: string,
  durationDays?: number,
  description?: string
) {
  if (!orderId) throw ApiError.badRequest('orderId обязателен');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, masterId: true, clientId: true },
  });

  if (!order) throw ApiError.notFound('Заказ не найден');
  if (order.status !== 'COMPLETED') {
    throw ApiError.badRequest('Гарантия доступна только для завершённых заказов');
  }

  // Проверяем, нет ли уже гарантии
  const existing = await prisma.guarantee.findUnique({ where: { orderId } });
  if (existing) throw ApiError.badRequest('Гарантия на этот заказ уже создана');

  // Дефолтный срок — из конфига или 30 дней
  const configDays = await prisma.platformConfig.findUnique({
    where: { key: 'guarantee_duration_days' },
  });
  const days = durationDays || (configDays ? parseInt(configDays.value) : 30);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const guarantee = await prisma.guarantee.create({
    data: {
      orderId,
      durationDays: days,
      description: description || `Гарантия на выполненные работы — ${days} дней`,
      expiresAt,
    },
  });

  // Уведомляем клиента
  await prisma.notification.create({
    data: {
      userId: order.clientId,
      type: 'GUARANTEE_CREATED',
      title: 'Гарантия активирована',
      message: `На ваш заказ действует гарантия ${days} дней до ${expiresAt.toLocaleDateString('ru')}`,
      data: { orderId, guaranteeId: guarantee.id },
    },
  });

  // Уведомляем мастера
  if (order.masterId) {
    await prisma.notification.create({
      data: {
        userId: order.masterId,
        type: 'GUARANTEE_CREATED',
        title: 'Гарантия активирована',
        message: `Клиент активировал гарантию на ${days} дней`,
        data: { orderId, guaranteeId: guarantee.id },
      },
    });
  }

  return guarantee;
}

// ─── Подать заявку по гарантии ────────────────
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

  // Уведомляем мастера
  if (guarantee.order.masterId) {
    await prisma.notification.create({
      data: {
        userId: guarantee.order.masterId,
        type: 'GUARANTEE_CLAIMED',
        title: 'Обращение по гарантии',
        message: `Клиент обратился по гарантии к заказу "${guarantee.order.title}"`,
        data: { orderId },
      },
    });
  }

  return updated;
}

// ─── Разрешить гарантийную заявку ─────────────
export async function resolveGuarantee(orderId: string, userId: string) {
  const guarantee = await prisma.guarantee.findUnique({
    where: { orderId },
    include: {
      order: { select: { masterId: true, clientId: true, title: true } },
    },
  });

  if (!guarantee) throw ApiError.notFound('Гарантия не найдена');
  if (!guarantee.claimedAt) throw ApiError.badRequest('Нет активной заявки по гарантии');
  if (guarantee.resolvedAt) throw ApiError.badRequest('Заявка уже разрешена');

  const updated = await prisma.guarantee.update({
    where: { orderId },
    data: { resolvedAt: new Date() },
  });

  // Уведомляем клиента
  await prisma.notification.create({
    data: {
      userId: guarantee.order.clientId,
      type: 'GUARANTEE_RESOLVED',
      title: 'Гарантийная заявка разрешена',
      message: `Гарантийный вопрос по заказу "${guarantee.order.title}" решён`,
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
