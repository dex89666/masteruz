// ============================================
// MasterUz — Portfolio Service
// CRUD портфолио мастера (галерея работ)
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Получить портфолио мастера (публичное) ──
export async function getMasterPortfolio(masterId: string, categoryId?: string) {
  const where: any = { masterId };
  if (categoryId) where.categoryId = categoryId;

  const items = await prisma.portfolioItem.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    include: {
      category: { select: { id: true, name: true, nameUz: true, nameEn: true, slug: true } },
    },
  });

  return items;
}

// ─── Получить один элемент ────────────────────
export async function getPortfolioItem(id: string) {
  return prisma.portfolioItem.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, nameUz: true, nameEn: true } },
      master: {
        select: {
          id: true,
          profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          masterProfile: { select: { rating: true, completedOrders: true } },
        },
      },
    },
  });
}

// ─── Создать элемент портфолио ────────────────
export async function createPortfolioItem(
  masterId: string,
  data: {
    title: string;
    description?: string;
    imageUrl: string;
    categoryId?: string;
  }
) {
  // Определить следующий sortOrder
  const maxSort = await prisma.portfolioItem.findFirst({
    where: { masterId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const item = await prisma.portfolioItem.create({
    data: {
      masterId,
      title: data.title,
      description: data.description || null,
      imageUrl: data.imageUrl,
      categoryId: data.categoryId || null,
      sortOrder: (maxSort?.sortOrder || 0) + 1,
    },
    include: {
      category: { select: { id: true, name: true, nameUz: true, nameEn: true } },
    },
  });

  return item;
}

// ─── Обновить элемент портфолио ───────────────
export async function updatePortfolioItem(
  id: string,
  masterId: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    categoryId?: string | null;
    sortOrder?: number;
  }
) {
  // Проверяем владельца
  const existing = await prisma.portfolioItem.findFirst({
    where: { id, masterId },
  });

  if (!existing) {
    throw new Error('Portfolio item not found or access denied');
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.portfolioItem.update({
    where: { id },
    data: updateData,
    include: {
      category: { select: { id: true, name: true, nameUz: true, nameEn: true } },
    },
  });
}

// ─── Удалить элемент портфолио ────────────────
export async function deletePortfolioItem(id: string, masterId: string) {
  const existing = await prisma.portfolioItem.findFirst({
    where: { id, masterId },
  });

  if (!existing) {
    throw new Error('Portfolio item not found or access denied');
  }

  await prisma.portfolioItem.delete({ where: { id } });
  return { success: true };
}

// ─── Статистика портфолио мастера ─────────────
export async function getPortfolioStats(masterId: string) {
  const [totalItems, totalLikes, byCategory] = await Promise.all([
    prisma.portfolioItem.count({ where: { masterId } }),
    prisma.portfolioItem.aggregate({
      where: { masterId },
      _sum: { likesCount: true },
    }),
    prisma.portfolioItem.groupBy({
      by: ['categoryId'],
      where: { masterId },
      _count: true,
    }),
  ]);

  return {
    totalItems,
    totalLikes: totalLikes._sum.likesCount || 0,
    categoriesUsed: byCategory.length,
  };
}
