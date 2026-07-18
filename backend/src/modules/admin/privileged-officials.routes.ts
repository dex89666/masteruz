// ============================================
// MasterUz — Privileged Officials Routes
// API маршруты для управления привилегиями, KPI и мотивацией
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { privilegedOfficialService } from '../../services/privilegedOfficialService';
import { prisma } from '../../config/database';
import { PrivilegeStatus, PrivilegeType } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { Decimal } from 'decimal.js';

const router = Router();

// Все маршруты только для ADMIN
router.use(authenticate, authorize('ADMIN'));

// ═══════════════════════════════════════════════════════════
// Validation Schemas
// ═══════════════════════════════════════════════════════════

const createOfficialSchema = z.object({
  userId: z.string().uuid(),
  organizationName: z.string().min(3),
  position: z.string().min(2),
  privilegeType: z.enum(Object.values(PrivilegeType) as [string, ...string[]]),
  documentNumber: z.string().optional(),
  documentUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional().transform((v) => v ? new Date(v) : undefined),
});

const updateStatusSchema = z.object({
  status: z.enum(Object.values(PrivilegeStatus) as [string, ...string[]]),
  statusReason: z.string().optional(),
});

const fastTrackSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5),
});

const setOrderPrioritySchema = z.object({
  orderId: z.string().uuid(),
  priorityLevel: z.number().int().min(1).max(3),
  reason: z.string().optional(),
  customSlaHours: z.number().int().min(1).max(72).optional(),
  bonusAmount: z.string().transform((v) => new Decimal(v)).optional(),
});

const listOfficersQuerySchema = z.object({
  status: z.enum(Object.values(PrivilegeStatus) as [string, ...string[]]).optional(),
  privilegeType: z.enum(Object.values(PrivilegeType) as [string, ...string[]]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════
// Routes: Create & Manage Profiles
// ═══════════════════════════════════════════════════════════

/**
 * POST /admin/privileged-officials
 * Создать профиль привилегированного должностного лица
 */
router.post(
  '/privileged-officials',
  validateBody(createOfficialSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await privilegedOfficialService.createOfficialProfile({
        userId: req.body.userId,
        organizationName: req.body.organizationName,
        position: req.body.position,
        privilegeType: req.body.privilegeType,
        documentNumber: req.body.documentNumber,
        documentUrl: req.body.documentUrl,
        expiresAt: req.body.expiresAt,
      });

      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/privileged-officials
 * Список всех привилегированных лиц
 */
router.get(
  '/privileged-officials',
  validateQuery(listOfficersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await privilegedOfficialService.listOfficials({
        status: req.query.status as PrivilegeStatus | undefined,
        privilegeType: req.query.privilegeType as PrivilegeType | undefined,
        search: req.query.search as string | undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/privileged-officials/:officialId
 * Получить детали профиля привилегированного лица
 */
router.get(
  '/privileged-officials/:officialId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await privilegedOfficialService.getOfficialProfile(
        req.params.officialId
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /admin/privileged-officials/:officialId/status
 * Изменить статус профиля (PENDING → ACTIVE / SUSPENDED / REVOKED)
 */
router.put(
  '/privileged-officials/:officialId/status',
  validateBody(updateStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await privilegedOfficialService.updateOfficialStatus({
        officialId: req.params.officialId,
        status: req.body.status,
        statusReason: req.body.statusReason,
        approvedBy: req.user!.userId,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════
// Routes: Order Operations (Fast-track, Priority)
// ═══════════════════════════════════════════════════════════

/**
 * POST /admin/privileged-officials/:officialId/fast-track
 * Ускорить заказ в очереди
 */
router.post(
  '/privileged-officials/:officialId/fast-track',
  validateBody(fastTrackSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await privilegedOfficialService.fastTrackOrder({
        officialId: req.params.officialId,
        orderId: req.body.orderId,
        reason: req.body.reason,
        actorIp: req.ip,
        actorUserAgent: req.get('user-agent'),
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/privileged-officials/:officialId/set-priority
 * Установить приоритет заказу
 */
router.post(
  '/privileged-officials/:officialId/set-priority',
  validateBody(setOrderPrioritySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const priority = await privilegedOfficialService.setOrderPriority({
        officialId: req.params.officialId,
        orderId: req.body.orderId,
        priorityLevel: req.body.priorityLevel,
        reason: req.body.reason,
        customSlaHours: req.body.customSlaHours,
        bonusAmount: req.body.bonusAmount,
      });

      res.json({ success: true, data: priority });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════
// Routes: Audit & History
// ═══════════════════════════════════════════════════════════

/**
 * GET /admin/privileged-officials/:officialId/actions
 * История действий привилегированного лица
 */
router.get(
  '/privileged-officials/:officialId/actions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit)) || 50, 500);
      const offset = parseInt(String(req.query.offset)) || 0;

      const result = await privilegedOfficialService.getActionHistory(
        req.params.officialId,
        { limit, offset }
      );

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════
// Routes: KPI & Motivation
// ═══════════════════════════════════════════════════════════

/**
 * POST /admin/privileged-officials/:officialId/calculate-kpi
 * Рассчитать KPI за период
 */
router.post(
  '/privileged-officials/:officialId/calculate-kpi',
  validateBody(
    z.object({
      period: z.string().regex(/^\d{4}-\d{2}$/),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kpi = await privilegedOfficialService.calculateKPI({
        officialId: req.params.officialId,
        period: req.body.period,
      });

      res.json({ success: true, data: kpi });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/motivation-settings
 * Получить все настройки мотивации
 */
router.get(
  '/motivation-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.motivationSetting.findMany();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /admin/motivation-settings/:privilegeType
 * Обновить настройки мотивации для типа привилегии
 */
router.put(
  '/motivation-settings/:privilegeType',
  validateBody(
    z.object({
      slaThresholdPct: z.number().min(0).max(100).optional(),
      satisfactionMin: z.number().min(1).max(5).optional(),
      baseBonusPercentage: z.number().min(0).max(50).optional(),
      slaBonusBoost: z.number().min(1).max(10).optional(),
      fastTrackLimit: z.number().int().min(1).optional(),
      maxCustomSlaHours: z.number().int().min(1).max(72).optional(),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await prisma.motivationSetting.update({
        where: { privilegeType: req.params.privilegeType as PrivilegeType },
        data: {
          slaThresholdPct: req.body.slaThresholdPct,
          satisfactionMin: req.body.satisfactionMin,
          baseBonusPercentage: req.body.baseBonusPercentage,
          slaBonusBoost: req.body.slaBonusBoost,
          fastTrackLimit: req.body.fastTrackLimit,
          maxCustomSlaHours: req.body.maxCustomSlaHours,
        },
      });

      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
);

// ═══════════════════════════════════════════════════════════
// Routes: Dashboard / Analytics
// ═══════════════════════════════════════════════════════════

/**
 * GET /admin/privileged-officials-dashboard
 * Дашборд по привилегированным лицам и их метрикам
 */
router.get(
  '/privileged-officials-dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [total, active, suspended, avgSlaScore] = await Promise.all([
        prisma.privilegedOfficialProfile.count(),
        prisma.privilegedOfficialProfile.count({
          where: { status: PrivilegeStatus.ACTIVE },
        }),
        prisma.privilegedOfficialProfile.count({
          where: { status: PrivilegeStatus.SUSPENDED },
        }),
        prisma.kPIRecord.aggregate({
          where: { status: 'FINAL' },
          _avg: { slaScore: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalOfficials: total,
          activeOfficials: active,
          suspendedOfficials: suspended,
          avgSlaScore: avgSlaScore._avg.slaScore || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
