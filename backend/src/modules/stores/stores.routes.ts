// ============================================
// MasterUz — Партнёрские магазины (Routes)
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ─── GET /stores — Список магазинов ─────────
router.get('/', async (req, res, next) => {
  try {
    const { category, city, search, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { status: 'ACTIVE' };
    if (category) where.storeCategory = String(category);
    if (city) where.city = { contains: String(city), mode: 'insensitive' };
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [stores, total] = await Promise.all([
      prisma.partnerStore.findMany({
        where,
        include: { _count: { select: { products: true, reviews: true } } },
        skip,
        take: Number(limit),
        orderBy: [{ isVerified: 'desc' }, { rating: 'desc' }],
      }),
      prisma.partnerStore.count({ where }),
    ]);

    res.json({
      success: true,
      data: stores,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /stores/categories — Категории магазинов ─────
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = [
      { slug: 'building-materials', name: 'Стройматериалы', nameUz: 'Qurilish materiallari', nameEn: 'Building materials', icon: '🧱' },
      { slug: 'tools', name: 'Инструменты', nameUz: 'Asboblar', nameEn: 'Tools', icon: '🔨' },
      { slug: 'paints', name: 'Краски и лаки', nameUz: 'Bo\u02bbyoqlar va laklar', nameEn: 'Paints & lacquers', icon: '🎨' },
      { slug: 'plumbing', name: 'Сантехника', nameUz: 'Santexnika', nameEn: 'Plumbing', icon: '🚿' },
      { slug: 'electrical', name: 'Электрика', nameUz: 'Elektrika', nameEn: 'Electrical', icon: '⚡' },
      { slug: 'finishing', name: 'Отделочные материалы', nameUz: 'Pardoz materiallari', nameEn: 'Finishing materials', icon: '✨' },
      { slug: 'furniture-materials', name: 'Мебельные материалы', nameUz: 'Mebel materiallari', nameEn: 'Furniture materials', icon: '🪵' },
      { slug: 'home-appliances', name: 'Бытовая техника', nameUz: 'Maishiy texnika', nameEn: 'Home appliances', icon: '🏠' },
      { slug: 'conditioners', name: 'Кондиционеры и климат', nameUz: 'Konditsionerlar', nameEn: 'Air conditioners', icon: '❄️' },
      { slug: 'windows-shop', name: 'Окна и двери', nameUz: 'Derazalar va eshiklar', nameEn: 'Windows & doors', icon: '🪟' },
      { slug: 'tiles-flooring', name: 'Плитка и полы', nameUz: 'Plitka va pollar', nameEn: 'Tiles & flooring', icon: '🪵' },
      { slug: 'garden-shop', name: 'Сад и ландшафт', nameUz: 'Bog\u02bb va landshaft', nameEn: 'Garden & landscape', icon: '🌿' },
    ];
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// ─── GET /stores/:slug — Детали магазина ─────
router.get('/:slug', async (req, res, next) => {
  try {
    const store = await prisma.partnerStore.findUnique({
      where: { slug: req.params.slug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { products: true, reviews: true } },
      },
    });

    if (!store || store.status !== 'ACTIVE') {
      throw new ApiError(404, 'Магазин не найден');
    }

    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// ─── GET /stores/:slug/products — Товары магазина ─────
router.get('/:slug/products', async (req, res, next) => {
  try {
    const { category, search, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const store = await prisma.partnerStore.findUnique({ where: { slug: req.params.slug } });
    if (!store) throw new ApiError(404, 'Магазин не найден');

    const where: any = { storeId: store.id, isActive: true };
    if (category) where.category = String(category);
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.storeProduct.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.storeProduct.count({ where }),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /stores/partner-request — Заявка на партнёрство ─────
router.post('/partner-request', async (req, res, next) => {
  try {
    const { storeName, contactPerson, phone, email, address, city, storeCategory, message } = req.body;

    if (!storeName || !contactPerson || !phone || !storeCategory) {
      throw new ApiError(400, 'Укажите название магазина, контактное лицо, телефон и категорию');
    }

    const request = await prisma.partnerRequest.create({
      data: { storeName, contactPerson, phone, email, address, city, storeCategory, message },
    });

    logger.info({ requestId: request.id }, 'Новая заявка на партнёрство');
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
});

// ─── POST /stores/:slug/reviews — Отзыв о магазине ─────
router.post('/:slug/reviews', authenticate, async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      throw new ApiError(400, 'Рейтинг должен быть от 1 до 5');
    }

    const store = await prisma.partnerStore.findUnique({ where: { slug: req.params.slug } });
    if (!store) throw new ApiError(404, 'Магазин не найден');

    const review = await prisma.storeReview.create({
      data: {
        storeId: store.id,
        userId: req.user!.userId,
        rating: Number(rating),
        comment,
      },
    });

    // Обновляем средний рейтинг
    const agg = await prisma.storeReview.aggregate({
      where: { storeId: store.id },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.partnerStore.update({
      where: { id: store.id },
      data: { rating: agg._avg.rating || 0, reviewCount: agg._count },
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════
// ADMIN: Управление магазинами
// ═══════════════════════════════════════════════

// ─── GET /stores/admin/requests — Заявки на партнёрство ─────
router.get('/admin/requests', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = String(status);

    const [requests, total] = await Promise.all([
      prisma.partnerRequest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.partnerRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNext: skip + Number(limit) < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /stores/admin/requests/:id/approve — Одобрить заявку ─────
router.put('/admin/requests/:id/approve', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const request = await prisma.partnerRequest.findUnique({ where: { id: req.params.id } });
    if (!request) throw new ApiError(404, 'Заявка не найдена');

    // Создаём магазин
    const slug = request.storeName.toLowerCase().replace(/[^a-zа-яёoʻgʻ0-9]+/gi, '-').replace(/-+$/g, '') + '-' + Date.now();
    const store = await prisma.partnerStore.create({
      data: {
        name: request.storeName,
        slug,
        phone: request.phone,
        email: request.email,
        address: request.address,
        city: request.city,
        storeCategory: request.storeCategory,
        contactPerson: request.contactPerson,
        status: 'ACTIVE',
      },
    });

    await prisma.partnerRequest.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });

    logger.info({ storeId: store.id, requestId: req.params.id }, 'Партнёрская заявка одобрена');
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /stores/admin/requests/:id/reject — Отклонить заявку ─────
router.put('/admin/requests/:id/reject', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { adminNote } = req.body;
    const updated = await prisma.partnerRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', adminNote, reviewedAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ─── POST /stores/admin — Создать магазин напрямую ─────
router.post('/admin', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.name || !data.phone || !data.contactPerson || !data.storeCategory) {
      throw new ApiError(400, 'Необходимые поля: name, phone, contactPerson, storeCategory');
    }

    const slug = data.slug || data.name.toLowerCase().replace(/[^a-zа-яёoʻgʻ0-9]+/gi, '-') + '-' + Date.now();
    const store = await prisma.partnerStore.create({
      data: { ...data, slug, status: 'ACTIVE' },
    });

    res.status(201).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /stores/admin/:id — Обновить магазин ─────
router.put('/admin/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const store = await prisma.partnerStore.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /stores/admin/:id — Удалить магазин ─────
router.delete('/admin/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.partnerStore.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Магазин удалён' } });
  } catch (error) {
    next(error);
  }
});

export default router;
