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

  /**
   * GET /api/auth/telegram-callback
   * Telegram OAuth возвращает сюда query-параметрами после успешного логина
   * пользователя через oauth.telegram.org. Валидируем подпись и редиректим
   * на deep-link нативного приложения с токенами.
   *
   * URL-схема приложения: uz.masteruz.app://auth?access=<jwt>&refresh=<jwt>&new=0|1
   */
  async telegramCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as Record<string, string | undefined>;
      // Telegram передаёт id/auth_date как строки — приводим к числу.
      const payload = {
        id: Number(q.id),
        first_name: q.first_name ?? '',
        last_name: q.last_name,
        username: q.username,
        photo_url: q.photo_url,
        auth_date: Number(q.auth_date),
        hash: q.hash ?? '',
      };

      if (!payload.id || !payload.auth_date || !payload.hash || !payload.first_name) {
        res.status(400).send('Невалидный ответ Telegram OAuth');
        return;
      }

      const result = await authService.loginWithTelegram(payload as any);

      // Также проставим cookie (если пользователь решит остаться в браузере).
      applyTokens(res, result);

      const scheme = process.env.MOBILE_DEEPLINK_SCHEME ?? 'uz.masteruz.app';
      const deepLink =
        `${scheme}://auth` +
        `?access=${encodeURIComponent(result.accessToken)}` +
        `&refresh=${encodeURIComponent(result.refreshToken)}` +
        `&new=${result.isNewUser ? '1' : '0'}`;

      // HTML с auto-redirect на deep-link + видимая кнопка fallback,
      // потому что Chrome может заблокировать редирект на custom scheme
      // без явного жеста пользователя.
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>MasterUz — вход</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        background: #0f172a; color: #f1f5f9; padding: 24px; text-align: center; }
      h1 { margin: 0; font-size: 22px; font-weight: 600; }
      p { margin: 0; color: #94a3b8; max-width: 320px; line-height: 1.5; }
      a.btn { background: #f97316; color: #fff; padding: 14px 28px; border-radius: 14px;
        text-decoration: none; font-weight: 600; box-shadow: 0 12px 30px rgba(249,115,22,.3); }
    </style>
  </head>
  <body>
    <h1>Возвращаемся в приложение…</h1>
    <p>Если приложение не открылось автоматически — нажмите кнопку ниже.</p>
    <a class="btn" id="open" href="${deepLink}">Открыть MasterUz</a>
    <script>
      // Авто-попытка — большинство Android-браузеров справляются.
      setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 250);
    </script>
  </body>
</html>`);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
