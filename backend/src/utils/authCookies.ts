// ============================================
// MasterUz — Auth Cookie Helper
// httpOnly cookies для JWT (двойной режим: cookie + JSON в ответе).
// Используется веб-клиентом для защиты от XSS-кражи токена из localStorage.
// Telegram Mini App продолжает работать через JSON + Authorization-заголовок.
// ============================================

import { Response } from 'express';
import { config } from '../config/index.js';

const ACCESS_COOKIE = 'mu_at';
const REFRESH_COOKIE = 'mu_rt';

const isProd = config.env === 'production';

// 7 дней / 30 дней — синхронно с JWT_EXPIRES_IN из config
const ACCESS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
  } as const;

  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_MAX_AGE_MS });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/api/auth', // refresh-cookie виден только эндпоинтам авторизации
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
