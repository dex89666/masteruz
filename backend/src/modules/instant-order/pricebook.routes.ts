// ============================================
// MasterUz — Прайс-реестр: админ-API
// ============================================
//
// До этого цена жила в TypeScript-файле: чтобы поправить стоимость пайки
// трубы, нужен был деплой. Здесь она правится из панели, каждая правка
// пишется отдельной версией с указанием автора и прежнего значения.
//
// Калиброванные позиции (source = CALIBRATED) правятся так же, но такая
// правка возвращает позицию в статус EXPERT: человек сказал последнее слово,
// и ночной калибровщик не должен молча его перетереть.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditService } from '../../services/auditService.js';
import { clampPagination } from '../../utils/helpers.js';
import { invalidatePriceBookCache } from './pricebook.service.js';
import { roundUnitPrice } from './pricing-catalog.js';
import { buildPriceBookSeed, findPriceConflicts } from './pricebook.mapping.js';
import { getAccuracyReport } from '../../services/priceAccuracyService.js';
import { calibratePrices, collectObservations } from '../../services/priceCalibrationService.js';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'MANAGER'));

// ─── Схемы ───────────────────────────────────

const itemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  categorySlug: z.string().max(100).optional(),
  kind: z.enum(['LABOR', 'MATERIAL']).optional(),
  source: z.enum(['EXPERT', 'CALIBRATED']).optional(),
  search: z.string().max(200).optional(),
});

const updateItemSchema = z.object({
  unitPrice: z.number().min(0).max(1_000_000_000).optional(),
  minCheck: z.number().min(0).max(1_000_000_000).optional(),
  name: z.string().min(2).max(300).optional(),
  unit: z.string().min(1).max(40).optional(),
  laborMinutes: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().max(300).optional(),
});

const bulkPriceSchema = z.object({
  // Массовая правка нужна для сезонной индексации: поднять все работы
  // категории на N %, не открывая 60 карточек по одной.
  categorySlug: z.string().min(1).max(100),
  kind: z.enum(['LABOR', 'MATERIAL']).optional(),
  factor: z.number().min(0.5).max(2),
  reason: z.string().min(3).max(300),
});

const updateModifierSchema = z.object({
  factor: z.number().min(0.5).max(2),
  label: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
});

// ─── Версионирование ─────────────────────────

interface PriceChange {
  code: string;
  field: string;
  from: string | number | null;
  to: string | number;
}

/** Записать версию прайса. Версии нумеруются подряд и не переиспользуются. */
async function recordVersion(reason: string, changedById: string | undefined, changes: PriceChange[]) {
  const last = await prisma.priceBookVersion.findFirst({ orderBy: { version: 'desc' } });
  return prisma.priceBookVersion.create({
    data: {
      version: (last?.version ?? 0) + 1,
      reason,
      changedById: changedById ?? null,
      changes: changes as any,
      itemsTouched: changes.length,
    },
  });
}

// ─── Позиции ─────────────────────────────────

router.get('/items', validateQuery(itemsQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as any;
    const { page, limit, skip } = clampPagination(q.page, q.limit, 50);

    const where: any = {};
    if (q.categorySlug) where.categorySlug = q.categorySlug;
    if (q.kind) where.kind = q.kind;
    if (q.source) where.source = q.source;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.priceItem.findMany({ where, orderBy: [{ categorySlug: 'asc' }, { code: 'asc' }], skip, take: limit }),
      prisma.priceItem.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page, limit } });
  } catch (error) {
    next(error);
  }
});

