// ============================================
// MasterUz — Auth Controller
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';

export class AuthController {
  /**
   * POST /api/auth/telegram
   * Авторизация через Telegram Login Widget
   */
  async loginTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginWithTelegram(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/mini-app
   * Авторизация через Telegram Mini App
   */
  async loginMiniApp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginWithMiniApp(req.body.initData);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Обновление JWT токена
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Получение текущего пользователя
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.user!.userId);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Выход
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.body.refreshToken);
      res.json({ success: true, message: 'Успешный выход' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
