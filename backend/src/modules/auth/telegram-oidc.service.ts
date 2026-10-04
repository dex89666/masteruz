// ============================================
// MasterUz — «Войти через Telegram» по OpenID Connect
// https://core.telegram.org/bots/telegram-login
//
// Пользователь подтверждает вход в окне Telegram, а официальный аккаунт
// Telegram (с галочкой) присылает ему уведомление о входе. Сайт получает
// подписанный id_token: id, имя, username, фото и — с согласия — телефон.
//
// Поток (authorization code + PKCE, всё на бэкенде):
//   1. GET /api/auth/telegram-oidc/start  → редирект на oauth.telegram.org/auth
//   2. Telegram → GET /api/auth/telegram-oidc/callback?code&state
//   3. Обмен code на id_token, проверка подписи по JWKS Telegram
//   4. Вход/регистрация → редирект на сайт с одноразовым токеном сессии
//
// Настройка: @BotFather → бот → Login Widget → разрешённые адреса и
// redirect URI; оттуда же Client ID и Client Secret (ENV ниже).
// ============================================

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getRedis } from '../../config/redis.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

const ISSUER = 'https://oauth.telegram.org';
const AUTH_URL = `${ISSUER}/auth`;
const TOKEN_URL = `${ISSUER}/token`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const STATE_TTL_SECONDS = 10 * 60;
const STATE_KEY = (state: string) => `tg-oidc:${state}`;
const NONCE_KEY = (nonce: string) => `tg-oidc-nonce:${nonce}`;
const NATIVE_KEY = (session: string) => `tg-native:${session}`;

/**
 * Адрес возврата в мобильное приложение (схема зарегистрирована в AndroidManifest).
 * Регистрируется в @BotFather → Login Widget → Native Login вместе с package name
 * и SHA-256 сертификата подписи APK.
 */
export const NATIVE_REDIRECT_URI = process.env.TELEGRAM_NATIVE_REDIRECT_URI || 'uz.masteruz.app://telegram-login';

export interface TelegramOidcClaims {
  id: number;
  name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
}

const clientId = () => process.env.TELEGRAM_OIDC_CLIENT_ID ?? '';
const clientSecret = () => process.env.TELEGRAM_OIDC_CLIENT_SECRET ?? '';
const backendPublicUrl = () =>
  (process.env.BACKEND_PUBLIC_URL || 'https://api.mestro.uz').replace(/\/$/, '');

/** redirect_uri — должен быть зарегистрирован в @BotFather */
export const oidcRedirectUri = () => `${backendPublicUrl()}/api/auth/telegram-oidc/callback`;

export function isTelegramOidcEnabled(): boolean {
  return !!clientId() && !!clientSecret();
}

const base64url = (buf: Buffer) => buf.toString('base64url');

// ─── JWKS с кэшем ──────────────────────────────
let jwksCache: { keys: (crypto.JsonWebKey & { kid?: string })[]; at: number } | null = null;