router.patch('/items/:id', validateBody(updateItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof updateItemSchema>;
    const item = await prisma.priceItem.findUnique({ where: { id: req.params.id } });
    if (!item) throw ApiError.notFound('Позиция прайса не найдена');

    const changes: PriceChange[] = [];
    const data: any = {};

    if (body.unitPrice !== undefined && Number(item.unitPrice) !== body.unitPrice) {
      changes.push({ code: item.code, field: 'unitPrice', from: Number(item.unitPrice), to: body.unitPrice });
      data.unitPrice = body.unitPrice;
      // Ручная правка возвращает позицию под ответственность человека.
      // Калибровщик увидит manualPriceAt и выдержит паузу, а не перетрёт
      // решение админа на следующую же ночь.
      data.source = 'EXPERT';
      data.sampleSize = 0;
      data.manualPriceAt = new Date();
    }
    if (body.minCheck !== undefined && Number(item.minCheck) !== body.minCheck) {
      changes.push({ code: item.code, field: 'minCheck', from: Number(item.minCheck), to: body.minCheck });
      data.minCheck = body.minCheck;
    }
    if (body.name !== undefined && item.name !== body.name) {
      changes.push({ code: item.code, field: 'name', from: item.name, to: body.name });
      data.name = body.name;
    }
    if (body.unit !== undefined && item.unit !== body.unit) {
      changes.push({ code: item.code, field: 'unit', from: item.unit, to: body.unit });
      data.unit = body.unit;
    }
    if (body.laborMinutes !== undefined && item.laborMinutes !== body.laborMinutes) {
      changes.push({ code: item.code, field: 'laborMinutes', from: item.laborMinutes, to: body.laborMinutes });
      data.laborMinutes = body.laborMinutes;
    }
    if (body.isActive !== undefined && item.isActive !== body.isActive) {
      changes.push({ code: item.code, field: 'isActive', from: String(item.isActive), to: String(body.isActive) });
      data.isActive = body.isActive;
    }

    if (changes.length === 0) {
      res.json({ success: true, data: { item, changed: false } });
      return;
    }

    const updated = await prisma.priceItem.update({ where: { id: item.id }, data });
    const version = await recordVersion(body.reason || 'Ручная правка позиции', req.user?.userId, changes);
    invalidatePriceBookCache();

    await auditService.log({
      actorId: req.user!.userId,
      action: 'PRICEBOOK_ITEM_UPDATE',
      entityType: 'PriceItem',
      entityId: item.id,
      details: { changes, version: version.version } as any,
    });

    res.json({ success: true, data: { item: updated, changed: true, version: version.version } });
  } catch (error) {
    next(error);
  }
});

router.post('/items/bulk-price', validateBody(bulkPriceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categorySlug, kind, factor, reason } = req.body as z.infer<typeof bulkPriceSchema>;

    const where: any = { categorySlug, isActive: true };
    if (kind) where.kind = kind;

    const items = await prisma.priceItem.findMany({ where });
    if (items.length === 0) throw ApiError.badRequest('В этой категории нет активных позиций');

    const changes: PriceChange[] = [];
    for (const item of items) {
      const from = Number(item.unitPrice);
      // Шаг округления подбирается под величину цены: единый шаг в 1 000 сум
      // удвоил бы позицию вроде «покос газона, 500 сум за м²».
      const to = Math.max(roundUnitPrice(from * factor), 0);
      if (to === from) continue;
      changes.push({ code: item.code, field: 'unitPrice', from, to });
      await prisma.priceItem.update({
        where: { id: item.id },
        data: { unitPrice: to, source: 'EXPERT', sampleSize: 0, manualPriceAt: new Date() },
      });
    }

    const version = await recordVersion(reason, req.user?.userId, changes);
    invalidatePriceBookCache();

    await auditService.log({
      actorId: req.user!.userId,
      action: 'PRICEBOOK_BULK_PRICE',
      entityType: 'PriceItem',
      entityId: categorySlug,
      details: { categorySlug, kind, factor, touched: changes.length, version: version.version } as any,
    });

    res.json({ success: true, data: { touched: changes.length, version: version.version } });
  } catch (error) {
    next(error);
  }
});

// ─── Проблемы и решения ──────────────────────

router.get('/problems', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categorySlug = typeof req.query.categorySlug === 'string' ? req.query.categorySlug : undefined;
    const problems = await prisma.priceProblem.findMany({
      where: categorySlug ? { categorySlug } : {},
      orderBy: [{ categorySlug: 'asc' }, { sortOrder: 'asc' }],
      include: {
        solutions: {
          orderBy: { tier: 'asc' },
          include: { lines: { orderBy: { sortOrder: 'asc' }, include: { item: true } } },
        },
      },
    });

    // Сразу отдаём итог по каждому решению — админу нужно видеть цену,
    // а не складывать строки в уме.
    const withTotals = problems.map((p) => ({
      ...p,
      solutions: p.solutions.map((s) => ({
        ...s,
        total: s.lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.item.unitPrice), 0),
      })),
    }));

    res.json({ success: true, data: withTotals });
  } catch (error) {
    next(error);
  }
});

// ─── Множители ───────────────────────────────

