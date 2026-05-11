// ============================================
// MasterUz — Admin Routes
// Агент 9 (Админ-панель разработчик)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { adminUsersQuerySchema, blockUserSchema, changeRoleSchema, adminBalanceSchema, adminOrderCommentSchema, adminConfigSchema } from './admin.schema.js';
import { prisma } from '../../config/database.js';
import { balanceService } from '../balance/balance.service.js';
import { clampPagination } from '../../utils/helpers.js';

const router = Router();

// Все маршруты только для админов/менеджеров
router.use(authenticate, authorize('ADMIN', 'MANAGER'));

// Дашборд
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await adminService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

// Пользователи
router.get('/users', validateQuery(adminUsersQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getUsers({
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number,
      role: req.query.role as string,
      search: req.query.search as string,
      isActive: req.query.isActive as unknown as boolean | undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Блокировка
router.put('/users/:id/block', validateBody(blockUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.toggleUserBlock(
      req.user!.userId,
      req.params.id,
      req.body.reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Верификация
router.put('/users/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.verifyUser(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Смена роли пользователя (только ADMIN)
router.put('/users/:id/role', authorize('ADMIN'), validateBody(changeRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    // Нельзя менять роль самому себе
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ success: false, error: { message: 'Нельзя изменить свою собственную роль' } });
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: role as any },
      include: {
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    res.json({ success: true, data: { id: user.id, username: user.username, role: user.role, firstName: user.profile?.firstName } });
  } catch (error) {
    next(error);
  }
});

// ═══ УПРАВЛЕНИЕ БАЛАНСОМ ПОЛЬЗОВАТЕЛЕЙ ═══

// Получить баланс пользователя
router.get('/users/:id/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await balanceService.getBalance(req.params.id);
    res.json({ success: true, data: { balance } });
  } catch (error) {
    next(error);
  }
});

// История транзакций пользователя
router.get('/users/:id/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = clampPagination(req.query.page, req.query.limit);
    const result = await balanceService.getTransactions(req.params.id, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Зачислить средства пользователю (только ADMIN)
router.post('/users/:id/balance/topup', authorize('ADMIN'), validateBody(adminBalanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, reason } = req.body;
    const result = await balanceService.adminTopUp(
      req.params.id,
      amount,
      req.user!.userId,
      reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Списать средства с пользователя (только ADMIN)
router.post('/users/:id/balance/withdraw', authorize('ADMIN'), validateBody(adminBalanceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, reason } = req.body;
    const result = await balanceService.adminWithdraw(
      req.params.id,
      amount,
      req.user!.userId,
      reason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Заказы
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getAllOrders({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Комментарий админа к заказу
router.put('/orders/:id/comment', validateBody(adminOrderCommentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const order = await prisma.order.update({
      where: { id },
      data: { adminComment: comment || null },
      select: { id: true, adminComment: true },
    });
    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// Платежи
router.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getAllPayments({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      provider: req.query.provider as string,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Конфигурация
router.get('/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await adminService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.put('/config', authorize('ADMIN'), validateBody(adminConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, value, description } = req.body;
    const config = await adminService.updateConfig(req.user!.userId, key, value, description);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// ─── Fraud-сигналы (anti-bypass) ──────────────
router.get('/fraud-signals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit);

    const [signals, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { action: 'FRAUD_SIGNAL' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              phone: true,
              role: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.auditLog.count({ where: { action: 'FRAUD_SIGNAL' } }),
    ]);

    res.json({
      success: true,
      data: signals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// Чёрный список (расширенный)
router.get('/blacklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit);
    const violationType = req.query.violationType as string;

    const where: any = {};
    if (violationType) where.violationType = violationType;

    const [entries, total] = await Promise.all([
      prisma.blacklist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true, avatarUrl: true, city: true, district: true, address: true } },
              masterProfile: { select: { completedOrders: true, rating: true } },
            },
          },
          blockedBy: {
            include: { profile: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.blacklist.count({ where }),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Добавить в чёрный список (расширенная версия)
router.post('/blacklist', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, reason, violationType, evidence, penaltyAmount, orderId, isPermanent, telegramLocation } = req.body;

    // Проверяем пользователя
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!targetUser) {
      res.status(404).json({ success: false, error: { message: 'Пользователь не найден' } });
      return;
    }

    // Создаём запись в чёрном списке
    const entry = await prisma.blacklist.create({
      data: {
        userId,
        reason,
        blockedById: req.user!.userId,
        violationType: violationType || 'other',
        evidence,
        address: targetUser.profile?.address,
        city: targetUser.profile?.city,
        district: targetUser.profile?.district,
        telegramLocation: telegramLocation || null,
        penaltyAmount: penaltyAmount ? parseFloat(penaltyAmount) : null,
        orderId: orderId || null,
        isPermanent: isPermanent !== false,
      },
      include: {
        user: { include: { profile: { select: { firstName: true, lastName: true } } } },
        blockedBy: { include: { profile: { select: { firstName: true } } } },
      },
    });

    // Блокируем пользователя
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Списываем штраф при наличии
    if (penaltyAmount && parseFloat(penaltyAmount) > 0) {
      const { balanceService } = await import('../balance/balance.service.js');
      await balanceService.chargePenalty(
        userId,
        parseFloat(penaltyAmount),
        orderId || 'blacklist',
        `Штраф за нарушение: ${reason}`
      );
    }

    // Уведомление пользователю
    await prisma.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_BLOCKED',
        title: '🚫 Аккаунт заблокирован',
        message: `Причина: ${reason}. ${isPermanent !== false ? 'Блокировка постоянная.' : 'Временная блокировка.'}`,
        data: { reason, violationType },
      },
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
});

// Удалить из чёрного списка (разблокировать)
router.delete('/blacklist/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.blacklist.findUnique({
      where: { id: req.params.id },
    });
    if (!entry) {
      res.status(404).json({ success: false, error: { message: 'Запись не найдена' } });
      return;
    }

    await prisma.$transaction([
      prisma.blacklist.delete({ where: { id: req.params.id } }),
      prisma.user.update({ where: { id: entry.userId }, data: { isActive: true } }),
    ]);

    res.json({ success: true, message: 'Пользователь разблокирован' });
  } catch (error) {
    next(error);
  }
});

// ─── Сертификаты мастеров ───────────────────

// GET /admin/certificates — список сертификатов (с фильтром по статусу верификации)
router.get('/certificates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = clampPagination(req.query.page, req.query.limit);
    const verified = req.query.verified as string | undefined;

    const where: any = {};
    if (verified === 'true') where.verified = true;
    if (verified === 'false') where.verified = false;

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
              masterProfile: { select: { id: true, rating: true, completedOrders: true } },
            },
          },
        },
      }),
      prisma.certificate.count({ where }),
    ]);

    res.json({
      success: true,
      data: certificates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/certificates/:id/verify — верифицировать сертификат
router.put('/certificates/:id/verify', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const certificate = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    if (!certificate) {
      res.status(404).json({ success: false, error: { message: 'Сертификат не найден' } });
      return;
    }

    const updated = await prisma.certificate.update({
      where: { id: req.params.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/certificates/:id/reject — отклонить сертификат
router.put('/certificates/:id/reject', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const certificate = await prisma.certificate.findUnique({ where: { id: req.params.id } });
    if (!certificate) {
      res.status(404).json({ success: false, error: { message: 'Сертификат не найден' } });
      return;
    }

    const updated = await prisma.certificate.update({
      where: { id: req.params.id },
      data: {
        verified: false,
        verifiedAt: null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ─── Категории мастеров ────────────────────

// GET /admin/master/:masterId/categories — категории конкретного мастера
router.get('/master/:masterId/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const masterProfile = await prisma.masterProfile.findFirst({
      where: { userId: req.params.masterId },
      include: {
        masterCategories: {
          include: {
            category: {
              select: { id: true, name: true, nameUz: true, nameEn: true, slug: true, icon: true },
            },
          },
        },
      },
    });
    const categories = masterProfile?.masterCategories.map((mc) => mc.category) || [];
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/master/:masterId/categories — обновить категории мастера (админ)
router.put('/master/:masterId/categories', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryIds } = req.body;
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      res.status(400).json({ success: false, error: { message: 'Укажите хотя бы одну категорию' } });
      return;
    }

    const masterProfile = await prisma.masterProfile.findFirst({
      where: { userId: req.params.masterId },
    });

    if (!masterProfile) {
      res.status(404).json({ success: false, error: { message: 'Профиль мастера не найден' } });
      return;
    }

    await prisma.$transaction([
      prisma.masterCategory.deleteMany({ where: { masterProfileId: masterProfile.id } }),
      prisma.masterCategory.createMany({
        data: categoryIds.map((categoryId: string) => ({
          masterProfileId: masterProfile.id,
          categoryId,
        })),
        skipDuplicates: true,
      }),
    ]);

    const updated = await prisma.masterProfile.findUnique({
      where: { id: masterProfile.id },
      include: {
        masterCategories: {
          include: {
            category: {
              select: { id: true, name: true, nameUz: true, nameEn: true, slug: true, icon: true },
            },
          },
        },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