async function getJwks(force = false) {
  if (!force && jwksCache && Date.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS HTTP ${res.status}`);
  const body = (await res.json()) as { keys: (crypto.JsonWebKey & { kid?: string })[] };
  jwksCache = { keys: body.keys ?? [], at: Date.now() };
  return jwksCache.keys;
}

async function verifyIdToken(idToken: string, nonce: string): Promise<TelegramOidcClaims> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  let keys = await getJwks();
  let jwk = keys.find((k) => k.kid === kid) ?? (keys.length === 1 ? keys[0] : undefined);
  if (!jwk) {
    // Ключи могли смениться — перечитываем один раз
    keys = await getJwks(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('Неизвестный ключ подписи id_token');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const claims = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256', 'ES256'],
    issuer: ISSUER,
    audience: clientId(),
  }) as jwt.JwtPayload & TelegramOidcClaims & { nonce?: string };

  if (claims.nonce !== undefined && claims.nonce !== nonce) throw new Error('nonce не совпадает');
  if (!claims.id) throw new Error('В id_token нет id пользователя Telegram');
  return claims;
}

class TelegramOidcService {
  /**
   * Вход в мобильном приложении (как официальный Telegram Login SDK для Android):
   * PKCE без Client Secret, подтверждение в приложении Telegram, возврат кода
   * по ссылке uz.masteruz.app://telegram-login. Верификатор PKCE хранится на
   * сервере, обмен кода тоже делает сервер — приложение получает только сессию.
   */
  async startNative(): Promise<{ session: string; tgUrl: string | null; webUrl: string }> {
    if (!isTelegramOidcEnabled()) throw ApiError.badRequest('Вход через Telegram ещё не настроен');
    const session = base64url(crypto.randomBytes(24));
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    await getRedis().set(NATIVE_KEY(session), verifier, 'EX', STATE_TTL_SECONDS);

    const params = new URLSearchParams({
      client_id: clientId(),
      response_type: 'code',
      scope: 'openid profile phone',
      redirect_uri: NATIVE_REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    const webUrl = `${AUTH_URL}?${params.toString()}`;

    // Ссылка tg:// на подтверждение прямо в приложении Telegram (как в SDK);
    // если не получилось — приложение откроет webUrl в браузере.
    let tgUrl: string | null = null;
    try {
      const res = await fetch(`${ISSUER}/crossapp?${params.toString()}&android_sdk=1`, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { tg_url?: string };
        if (body.tg_url && /^tg:\/\//.test(body.tg_url)) tgUrl = body.tg_url;
      } else {
        logger.warn({ status: res.status }, 'telegram-native: crossapp не вернул ссылку');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'telegram-native: crossapp недоступен');
    }
    return { session, tgUrl, webUrl };
  }

  /** Завершение входа в приложении: обмен кода (без секрета) и проверка id_token. */
  async finishNative(session: string, code: string): Promise<TelegramOidcClaims> {
    const redis = getRedis();
    const verifier = await redis.get(NATIVE_KEY(session));
    await redis.del(NATIVE_KEY(session)); // сессия одноразовая
    if (!verifier) throw ApiError.badRequest('Сессия входа истекла, попробуйте ещё раз');

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId(),
        code,
        redirect_uri: NATIVE_REDIRECT_URI,
        code_verifier: verifier,
      }).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
    if (!res.ok || !body.id_token) {
      logger.warn({ status: res.status, error: body.error }, 'telegram-native: обмен кода не удался');
      throw ApiError.badRequest('Telegram не подтвердил вход, попробуйте ещё раз');
    }
    try {
      // nonce в этом потоке не передаётся — защита от повтора: одноразовый PKCE-верификатор
      return await verifyIdToken(body.id_token, '');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'telegram-native: id_token не прошёл проверку');
      throw ApiError.badRequest('Не удалось проверить подпись Telegram');
    }
  }

  /** Client ID для JS-библиотеки Telegram (публичное значение). */
  clientId(): string {
    return clientId();
  }

  /**
   * Одноразовый nonce для входа через JS-библиотеку Telegram: попадает в
   * id_token и не даёт повторно использовать перехваченный токен.
   */
  async createNonce(): Promise<string> {
    if (!isTelegramOidcEnabled()) throw ApiError.badRequest('Вход через Telegram ещё не настроен');
    const nonce = base64url(crypto.randomBytes(24));
    await getRedis().set(NONCE_KEY(nonce), '1', 'EX', STATE_TTL_SECONDS);
    return nonce;
  }

  /**
   * Вход через JS-библиотеку: id_token приходит из браузера без обмена кода.
   * Проверяем подпись по JWKS, iss, aud, срок и одноразовый nonce.
   */
  async verifyClientToken(idToken: string): Promise<TelegramOidcClaims> {
    const decoded = jwt.decode(idToken) as (jwt.JwtPayload & { nonce?: string }) | null;
    const nonce = decoded?.nonce;
    if (!nonce) throw ApiError.badRequest('Сессия входа истекла, попробуйте ещё раз');
    const redis = getRedis();
    // Удаляем сразу: nonce одноразовый, повторная отправка того же токена не пройдёт
    const existed = await redis.get(NONCE_KEY(nonce));
    await redis.del(NONCE_KEY(nonce));
    if (!existed) throw ApiError.badRequest('Сессия входа истекла, попробуйте ещё раз');
    try {
      return await verifyIdToken(idToken, nonce);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'telegram-oidc: id_token из браузера не прошёл проверку');
      throw ApiError.badRequest('Не удалось проверить подпись Telegram');
    }
  }

  /** Адрес, на который отправляем пользователя для входа. */
  async buildAuthUrl(returnTo: string): Promise<string> {
    if (!isTelegramOidcEnabled()) throw ApiError.badRequest('Вход через Telegram ещё не настроен');
    const state = base64url(crypto.randomBytes(24));
    const verifier = base64url(crypto.randomBytes(48));
    const nonce = base64url(crypto.randomBytes(16));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

    await getRedis().set(
      STATE_KEY(state),
      JSON.stringify({ verifier, nonce, returnTo }),
      'EX',
      STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: clientId(),
      redirect_uri: oidcRedirectUri(),
      response_type: 'code',
      scope: 'openid profile phone',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  /** Обработка возврата из Telegram: проверка state, обмен кода, проверка подписи. */
  async handleCallback(code: string, state: string): Promise<{ claims: TelegramOidcClaims; returnTo: string }> {
    const redis = getRedis();
    const raw = await redis.get(STATE_KEY(state));
    if (!raw) throw ApiError.badRequest('Сессия входа истекла, попробуйте ещё раз');
    // state одноразовый — повторное использование ссылки невозможно
    await redis.del(STATE_KEY(state));
    const { verifier, nonce, returnTo } = JSON.parse(raw) as { verifier: string; nonce: string; returnTo: string };

    const params = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: oidcRedirectUri(),
      client_id: clientId(),
      code_verifier: verifier,
    };
    type TokenResponse = { id_token?: string; error?: string; error_description?: string };
    const exchange = async (method: 'basic' | 'post') => {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(method === 'basic'
            ? { Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}` }
            : {}),
        },
        body: new URLSearchParams(method === 'post' ? { ...params, client_secret: clientSecret() } : params).toString(),
      });
      const body = (await res.json().catch(() => ({}))) as TokenResponse;
      return { ok: res.ok && !!body.id_token, status: res.status, body };
    };

    // Telegram поддерживает client_secret_basic и client_secret_post. Если Basic
    // отклонён как invalid_client, повторяем вторым способом. Код одноразовый,
    // но invalid_client отклоняется до его использования.
    let result = await exchange('basic');
    if (!result.ok && result.body.error === 'invalid_client') {
      result = await exchange('post');
      if (result.ok) logger.info('telegram-oidc: токен получен способом client_secret_post');
    }
    const body = result.body;
    if (!result.ok || !body.id_token) {
      logger.warn({ status: result.status, error: body.error, desc: body.error_description }, 'telegram-oidc: обмен кода не удался');
      throw ApiError.badRequest('Telegram не подтвердил вход, попробуйте ещё раз');
    }

    try {
      const claims = await verifyIdToken(body.id_token, nonce);
      return { claims, returnTo };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'telegram-oidc: id_token не прошёл проверку');
      throw ApiError.badRequest('Не удалось проверить подпись Telegram');
    }
  }
}

export const telegramOidcService = new TelegramOidcService();
