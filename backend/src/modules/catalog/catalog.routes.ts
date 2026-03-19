// ============================================
// MasterUz — Catalog Routes (Redis-cached)
// Категории → Подкатегории → Задачи
// GET-запросы кэшируются в Redis (5 мин TTL)
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ─── Кэш-утилиты ─────────────────────────────
const CATALOG_CACHE_TTL = 300; // 5 минут
const CACHE_PREFIX = 'catalog:';

async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);
    if (cached) return JSON.parse(cached) as T;

    const data = await fetcher();
    // Записываем в кэш (не блокируем ответ)
    redis.setex(`${CACHE_PREFIX}${key}`, CATALOG_CACHE_TTL, JSON.stringify(data)).catch(() => {});
    return data;
  } catch {
    // Redis недоступен — просто запрашиваем из БД
    return fetcher();
  }
}

async function invalidateCatalogCache(): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`${CACHE_PREFIX}*`);
    await Promise.all(keys.map((k) => redis.del(k)));
    logger.debug({ keysInvalidated: keys.length }, 'Catalog cache invalidated');
  } catch {
    // Redis недоступен — ничего страшного
  }
}

/**
 * GET /catalog/categories — все активные категории (cached)
 * Возвращает иерархическую структуру: родительские категории с дочерними
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await getCached('categories', () =>
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              subcategories: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  nameUz: true,
                  nameEn: true,
                  slug: true,
                  icon: true,
                  sortOrder: true,
                  _count: { select: { tasks: true } },
                },
              },
              _count: { select: { subcategories: true } },
            },
          },
          subcategories: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              nameUz: true,
              nameEn: true,
              slug: true,
              icon: true,
              sortOrder: true,
              _count: { select: { tasks: true } },
            },
          },
          _count: { select: { subcategories: true } },
        },
      })
    );

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/categories/:slug — категория со всеми данными (cached)
 * Для родительской: возвращает дочерние категории
 * Для дочерней: возвращает подкатегории и задачи
 */
