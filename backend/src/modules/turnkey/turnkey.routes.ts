// ============================================
// MasterUz — Ремонт под ключ (Routes)
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ─── POST /turnkey — Создать заявку на ремонт под ключ ─────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      title, description, propertyType, area, rooms,
      budgetMin, budgetMax, address, city, district,
      latitude, longitude, designIncluded, furnitureIncluded, images,
    } = req.body;

    if (!title || !propertyType) {
      throw new ApiError(400, 'Укажите название и тип объекта');
    }

    const project = await prisma.turnkeyProject.create({
      data: {
        clientId: req.user!.userId,
        title,
        description,
        propertyType,
        area: area ? Number(area) : null,
        rooms: rooms ? Number(rooms) : null,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        address,
        city,
        district,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        designIncluded: designIncluded || false,
        furnitureIncluded: furnitureIncluded || false,
        images: images || [],
        status: 'INQUIRY',
      },
    });

    // Создаём стандартные этапы ремонта
    const defaultStages = [
      { name: 'Консультация и замер', nameUz: 'Maslahat va oʻlchash', nameEn: 'Consultation & measurement', sortOrder: 1 },
      { name: 'Дизайн-проект', nameUz: 'Dizayn-loyiha', nameEn: 'Design project', sortOrder: 2 },
      { name: 'Демонтажные работы', nameUz: 'Demontaj ishlari', nameEn: 'Demolition works', sortOrder: 3 },
      { name: 'Черновая отделка', nameUz: 'Qoralama pardoz', nameEn: 'Rough finishing', sortOrder: 4 },
      { name: 'Чистовая отделка', nameUz: 'Sof pardoz', nameEn: 'Fine finishing', sortOrder: 5 },
      { name: 'Установка мебели и техники', nameUz: 'Mebel va texnika oʻrnatish', nameEn: 'Furniture & appliance installation', sortOrder: 6 },
      { name: 'Финальная уборка и сдача', nameUz: 'Yakuniy tozalash va topshirish', nameEn: 'Final cleanup & handover', sortOrder: 7 },
    ];

    await prisma.turnkeyStage.createMany({
      data: defaultStages.map(s => ({ ...s, projectId: project.id })),
    });

    const result = await prisma.turnkeyProject.findUnique({
      where: { id: project.id },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });

    logger.info({ projectId: project.id, clientId: req.user!.userId }, 'Новая заявка на ремонт под ключ');
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── GET /turnkey/my — Мои проекты ─────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const projects = await prisma.turnkeyProject.findMany({
      where: { clientId: req.user!.userId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
});

// ─── GET /turnkey/:id — Детали проекта ─────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const project = await prisma.turnkeyProject.findUnique({
      where: { id: req.params.id },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!project) throw new ApiError(404, 'Проект не найден');

    // Клиент видит только свои проекты, админ — все
    if (project.clientId !== req.user!.userId && req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
      throw new ApiError(403, 'Нет доступа');
    }

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /turnkey/:id — Обновить проект (клиент) ─────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const project = await prisma.turnkeyProject.findUnique({ where: { id: req.params.id } });
    if (!project) throw new ApiError(404, 'Проект не найден');
    if (project.clientId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new ApiError(403, 'Нет доступа');
    }

    const updated = await prisma.turnkeyProject.update({
      where: { id: req.params.id },
      data: req.body,
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ─── GET /turnkey/calculator/estimate — Калькулятор стоимости ─────
router.get('/calculator/estimate', async (req, res, next) => {
  try {
    const { propertyType, area, rooms, designIncluded, furnitureIncluded } = req.query;

    if (!area) throw new ApiError(400, 'Укажите площадь');

    const areaNum = Number(area);
    const roomsNum = rooms ? Number(rooms) : 1;

    // Базовые расценки за м² (UZS)
    const rates: Record<string, { min: number; max: number }> = {
      apartment: { min: 400000, max: 1200000 },
      house: { min: 500000, max: 1500000 },
      office: { min: 350000, max: 1000000 },
      commercial: { min: 450000, max: 1300000 },
    };

    const type = String(propertyType || 'apartment');
    const rate = rates[type] || rates.apartment;

    let minPrice = areaNum * rate.min;
    let maxPrice = areaNum * rate.max;

    // Дизайн-проект
    if (designIncluded === 'true') {
      minPrice += areaNum * 100000; // 100к/м² за дизайн
      maxPrice += areaNum * 250000;
    }

    // Мебель
    if (furnitureIncluded === 'true') {
      minPrice += roomsNum * 3000000;
      maxPrice += roomsNum * 15000000;
    }

    // Сроки (дни)
    const estimatedDaysMin = Math.max(15, Math.round(areaNum * 0.3));
    const estimatedDaysMax = Math.max(30, Math.round(areaNum * 0.8));

    res.json({
      success: true,
      data: {
        propertyType: type,
        area: areaNum,
        rooms: roomsNum,
        designIncluded: designIncluded === 'true',
        furnitureIncluded: furnitureIncluded === 'true',
        priceMin: Math.round(minPrice),
        priceMax: Math.round(maxPrice),
        estimatedDaysMin,
        estimatedDaysMax,
        pricePerSqmMin: rate.min,
        pricePerSqmMax: rate.max,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════
// ADMIN: Управление проектами
// ═══════════════════════════════════════════════

// ─── GET /turnkey/admin/projects — Все проекты ─────
router.get('/admin/projects', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};
    if (status) where.status = String(status);

    const [projects, total] = await Promise.all([
      prisma.turnkeyProject.findMany({
        where,
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.turnkeyProject.count({ where }),
    ]);

    res.json({
      success: true,
      data: projects,
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

// ─── PUT /turnkey/admin/projects/:id/status — Обновить статус проекта ─────
router.put('/admin/projects/:id/status', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, totalPrice, estimatedDays } = req.body;
    const data: any = { status };
    if (totalPrice) data.totalPrice = Number(totalPrice);
    if (estimatedDays) data.estimatedDays = Number(estimatedDays);
    if (status === 'IN_PROGRESS') data.actualStartDate = new Date();
    if (status === 'COMPLETED') data.actualEndDate = new Date();

    const project = await prisma.turnkeyProject.update({
      where: { id: req.params.id },
      data,
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /turnkey/admin/stages/:id — Обновить этап ─────
router.put('/admin/stages/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, progress, startDate, endDate } = req.body;
    const data: any = {};
    if (status) data.status = status;
    if (progress !== undefined) data.progress = Number(progress);
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    const stage = await prisma.turnkeyStage.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ success: true, data: stage });
  } catch (error) {
    next(error);
  }
});

export default router;
