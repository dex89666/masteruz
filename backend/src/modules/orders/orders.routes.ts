// ============================================
// MasterUz — Orders Routes (Антифрод)
// ============================================

import { Router } from 'express';
import { ordersController } from './orders.controller.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { createOrderSchema, orderResponseSchema, listOrdersSchema } from './orders.schema.js';
import { eventBus } from '../../services/eventBus.js';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';

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

router.post('/:id/respond', authenticate, validateBody(orderResponseSchema), (req, res, next) =>
  ordersController.respond(req, res, next)
);

router.put('/:id/assign', authenticate, (req, res, next) =>
  ordersController.assign(req, res, next)
);

// Мастер обновляет статус: ACCEPTED → IN_TRANSIT → IN_PROGRESS
router.put('/:id/status', authenticate, (req, res, next) =>
  ordersController.updateStatus(req, res, next)
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

router.put('/:id/cancel', authenticate, (req, res, next) =>
  ordersController.cancel(req, res, next)
);

// Спор
router.put('/:id/dispute', authenticate, (req, res, next) =>
  ordersController.dispute(req, res, next)
);

// Разрешение спора (admin)
router.put('/:id/resolve-dispute', authenticate, (req, res, next) =>
  ordersController.resolveDispute(req, res, next)
);

// Мои заказы
router.get('/my/client', authenticate, (req, res, next) =>
  ordersController.myClientOrders(req, res, next)
);

router.get('/my/master', authenticate, (req, res, next) =>
  ordersController.myMasterOrders(req, res, next)
);

// ─── SSE: Real-time события заказа ─────────────
router.get('/:id/events', authenticate, async (req, res, next) => {
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

export default router;
