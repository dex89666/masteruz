// ============================================
// MasterUz — App Version Routes
// Публичный эндпоинт: возвращает последнюю версию APK для проверки апдейтов.
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { appVersionService } from './app-version.service.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

// GET /api/app/version — публично, дёргается мобильным приложением при старте.
router.get('/version', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = await appVersionService.getLatest();
    res.set('Cache-Control', 'public, max-age=300'); // 5 минут CDN-кэша
    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

// POST /api/app/version/refresh — админу, чтобы сбросить кэш после релиза.
router.post(
  '/version/refresh',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  (_req: Request, res: Response) => {
    appVersionService.invalidate();
    res.json({ success: true, message: 'Кэш версии сброшен' });
  },
);

export default router;
