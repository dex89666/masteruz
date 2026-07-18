// ============================================
// MasterUz — Orders Routes (Антифрод)
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { ordersController } from './orders.controller.js';
import { authenticate, optionalAuth, authorize } from '../../middleware/auth.js';
import { requireNotBlocked } from '../../middleware/blockGate.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createOrderSchema, orderResponseSchema, listOrdersSchema, assignMasterSchema, updateStatusSchema, masterLocationSchema, cancelOrderSchema, disputeOrderSchema, resolveDisputeSchema, submitRemainderSchema, proposePriceChangeSchema, proposeSettlementSchema, rejectPriceChangeSchema, moderatePriceChangeSchema } from './orders.schema.js';
import { priceChangeService } from './price-change.service.js';
import { UserRole } from '@prisma/client';
import { eventBus } from '../../services/eventBus.js';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { getRedis } from '../../config/redis.js';
import crypto from 'crypto';

const router = Router();

// Публичные маршруты (с опциональной авторизацией)
router.get('/', optionalAuth, validateQuery(listOrdersSchema), (req, res, next) =>
  ordersController.list(req, res, next)
);

router.get('/:id', optionalAuth, (req, res, next) =>
  ordersController.getById(req, res, next)
);

// Защищённые маршруты
router.post('/', authenticate, validateBody(createOrderSchema), (req, res, next) =>
  ordersController.create(req, res, next)
);

router.post('/:id/respond', authenticate, requireNotBlocked, validateBody(orderResponseSchema), (req, res, next) =>
  ordersController.respond(req, res, next)
);

router.put('/:id/assign', authenticate, validateBody(assignMasterSchema), (req, res, next) =>
  ordersController.assign(req, res, next)
);

// Мастер обновляет статус: ACCEPTED → IN_TRANSIT → IN_PROGRESS
router.put('/:id/status', authenticate, requireNotBlocked, validateBody(updateStatusSchema), (req, res, next) =>
  ordersController.updateStatus(req, res, next)
);

// Live-позиция мастера (для трекинга клиентом)
router.post('/:id/master-location', authenticate, validateBody(masterLocationSchema), (req, res, next) =>
  ordersController.masterLocation(req, res, next)
);

// Двойное подтверждение завершения
router.put('/:id/master-confirm', authenticate, (req, res, next) =>
  ordersController.masterConfirm(req, res, next)
);

router.put('/:id/client-confirm', authenticate, (req, res, next) =>
  ordersController.clientConfirm(req, res, next)
);

// Обратная совместимость: /complete вызывает masterConfirm или clientConfirm
router.put('/:id/complete', authenticate, (req, res, next) =>
  ordersController.complete(req, res, next)
);

router.put('/:id/cancel', authenticate, validateBody(cancelOrderSchema), (req, res, next) =>
  ordersController.cancel(req, res, next)
);

// Спор
router.put('/:id/dispute', authenticate, validateBody(disputeOrderSchema), (req, res, next) =>
  ordersController.dispute(req, res, next)
);

// Разрешение спора (admin)
router.put('/:id/resolve-dispute', authenticate, validateBody(resolveDisputeSchema), (req, res, next) =>
  ordersController.resolveDispute(req, res, next)
);

// Клиент оплачивает остаток (CASH/CARD) после подтверждения мастером
router.put('/:id/remainder', authenticate, validateBody(submitRemainderSchema), (req, res, next) =>
  ordersController.submitRemainder(req, res, next)
);

// Мои заказы
router.get('/my/client', authenticate, (req, res, next) =>
  ordersController.myClientOrders(req, res, next)
);

router.get('/my/master', authenticate, (req, res, next) =>
  ordersController.myMasterOrders(req, res, next)
);

