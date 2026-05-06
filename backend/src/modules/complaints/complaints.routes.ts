// ============================================
// MasterUz — Complaints Routes
// Публичная подача жалобы + админ-просмотр и обновление статуса.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { complaintsService, ComplaintStatus } from './complaints.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ─── Публичная подача жалобы ─────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, description, contact, fullName, orderId } = req.body || {};
    const record = await complaintsService.create({
      subject,
      description,
      contact,
      fullName,
      orderId,
      ip: getClientIp(req),
      userAgent: (req.headers['user-agent'] || '').toString(),
    });
    res.status(201).json({
      success: true,
      data: { id: record.id, createdAt: record.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Админка ─────────────────────────────────

router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as ComplaintStatus | undefined;
      const list = await complaintsService.list(status ? { status } : undefined);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, adminNote } = req.body || {};
      const record = await complaintsService.update(req.params.id, { status, adminNote });
      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
