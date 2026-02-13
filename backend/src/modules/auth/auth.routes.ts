// ============================================
// MasterUz — Auth Routes
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { telegramAuthSchema, telegramMiniAppAuthSchema, refreshTokenSchema } from './auth.schema.js';

const router = Router();

// Telegram Login Widget
router.post('/telegram', validateBody(telegramAuthSchema), (req, res, next) =>
  authController.loginTelegram(req, res, next)
);

// Telegram Mini App
router.post('/mini-app', validateBody(telegramMiniAppAuthSchema), (req, res, next) =>
  authController.loginMiniApp(req, res, next)
);

// Обновление токена
router.post('/refresh', validateBody(refreshTokenSchema), (req, res, next) =>
  authController.refresh(req, res, next)
);

// Текущий пользователь
router.get('/me', authenticate, (req, res, next) =>
  authController.me(req, res, next)
);

// Выход
router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req, res, next)
);

export default router;
