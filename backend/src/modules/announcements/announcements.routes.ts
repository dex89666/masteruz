// ============================================
// MasterUz — Announcements Routes
// Публичный список + админ-управление + рассылка в Telegram.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { announcementsService, Audience } from './announcements.service.js';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();
const adminOnly = [authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER)];

// ─── Публичная лента (только активные) ─────────────
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role;
    const audience: Audience | undefined =
      role === 'CLIENT' ? 'CLIENT' : role === 'MASTER' ? 'MASTER' : undefined;
    const items = await announcementsService.list({ activeOnly: true, audience });
    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    next(err);
  }
});

// ─── Админка ──────────────────────────────────────
router.get('/admin', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await announcementsService.list();
    res.json({ success: true, data: items, count: items.length });
  } catch (err) {
    next(err);
  }
});

router.post('/', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await announcementsService.create({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/active', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await announcementsService.setActive(req.params.id, !!req.body?.isActive);
    if (!updated) {
      res.status(404).json({ success: false, message: 'Анонс не найден' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const removed = await announcementsService.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ success: false, message: 'Анонс не найден' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/broadcast', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await announcementsService.broadcast(req.params.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;
