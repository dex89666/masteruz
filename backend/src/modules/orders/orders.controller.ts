// ============================================
// MasterUz — Orders Controller (Антифрод)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ordersService } from './orders.service.js';

export class OrdersController {
  /** POST /api/orders */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.createOrder(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/orders */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ordersService.listOrders(req.query as any, req.user?.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/orders/:id */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.getOrder(req.params.id, req.user?.userId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/orders/:id/respond */
  async respond(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await ordersService.respondToOrder(
        req.params.id,
        req.user!.userId,
        req.body
      );
      res.status(201).json({ success: true, data: response });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/assign */
  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.assignMaster(
        req.params.id,
        req.user!.userId,
        req.body.masterId
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/status — Мастер обновляет статус (ACCEPTED→IN_TRANSIT→IN_PROGRESS) */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, latitude, longitude, transitReason, etaMinutes } = req.body;
      const order = await ordersService.updateOrderStatus(
        req.params.id,
        req.user!.userId,
        status,
        { latitude, longitude, transitReason, etaMinutes }
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/orders/:id/master-location — live-позиция мастера (IN_TRANSIT) */
  async masterLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ordersService.broadcastMasterLocation(
        req.params.id,
        req.user!.userId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/complete */
  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.completeOrder(req.params.id, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/master-confirm */
  async masterConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.masterConfirmComplete(req.params.id, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/client-confirm */
  async clientConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.clientConfirmComplete(req.params.id, req.user!.userId);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/cancel */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ordersService.cancelOrder(
        req.params.id,
        req.user!.userId,
        req.body.reason
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/dispute */
  async dispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await ordersService.disputeOrder(
        req.params.id,
        req.user!.userId,
        req.body.reason
      );
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/resolve-dispute (admin) */
  async resolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ordersService.resolveDispute(
        req.params.id,
        req.user!.userId,
        req.body.resolution,
        req.body.note,
        req.body.falseDispute === true,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/orders/:id/remainder — клиент выбирает способ доплаты остатка (CASH/CARD) */
  async submitRemainder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ordersService.submitRemainder(
        req.params.id,
        req.user!.userId,
        req.body.method,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/orders/my/client */
  async myClientOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await ordersService.getClientOrders(
        req.user!.userId,
        req.query.status as string
      );
      res.json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/orders/my/master */
  async myMasterOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await ordersService.getMasterOrders(
        req.user!.userId,
        req.query.status as string
      );
      res.json({ success: true, data: orders });
    } catch (error) {
      next(error);
    }
  }
}

export const ordersController = new OrdersController();
