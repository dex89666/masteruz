// ============================================
// MasterUz — Catalog Auto-Seeder (idempotent)
// Сеет только каталог: категории, подкатегории, задачи.
// Запускается из bootstrap бэкенда, если БД пустая.
// Source of truth: src/data/services-catalog.ts
// ============================================

import type { PrismaClient } from '@prisma/client';
import { SERVICE_CATALOG, PARENT_CATEGORIES } from '../data/services-catalog.js';
import { logger } from './logger.js';

/**
 * Идемпотентно посеять каталог. Все upsert по slug — повторный вызов = no-op.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  logger.info('🌱 Auto-seed каталога…');

  // ─── Родительские категории ───
  const parentMap = new Map<string, string>();
  for (let i = 0; i < PARENT_CATEGORIES.length; i++) {
    const p = PARENT_CATEGORIES[i];
    const node = await prisma.category.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name, nameUz: p.nameUz, nameEn: p.nameEn,
        icon: p.icon, sortOrder: i + 1, parentId: null, isActive: true,
      },
      create: {
        name: p.name, nameUz: p.nameUz, nameEn: p.nameEn,
        slug: p.slug, icon: p.icon, sortOrder: i + 1,
      },
    });
    parentMap.set(p.slug, node.id);
  }

  // ─── Дочерние категории + подкатегории + задачи ───
  let cats = 0, subs = 0, tasks = 0;

  for (let ci = 0; ci < SERVICE_CATALOG.length; ci++) {
    const c = SERVICE_CATALOG[ci];
    const parentId = c.parentSlug ? parentMap.get(c.parentSlug) ?? null : null;

    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name, nameUz: c.nameUz, nameEn: c.nameEn,
        icon: c.icon, sortOrder: ci + 1, parentId, isActive: true,
      },
      create: {
        name: c.name, nameUz: c.nameUz, nameEn: c.nameEn,
        slug: c.slug, icon: c.icon, sortOrder: ci + 1, parentId,
      },
    });
    cats++;

    for (let si = 0; si < c.subcategories.length; si++) {
      const s = c.subcategories[si];
      const sub = await prisma.subcategory.upsert({
        where: { slug: s.slug },
        update: {
          name: s.name, nameUz: s.nameUz, nameEn: s.nameEn,
          icon: s.icon, sortOrder: si + 1, categoryId: cat.id, isActive: true,
        },
        create: {
          categoryId: cat.id,
          name: s.name, nameUz: s.nameUz, nameEn: s.nameEn,
          slug: s.slug, icon: s.icon, sortOrder: si + 1,
        },
      });
      subs++;

      for (let ti = 0; ti < s.tasks.length; ti++) {
        const t = s.tasks[ti];
        await prisma.task.upsert({
          where: { slug: t.slug },
          update: {
            name: t.name, nameUz: t.nameUz, nameEn: t.nameEn,
            description: t.description, descriptionUz: t.descriptionUz, descriptionEn: t.descriptionEn,
            estimatedTime: t.estimatedTime, estimatedTimeUz: t.estimatedTimeUz, estimatedTimeEn: t.estimatedTimeEn,
            minPrice: t.minPrice, sortOrder: ti + 1, subcategoryId: sub.id, isActive: true,
          },
          create: {
            subcategoryId: sub.id, slug: t.slug,
            name: t.name, nameUz: t.nameUz, nameEn: t.nameEn,
            description: t.description, descriptionUz: t.descriptionUz, descriptionEn: t.descriptionEn,
            estimatedTime: t.estimatedTime, estimatedTimeUz: t.estimatedTimeUz, estimatedTimeEn: t.estimatedTimeEn,
            minPrice: t.minPrice, sortOrder: ti + 1,
          },
        });
        tasks++;
      }
    }
  }

  logger.info({ cats, subs, tasks }, '✅ Auto-seed каталога завершён');
}
