// ============================================
// MasterUz — Local Registry Routes
// Публичные эндпоинты для согласия + защищённые админ-ручки на просмотр.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { localRegistry } from './local-registry.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Текущая версия принятой редакции документов (оферта + политика).
// При изменении — Consent Gate сработает заново у всех пользователей.
export const DOCUMENTS_VERSION = '2026-05-07';

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ─── Согласие (публичное) ─────────────────────

router.get('/consent/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = getClientIp(req);
    const ua = (req.headers['user-agent'] || '').toString();
    const telegramId = typeof req.query.tg === 'string' ? req.query.tg.slice(0, 32) : undefined;
    const accepted = await localRegistry.hasConsent(ip, ua, DOCUMENTS_VERSION, telegramId);
    res.json({ success: true, data: { accepted, documentsVersion: DOCUMENTS_VERSION } });
  } catch (err) {
    next(err);
  }
});

router.post('/consent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { acceptedOffer, acceptedPrivacy, acceptedDataProcessing, telegramId } = req.body || {};
    const record = await localRegistry.recordConsent({
      acceptedOffer: !!acceptedOffer,
      acceptedPrivacy: !!acceptedPrivacy,
      acceptedDataProcessing: !!acceptedDataProcessing,
      documentsVersion: DOCUMENTS_VERSION,
      ip: getClientIp(req),
      userAgent: (req.headers['user-agent'] || '').toString(),
      telegramId: telegramId ? String(telegramId).slice(0, 32) : undefined,
    });
    res.json({ success: true, data: { id: record.id, acceptedAt: record.acceptedAt } });
  } catch (err) {
    next(err);
  }
});

// ─── Клиенты (запись из формы заказа / админка) ─

router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await localRegistry.createClient(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── Мастера ──────────────────────────────────

router.post('/masters', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await localRegistry.createMaster(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

// ─── Просмотр (только для авторизованных, в идеале — админ) ─

const adminOnly = [authenticate, authorize(UserRole.ADMIN, UserRole.MANAGER)];

router.get('/clients', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await localRegistry.listClients();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    next(err);
  }
});

router.get('/masters', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await localRegistry.listMasters();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    next(err);
  }
});

router.get('/consents', adminOnly, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await localRegistry.listConsents();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    next(err);
  }
});

export default router;