router.get('/categories/:slug', async (req, res, next) => {
  try {
    const category = await getCached(`cat:${req.params.slug}`, () =>
      prisma.category.findUnique({
        where: { slug: req.params.slug },
        include: {
          parent: {
            select: { id: true, name: true, nameUz: true, nameEn: true, slug: true, icon: true },
          },
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              subcategories: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true, name: true, nameUz: true, nameEn: true, slug: true, icon: true,
                  _count: { select: { tasks: true } },
                },
              },
              _count: { select: { subcategories: true } },
            },
          },
          subcategories: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      })
    );

    if (!category) {
      return res.status(404).json({ success: false, error: { message: 'Категория не найдена' } });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/subcategories/:slug — подкатегория с задачами (cached)
 */
router.get('/subcategories/:slug', async (req, res, next) => {
  try {
    const subcategory = await getCached(`sub:${req.params.slug}`, () =>
      prisma.subcategory.findUnique({
        where: { slug: req.params.slug },
        include: {
          category: true,
          tasks: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
    );

    if (!subcategory) {
      return res.status(404).json({ success: false, error: { message: 'Подкатегория не найдена' } });
    }

    res.json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/tasks?subcategoryId=xxx — задачи подкатегории (cached)
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const { subcategoryId } = req.query;
    const cacheKey = `tasks:${subcategoryId || 'all'}`;

    const tasks = await getCached(cacheKey, () =>
      prisma.task.findMany({
        where: {
          isActive: true,
          ...(subcategoryId ? { subcategoryId: subcategoryId as string } : {}),
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          subcategory: {
            select: { id: true, name: true, slug: true, categoryId: true },
          },
        },
      })
    );

    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/full — полное дерево каталога (cached)
 */
router.get('/full', async (_req, res, next) => {
  try {
    const catalog = await getCached('full', () =>
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          subcategories: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      })
    );

    res.json({ success: true, data: catalog });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/price-list — прайс-лист: все задачи с minPrice (cached)
 */
router.get('/price-list', async (_req, res, next) => {
  try {
    const data = await getCached('price-list', async () => {
      const visitFeeConfig = await prisma.platformConfig.findUnique({
        where: { key: 'visit_fee' },
      });
      const visitFee = visitFeeConfig ? parseFloat(visitFeeConfig.value) : 100000;

      const catalog = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          subcategories: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
              tasks: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  nameUz: true,
                  nameEn: true,
                  slug: true,
                  minPrice: true,
                  estimatedTime: true,
                  estimatedTimeUz: true,
                  estimatedTimeEn: true,
                },
              },
            },
          },
        },
      });

      return { visitFee, catalog };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════
// Защищённые CRUD-маршруты (admin/manager)
// ═══════════════════════════════════════════
router.use('/admin', authenticate, authorize('ADMIN', 'MANAGER'));

// ─── CRUD Категории ─────────────────────────

/**
 * POST /catalog/admin/categories — создание категории
 */
router.post('/admin/categories', async (req, res, next) => {
  try {
    const { name, nameUz, nameEn, slug, icon, parentId } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        error: { message: 'name и slug обязательны' },
      });
    }

    const existingSlug = await prisma.category.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        error: { message: `Категория с slug "${slug}" уже существует` },
      });
    }

    const maxSort = await prisma.category.aggregate({
      where: { parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: {
        name,
        nameUz: nameUz || name,
        nameEn: nameEn || name,
        slug,
        icon: icon || '📋',
        parentId: parentId || null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isActive: true,
      },
      include: {
        _count: { select: { subcategories: true } },
      },
    });

    await invalidateCatalogCache();
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /catalog/admin/categories/:id — обновление категории
 */
router.put('/admin/categories/:id', async (req, res, next) => {
  try {
    const { name, nameUz, nameEn, icon, isActive, sortOrder } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (nameUz !== undefined) updateData.nameUz = nameUz;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (icon !== undefined) updateData.icon = icon;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        _count: { select: { subcategories: true } },
      },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /catalog/admin/categories/:id — мягкое удаление категории
 */
router.delete('/admin/categories/:id', async (req, res, next) => {
  try {
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

// ─── CRUD Подкатегории (через /admin/) ──────

/**
 * POST /catalog/admin/subcategories — создание подкатегории
 */
router.post('/admin/subcategories', async (req, res, next) => {
  try {
    const { categoryId, name, nameUz, nameEn, slug, icon } = req.body;

    if (!categoryId || !name || !slug) {
      return res.status(400).json({
        success: false,
        error: { message: 'categoryId, name и slug обязательны' },
      });
    }

    const existingSlug = await prisma.subcategory.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        error: { message: `Подкатегория с slug "${slug}" уже существует` },
      });
    }

    const maxSort = await prisma.subcategory.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    });

    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId,
        name,
        nameUz: nameUz || name,
        nameEn: nameEn || name,
        slug,
        icon: icon || '📋',
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isActive: true,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true } },
      },
    });

    await invalidateCatalogCache();
    res.status(201).json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /catalog/admin/subcategories/:id — обновление подкатегории
 */
router.put('/admin/subcategories/:id', async (req, res, next) => {
  try {
    const { name, nameUz, nameEn, icon, isActive, sortOrder, categoryId } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (nameUz !== undefined) updateData.nameUz = nameUz;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (icon !== undefined) updateData.icon = icon;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const subcategory = await prisma.subcategory.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { tasks: true } },
      },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /catalog/admin/subcategories/:id — мягкое удаление
 */
router.delete('/admin/subcategories/:id', async (req, res, next) => {
  try {
    const subcategory = await prisma.subcategory.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: subcategory });
  } catch (error) {
    next(error);
  }
});

// ─── CRUD Задачи (через /admin/) ────────────

/**
 * POST /catalog/admin/tasks — создание задачи
 */
router.post('/admin/tasks', async (req, res, next) => {
  try {
    const {
      subcategoryId, name, nameUz, nameEn,
      description, descriptionUz, descriptionEn,
      estimatedTime, estimatedTimeUz, estimatedTimeEn,
      minPrice, slug,
    } = req.body;

    if (!subcategoryId || !name || !slug) {
      return res.status(400).json({
        success: false,
        error: { message: 'subcategoryId, name и slug обязательны' },
      });
    }

    const existingSlug = await prisma.task.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({
        success: false,
        error: { message: `Задача с slug "${slug}" уже существует` },
      });
    }

    const maxSort = await prisma.task.aggregate({
      where: { subcategoryId },
      _max: { sortOrder: true },
    });

    const task = await prisma.task.create({
      data: {
        subcategoryId,
        name,
        nameUz: nameUz || name,
        nameEn: nameEn || name,
        description: description || '',
        descriptionUz: descriptionUz || description || '',
        descriptionEn: descriptionEn || description || '',
        estimatedTime: estimatedTime || '',
        estimatedTimeUz: estimatedTimeUz || estimatedTime || '',
        estimatedTimeEn: estimatedTimeEn || estimatedTime || '',
        minPrice: minPrice ?? null,
        slug,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isActive: true,
      },
      include: {
        subcategory: {
          select: { id: true, name: true, slug: true, categoryId: true },
        },
      },
    });

    await invalidateCatalogCache();
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /catalog/admin/tasks/:id — обновление задачи
 */
router.put('/admin/tasks/:id', async (req, res, next) => {
  try {
    const {
      name, nameUz, nameEn,
      description, descriptionUz, descriptionEn,
      estimatedTime, estimatedTimeUz, estimatedTimeEn,
      minPrice, isActive, subcategoryId, sortOrder,
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (nameUz !== undefined) updateData.nameUz = nameUz;
    if (nameEn !== undefined) updateData.nameEn = nameEn;
    if (description !== undefined) updateData.description = description;
    if (descriptionUz !== undefined) updateData.descriptionUz = descriptionUz;
    if (descriptionEn !== undefined) updateData.descriptionEn = descriptionEn;
    if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime;
    if (estimatedTimeUz !== undefined) updateData.estimatedTimeUz = estimatedTimeUz;
    if (estimatedTimeEn !== undefined) updateData.estimatedTimeEn = estimatedTimeEn;
    if (minPrice !== undefined) updateData.minPrice = minPrice;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (subcategoryId !== undefined) updateData.subcategoryId = subcategoryId;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        subcategory: {
          select: { id: true, name: true, slug: true, categoryId: true },
        },
      },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /catalog/admin/tasks/:id — мягкое удаление
 */
router.delete('/admin/tasks/:id', async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /catalog/admin/full — полное дерево (включая неактивные)
 */
router.get('/admin/full', async (_req, res, next) => {
  try {
    const catalog = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            tasks: {
              orderBy: { sortOrder: 'asc' },
            },
            _count: { select: { tasks: true } },
          },
        },
        _count: { select: { subcategories: true } },
      },
    });

    res.json({ success: true, data: catalog });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /catalog/admin/tasks/:id/price — обновление minPrice задачи (admin/manager)
 */
router.patch('/admin/tasks/:id/price', async (req, res, next) => {
  try {
    const { minPrice } = req.body;

    if (typeof minPrice !== 'number' || minPrice < 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'minPrice должен быть неотрицательным числом' },
      });
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { minPrice },
    });

    await invalidateCatalogCache();
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

export default router;
