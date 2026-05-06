// ============================================
// MasterUz — Auth Controller
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { setAuthCookies, clearAuthCookies } from '../../utils/authCookies.js';

function applyTokens(res: Response, result: any) {
  const access = result?.accessToken || result?.tokens?.accessToken;
  const refresh = result?.refreshToken || result?.tokens?.refreshToken;
  if (access && refresh) setAuthCookies(res, access, refresh);
}

export class AuthController {
  /**
   * POST /api/auth/telegram — Telegram Login Widget
   */
  async loginTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginWithTelegram(req.body);
      applyTokens(res, result);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/mini-app — Telegram Mini App
   */
  async loginMiniApp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.loginWithMiniApp(req.body.initData);
      applyTokens(res, result);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh — принимает refresh из тела ИЛИ из cookie mu_rt
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieRefresh = (req as any).cookies?.mu_rt as string | undefined;
      const refreshToken = req.body?.refreshToken || cookieRefresh;
      if (!refreshToken) {
        res.status(400).json({ success: false, message: 'refreshToken не предоставлен' });
        return;
      }
      const result = await authService.refreshToken(refreshToken);
      applyTokens(res, result);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
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
   * POST /api/auth/logout — чистим и cookie, и refresh из тела (если есть)
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookieRefresh = (req as any).cookies?.mu_rt as string | undefined;
      const token = req.body?.refreshToken || cookieRefresh;
      if (token) await authService.logout(token);
      clearAuthCookies(res);
      res.json({ success: true, message: 'Успешный выход' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
