// ============================================
// MasterUz — Auth Controller
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authService } from './auth.service.js';
import { botAuthService } from './bot-auth.service.js';
import { telegramOidcService, isTelegramOidcEnabled } from './telegram-oidc.service.js';
import { config } from '../../config/index.js';
import { sendTelegramMessage, answerTelegramCallback, editTelegramMessage } from '../../utils/telegramBot.js';
import { logger } from '../../utils/logger.js';
import { setAuthCookies, clearAuthCookies } from '../../utils/authCookies.js';

/** Публичный адрес сайта — куда вести пользователя после входа через бота на компьютере. */
const SITE_PUBLIC_URL = (process.env.SITE_PUBLIC_URL || 'https://www.mestro.uz').replace(/\/$/, '');

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

  /**
   * GET /api/auth/open-app
   * Открывается по тапу на inline-кнопку в Telegram после успешной авторизации.
   * Делает редирект на deep-link приложения, чтобы пользователь автоматически
   * вернулся в MasterUz уже залогиненным (фронт поллит токены и подхватит их).
   */
  async openApp(req: Request, res: Response): Promise<void> {
    const scheme = process.env.MOBILE_DEEPLINK_SCHEME ?? 'uz.masteruz.app';
    const deepLink = `${scheme}://auth?ok=1`;
    res.set('Content-Type', 'text/html; charset=utf-8');

    // На компьютере мобильного приложения нет: deep-link никуда не ведёт и
    // пользователь видит «Возвращаемся…» навсегда. Вход на сайте уже выполнен
    // исходной вкладкой (она поллит токены) — говорим об этом прямо.
    const ua = String(req.headers['user-agent'] ?? '');
    if (!/Android|iPhone|iPad|iPod/i.test(ua)) {
      res.send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>MasterUz</title>
<style>
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b0f17;color:#f5f7fb;display:flex;align-items:center;justify-content:center}
  .card{max-width:420px;padding:32px 24px;text-align:center}
  h1{font-size:20px;margin:0 0 8px;font-weight:600}
  p{font-size:14px;color:#a3aec1;margin:0 0 12px;line-height:1.5}
  a.btn{display:inline-block;margin-top:12px;padding:14px 28px;background:#2563eb;color:#fff;border-radius:14px;text-decoration:none;font-weight:600;font-size:15px}
</style>
</head>
<body>
  <div class="card">
    <h1>✅ Вход выполнен</h1>
    <p>Вернитесь на вкладку MasterUz, где вы нажали «Войти через Telegram», — она войдёт автоматически. Эту вкладку можно закрыть.</p>
    <p>Kirish bajarildi. MasterUz sahifasiga qayting — u avtomatik kiradi.</p>
    <a class="btn" href="${SITE_PUBLIC_URL}/">Открыть MasterUz</a>
  </div>
</body>
</html>`);
      return;
    }

    res.send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>MasterUz</title>
<style>
  html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0b0f17;color:#f5f7fb;display:flex;align-items:center;justify-content:center}
  .card{max-width:360px;padding:32px 24px;text-align:center}
  h1{font-size:20px;margin:0 0 8px;font-weight:600}
  p{font-size:14px;color:#a3aec1;margin:0 0 24px;line-height:1.5}
  a.btn{display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;border-radius:14px;text-decoration:none;font-weight:600;font-size:15px}
</style>
</head>
<body>
  <div class="card">
    <h1>Возвращаемся в MasterUz…</h1>
    <p>Если приложение не открылось автоматически, нажмите кнопку ниже.</p>
    <a class="btn" href="${deepLink}">Открыть MasterUz</a>
  </div>
  <script>
    window.location.replace(${JSON.stringify(deepLink)});
    setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 400);
  </script>
</body>
</html>`);
  }

  /** GET /api/auth/telegram-oidc/config — включён ли официальный вход Telegram */
  async oidcConfig(_req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { enabled: isTelegramOidcEnabled() } });
  }

  /** POST /api/auth/telegram-native/start — вход в мобильном приложении через Telegram */
  async nativeStart(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: await telegramOidcService.startNative() });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/auth/telegram-native/finish { session, code } — код из ссылки-возврата → сессия */
  async nativeFinish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = String(req.body?.session ?? '');
      const code = String(req.body?.code ?? '');
      if (!session || !code) {
        res.status(400).json({ success: false, error: { message: 'session и code обязательны', statusCode: 400 } });
        return;
      }
      const claims = await telegramOidcService.finishNative(session, code);
      const result = await authService.loginWithTelegramOidc(claims);
      applyTokens(res, result);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/telegram-oidc/nonce — данные для JS-библиотеки Telegram:
   * Client ID и одноразовый nonce (страница входа берёт их заранее, чтобы
   * открыть окно Telegram сразу по клику — иначе браузер заблокирует popup).
   */
  async oidcNonce(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nonce = await telegramOidcService.createNonce();
      res.json({ success: true, data: { clientId: Number(telegramOidcService.clientId()), nonce } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/telegram-oidc/token { id_token }
   * Вход через JS-библиотеку Telegram: проверяем подписанный id_token и
   * выдаём сессию. Обмен кода с Client Secret здесь не нужен.
   */
  async oidcToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idToken = String(req.body?.id_token ?? '');
      if (!idToken) {
        res.status(400).json({ success: false, error: { message: 'id_token обязателен', statusCode: 400 } });
        return;
      }
      const claims = await telegramOidcService.verifyClientToken(idToken);
      const result = await authService.loginWithTelegramOidc(claims);
      applyTokens(res, result);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/telegram-oidc/start?returnTo=/orders
   * Редирект на oauth.telegram.org: пользователь подтверждает вход в Telegram.
   */
  async oidcStart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Возвращаем только на свой сайт: относительный путь без «//» (защита от open redirect)
      const raw = String(req.query.returnTo ?? '/');
      const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
      res.redirect(await telegramOidcService.buildAuthUrl(returnTo));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/telegram-oidc/callback?code&state
   * Telegram вернул пользователя: проверяем вход и отдаём сайту одноразовый
   * токен сессии (сайт забирает её через /telegram-bot/poll).
   */
  async oidcCallback(req: Request, res: Response): Promise<void> {
    const loginUrl = `${SITE_PUBLIC_URL}/login`;
    try {
      const code = String(req.query.code ?? '');
      const state = String(req.query.state ?? '');
      if (!code || !state) {
        // Пользователь отменил вход в окне Telegram
        res.redirect(`${loginUrl}?tg_error=cancelled`);
        return;
      }
      const { claims, returnTo } = await telegramOidcService.handleCallback(code, state);
      const result = await authService.loginWithTelegramOidc(claims);
      const session = await botAuthService.createReady(result);
      res.redirect(`${loginUrl}?tg_session=${encodeURIComponent(session)}&redirect=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      logger.warn({ err: (error as Error).message }, 'telegram-oidc: вход не выполнен');
      const reason = error instanceof Error && /заблокирован/i.test(error.message) ? 'blocked' : 'failed';
      res.redirect(`${loginUrl}?tg_error=${reason}`);
    }
  }

  /**
   * POST /api/auth/telegram-bot/start
   * Создаёт одноразовый токен. Фронт открывает t.me/<bot>?start=auth_<token>,
   * затем поллит /telegram-bot/poll до готовности.
   */
  async botAuthStart(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = await botAuthService.start();
      const botUsername = config.telegram.botUsername || 'Handymanuzbot';
      res.json({
        success: true,
        data: {
          token,
          // tg:// открывает Telegram-приложение напрямую. https://t.me/... —
          // фолбэк, если приложение не установлено (откроется веб-Telegram).
          deepLink: `tg://resolve?domain=${botUsername}&start=auth_${token}`,
          webLink: `https://t.me/${botUsername}?start=auth_${token}`,
          ttl: 300,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/telegram-bot/poll  { token }
   * 200 + { ready: true, tokens, user } если webhook уже принял Start;
   * 200 + { ready: false } если ещё ждём;
   * 410 если токен истёк/не существует.
   */
  async botAuthPoll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = String(req.body?.token ?? '');
      if (!token) {
        res.status(400).json({ success: false, error: { message: 'token обязателен' } });
        return;
      }
      const record = await botAuthService.poll(token);
      if (record.status === 'expired') {
        res.status(410).json({ success: false, error: { message: 'Сессия авторизации истекла' } });
        return;
      }
      if (record.status === 'ready' && record.tokens) {
        const result = {
          accessToken: record.tokens.accessToken,
          refreshToken: record.tokens.refreshToken,
          user: record.user,
          isNewUser: record.isNewUser ?? false,
        };
        applyTokens(res, result);
        res.json({ success: true, data: { ready: true, ...result } });
        return;
      }
      res.json({ success: true, data: { ready: false } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/telegram-bot/webhook
   * Принимает Update от Telegram. Защита — заголовок X-Telegram-Bot-Api-Secret-Token,
   * который мы передаём в setWebhook на старте сервера.
   */
  async botAuthWebhook(req: Request, res: Response): Promise<void> {
    // Всегда отвечаем 200 — Telegram иначе будет повторять.
    try {
      const expected = botWebhookSecret();
      const got = req.header('x-telegram-bot-api-secret-token');
      if (expected && got !== expected) {
        logger.warn({ got }, 'bot webhook: невалидный secret token');
        res.sendStatus(200);
        return;
      }

      // Нажатие кнопки «Подтвердить вход» / «Отмена»
      const cb = req.body?.callback_query as
        | {
            id: string;
            data?: string;
            from: { id: number; first_name: string; last_name?: string; username?: string };
            message?: { message_id: number; chat: { id: number } };
          }
        | undefined;
      if (cb) {
        await this.handleBotAuthCallback(cb);
        res.sendStatus(200);
        return;
      }

      const msg = (req.body?.message ?? req.body?.edited_message) as
        | {
            text?: string;
            from?: { id: number; first_name: string; last_name?: string; username?: string };
            chat?: { id: number };
          }
        | undefined;

      const text = msg?.text?.trim();
      const tgUser = msg?.from;
      const chatId = msg?.chat?.id;
      if (!text || !tgUser || !chatId) {
        res.sendStatus(200);
        return;
      }

      const match = text.match(/^\/start\s+auth_([A-Za-z0-9_-]{8,})/);
      if (!match) {
        res.sendStatus(200);
        return;
      }

      // Вход НЕ выполняется по одному Start: ссылку на вход мог прислать злоумышленник,
      // и тогда сессия жертвы досталась бы ему. Сначала — явное подтверждение с предупреждением.
      const token = match[1];
      if (await botAuthService.isPending(token)) {
        await sendTelegramMessage({
          chatId,
          text:
            '🔐 <b>Вход в MasterUz</b>\n\n' +
            'Подтвердите, только если <b>вы сами</b> только что нажали «Войти через Telegram» ' +
            'на сайте или в приложении MasterUz.\n\n' +
            '⚠️ Если эту ссылку вам прислал другой человек — нажмите «Отмена». ' +
            'Иначе он получит доступ к вашему аккаунту.',
          replyMarkup: {
            inline_keyboard: [[
              { text: '✅ Да, это я', callback_data: `auth_ok:${token}` },
              { text: '✖️ Отмена', callback_data: `auth_no:${token}` },
            ]],
          },
        });
      } else {
        await sendTelegramMessage({
          chatId,
          text: '⏱ Сессия авторизации истекла. Нажмите «Войти через Telegram» на сайте или в приложении ещё раз.',
        });
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error({ err: error }, 'bot webhook: ошибка обработки');
      res.sendStatus(200);
    }
  }

  /** Подтверждение или отмена входа через бота (inline-кнопки). */
  private async handleBotAuthCallback(cb: {
    id: string;
    data?: string;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
  }): Promise<void> {
    const m = cb.data?.match(/^auth_(ok|no):([A-Za-z0-9_-]{8,})$/);
    if (!m || !cb.message) {
      await answerTelegramCallback(cb.id);
      return;
    }
    const [, action, token] = m;
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;

    if (action === 'no') {
      await botAuthService.cancel(token);
      await answerTelegramCallback(cb.id, 'Вход отменён');
      await editTelegramMessage({
        chatId,
        messageId,
        text: '✖️ <b>Вход отменён.</b>\n\nНикто не получил доступ к вашему аккаунту.',
      });
      return;
    }

    const tokens = await botAuthService.complete(token, {
      id: cb.from.id,
      first_name: cb.from.first_name,
      last_name: cb.from.last_name,
      username: cb.from.username,
    });
    await answerTelegramCallback(cb.id, tokens ? 'Вход подтверждён' : 'Сессия истекла');
    if (!tokens) {
      await editTelegramMessage({
        chatId,
        messageId,
        text: '⏱ Сессия авторизации истекла. Нажмите «Войти через Telegram» ещё раз.',
      });
      return;
    }
    const publicUrl = (
      process.env.BACKEND_PUBLIC_URL ||
      'https://masteruz-backend-production.up.railway.app'
    ).replace(/\/$/, '');
    await editTelegramMessage({
      chatId,
      messageId,
      text:
        '✅ <b>Вы вошли в MasterUz!</b>\n\n' +
        'На компьютере — просто вернитесь на вкладку сайта, она уже вошла.\n' +
        'На телефоне — нажмите «Открыть приложение».',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '📱 Открыть приложение', url: `${publicUrl}/api/auth/open-app` }],
          [{ text: '🌐 Открыть сайт', url: `${SITE_PUBLIC_URL}/` }],
        ],
      },
    });
  }
}

/**
 * Стабильный секрет webhook — выводим из BOT_TOKEN.
 * Так не нужен лишний ENV: токен бота уже секретный, а sha256 от него
 * даёт уникальное непредсказуемое значение для заголовка Telegram.
 */
export function botWebhookSecret(): string {
  const t = config.telegram?.botToken ?? '';
  if (!t) return '';
  return crypto.createHash('sha256').update(t).digest('hex').slice(0, 32);
}

export const authController = new AuthController();