router.get('/modifiers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const modifiers = await prisma.priceModifier.findMany({ orderBy: [{ type: 'asc' }, { key: 'asc' }] });
    res.json({ success: true, data: modifiers });
  } catch (error) {
    next(error);
  }
});

router.patch('/modifiers/:id', validateBody(updateModifierSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof updateModifierSchema>;
    const modifier = await prisma.priceModifier.findUnique({ where: { id: req.params.id } });
    if (!modifier) throw ApiError.notFound('Множитель не найден');

    const changes: PriceChange[] = [];
    if (Number(modifier.factor) !== body.factor) {
      changes.push({
        code: `${modifier.type}.${modifier.key}`,
        field: 'factor',
        from: Number(modifier.factor),
        to: body.factor,
      });
    }

    const updated = await prisma.priceModifier.update({
      where: { id: modifier.id },
      data: {
        factor: body.factor,
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });

    if (changes.length > 0) await recordVersion('Правка множителя', req.user?.userId, changes);
    invalidatePriceBookCache();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ─── Расхождения в ценах ─────────────────────

/**
 * Позиции, которые выглядят как одна и та же работа с разной ценой.
 *
 * Импорт намеренно не «чинит» такие места: цена — решение владельца сервиса,
 * а не скрипта. Но невидимыми они быть не должны, иначе клиент получает
 * разную сумму за одно и то же в зависимости от того, каким путём пошёл
 * расчёт. Здесь они собраны в один список для разбора в панели.
 */
router.get('/conflicts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Сверяем по фактическому состоянию реестра, а не по каталогу в коде:
    // после ручных правок и калибровки картина меняется.
    const items = await prisma.priceItem.findMany({
      where: { isActive: true },
      select: { code: true, name: true, unit: true, kind: true, unitPrice: true, categorySlug: true, source: true },
    });

    const seed = {
      items: items.map((i) => ({
        code: i.code,
        name: i.name,
        unit: i.unit,
        kind: i.kind as 'LABOR' | 'MATERIAL',
        unitPrice: Number(i.unitPrice),
        minCheck: 0,
        laborMinutes: 0,
        categorySlug: i.categorySlug,
      })),
      problems: [],
      modifiers: [],
    };

    const conflicts = findPriceConflicts(seed as ReturnType<typeof buildPriceBookSeed>);
    res.json({
      success: true,
      data: {
        conflicts,
        total: conflicts.length,
        // Подсказка для панели: что именно предстоит решить человеку.
        hint: 'Импорт переносит каталог как есть. Разброс ниже — решение владельца сервиса, а не ошибка переноса.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Точность и калибровка ───────────────────

/**
 * Сводка точности: сходится ли обещанная цена с фактически уплаченной,
 * и какая доля прайса уже опирается на сделки, а не на экспертную оценку.
 */
router.get('/accuracy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = req.query.days ? Number(req.query.days) : null;
    const report = await getAccuracyReport(Number.isFinite(days as number) ? days : null);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

/**
 * Ручной прогон калибровки. По умолчанию сухой: показывает, что изменится,
 * ничего не записывая. Реальный прогон — только для админа: он двигает цены
 * по всему сервису.
 */
router.post('/calibrate', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    const collected = await collectObservations();
    const calibrated = await calibratePrices({ dryRun });

    if (!dryRun) {
      await auditService.log({
        actorId: req.user!.userId,
        action: 'PRICEBOOK_CALIBRATE',
        entityType: 'PriceItem',
        entityId: 'all',
        details: { itemsChanged: calibrated.changed.length, version: calibrated.version } as any,
      });
    }

    res.json({ success: true, data: { dryRun, collected, calibrated } });
  } catch (error) {
    next(error);
  }
});

// ─── История версий ──────────────────────────

router.get('/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = clampPagination(req.query.page as any, req.query.limit as any, 20);
    const [versions, total] = await Promise.all([
      prisma.priceBookVersion.findMany({ orderBy: { version: 'desc' }, skip, take: limit }),
      prisma.priceBookVersion.count(),
    ]);

    const authorIds = Array.from(new Set(versions.map((v) => v.changedById).filter(Boolean))) as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, username: true, role: true } })
      : [];
    const byId = new Map(authors.map((a) => [a.id, a]));

    res.json({
      success: true,
      data: {
        versions: versions.map((v) => ({ ...v, author: v.changedById ? byId.get(v.changedById) ?? null : null })),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