// ─── SSE: Одноразовый ticket (JWT никогда не попадает в URL) ─────
router.post('/:id/events-ticket', authenticate, async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const userId = req.user!.userId;

    // Проверяем доступ: участник заказа или админ
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const isParticipant = order.clientId === userId || order.masterId === userId;
    if (!isParticipant && !isAdmin) {
      throw ApiError.forbidden('Нет доступа');
    }

    // Генерируем одноразовый ticket (30 секунд TTL)
    const ticket = crypto.randomBytes(32).toString('hex');
    const redis = getRedis();
    await redis.set(`sse-ticket:${ticket}`, JSON.stringify({ userId, orderId }), 'EX', 30);

    res.json({ success: true, data: { ticket } });
  } catch (error) {
    next(error);
  }
});

// ─── SSE: Real-time события заказа (через одноразовый ticket) ─────
router.get('/:id/events', async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';

    if (!ticket) {
      throw ApiError.unauthorized('Ticket обязателен. Получите через POST /orders/:id/events-ticket');
    }

    // Валидируем и удаляем одноразовый ticket
    const redis = getRedis();
    const ticketData = await redis.get(`sse-ticket:${ticket}`);
    if (!ticketData) {
      throw ApiError.unauthorized('Невалидный или истёкший ticket');
    }
    await redis.del(`sse-ticket:${ticket}`);

    const { userId, orderId: ticketOrderId } = JSON.parse(ticketData);
    if (ticketOrderId !== orderId) {
      throw ApiError.forbidden('Ticket не соответствует заказу');
    }

    // Проверяем доступ: участник заказа или админ
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { clientId: true, masterId: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const isParticipant = order.clientId === userId || order.masterId === userId;
    if (!isParticipant && !isAdmin) {
      throw ApiError.forbidden('Нет доступа');
    }

    // Настраиваем SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // для nginx
    });

    // Приветственное событие
    res.write(`event: connected\ndata: ${JSON.stringify({ orderId, userId })}\n\n`);

    // Регистрируем в EventBus
    eventBus.addClient(orderId, userId, res);

    // Keepalive каждые 30 сек
    const keepalive = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(keepalive);
        return;
      }
      try { res.write(': keepalive\n\n'); } catch { /* ignore */ }
    }, 30000);

    // Очистка при отключении
    req.on('close', () => {
      clearInterval(keepalive);
      eventBus.removeClient(orderId, userId);
    });
  } catch (error) {
    next(error);
  }
});

// ─── Изменение цены по ходу работ ─────────────────────────────────
// Мастер предлагает новую цену работ (доп. работы / уточнение объёма).
// Рост > лимита → сначала модерация админом, затем подтверждение клиента.
router.post('/:id/price-change', authenticate, requireNotBlocked, validateBody(proposePriceChangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await priceChangeService.propose(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Мастер заявляет фактически выполненный объём после отказа клиента от новой цены.
router.post('/:id/settlement', authenticate, requireNotBlocked, validateBody(proposeSettlementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await priceChangeService.proposeSettlement(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Список заявок по заказу (клиент / мастер).
router.get('/:id/price-changes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await priceChangeService.listByOrder(req.user!.userId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Клиент подтверждает заявку → цена/комиссия/остаток пересчитываются.
router.post('/price-changes/:requestId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await priceChangeService.approve(req.user!.userId, req.params.requestId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Клиент отклоняет заявку.
router.post('/price-changes/:requestId/reject', authenticate, validateBody(rejectPriceChangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await priceChangeService.reject(req.user!.userId, req.params.requestId, req.body.comment);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Мастер отзывает свою заявку, пока клиент не ответил.
router.post('/price-changes/:requestId/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await priceChangeService.cancel(req.user!.userId, req.params.requestId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Админ/менеджер: очередь заявок на модерацию (снижения, расчёты, рост > лимита).
router.get('/price-changes/moderation-queue', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const result = await priceChangeService.listForModeration(page, limit);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

// Админ/менеджер: модерация заявки с ростом выше лимита.
router.post('/price-changes/:requestId/moderate', authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER),
  validateBody(moderatePriceChangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await priceChangeService.moderate(
        req.user!.userId, req.params.requestId, req.body.approve, req.body.note
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
