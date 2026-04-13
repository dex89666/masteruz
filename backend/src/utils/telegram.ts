// ============================================
// MasterUz — Telegram Auth Verification
// Агент 3 (Бэкенд) + Агент 6 (Безопасность)
// ============================================

import crypto from 'crypto';
import { config } from '../config/index.js';

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramMiniAppInitData {
  query_id?: string;
  user?: {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

/**
 * Верификация данных Telegram Login Widget
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const { hash, ...checkData } = data;

  // Формируем строку для проверки
  const dataCheckString = Object.keys(checkData)
    .sort()
    .map((key) => `${key}=${checkData[key as keyof typeof checkData]}`)
    .join('\n');

  // Создаём секретный ключ из токена бота
  const secretKey = crypto
    .createHash('sha256')
    .update(config.telegram.botToken)
    .digest();

  // Проверяем хеш
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Проверка давности авторизации (не старше 24 часов)
  const authTimestamp = data.auth_date;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (currentTimestamp - authTimestamp > 86400) {
    return false;
  }

  return hmac === hash;
}

/**
 * Верификация данных Telegram Mini App
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramMiniApp(initData: string): TelegramMiniAppInitData | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;

    urlParams.delete('hash');

    // Сортируем параметры
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Создаём HMAC ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.telegram.botToken)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    // Проверка свежести auth_date (не старше 24 часов — защита от replay-атак)
    const authDate = parseInt(urlParams.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    // Парсим данные пользователя
    const userStr = urlParams.get('user');
    const user = userStr ? JSON.parse(userStr) : undefined;

    return {
      query_id: urlParams.get('query_id') || undefined,
      user,
      auth_date: parseInt(urlParams.get('auth_date') || '0', 10),
      hash,
    };
  } catch {
    return null;
  }
}
