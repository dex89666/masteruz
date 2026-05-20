// ============================================
// MasterUz — One-tap авторизация через Telegram-бота
// ============================================
//
// UX-цель: пользователь нажимает «Войти через Telegram», открывается чат с
// ботом @Handymanuzbot, нажимает Start — и через 1-2 секунды возвращается
// в приложение уже залогиненным. Без ввода телефона и SMS-кодов.
//
// Поток:
//   1. Фронт   → POST /api/auth/telegram-bot/start  → { token, deepLink }
//   2. Фронт открывает tg://resolve?domain=<bot>&start=auth_<token>
//   3. Юзер тапает Start → Telegram шлёт webhook → бот узнаёт `from.id`,
//      выписывает JWT и кладёт их в Redis по ключу token
//   4. Фронт каждые 1.5 сек дергает POST /api/auth/telegram-bot/poll
//      и при готовности забирает access/refresh.
//
// Хранилище — Redis: ключи `bot-auth:<token>` с TTL 5 мин.

import crypto from 'crypto';
import { getRedis } from '../../config/redis.js';
import { authService } from './auth.service.js';
import { logger } from '../../utils/logger.js';

const TTL_SECONDS = 5 * 60;
const KEY = (token: string) => `bot-auth:${token}`;

export interface BotAuthRecord {
  status: 'pending' | 'ready' | 'expired';
  tokens?: { accessToken: string; refreshToken: string };
  user?: unknown;
  isNewUser?: boolean;
}

class BotAuthService {
  /** Создаёт новый одноразовый токен авторизации. */
  async start(): Promise<{ token: string }> {
    const token = crypto.randomBytes(24).toString('base64url');
    const redis = getRedis();
    const record: BotAuthRecord = { status: 'pending' };
    await redis.set(KEY(token), JSON.stringify(record), 'EX', TTL_SECONDS);
    return { token };
  }

  /** Возвращает статус и (если готов) JWT-токены. */
  async poll(token: string): Promise<BotAuthRecord> {
    if (!token) return { status: 'expired' };
    const redis = getRedis();
    const raw = await redis.get(KEY(token));
    if (!raw) return { status: 'expired' };
    const record = JSON.parse(raw) as BotAuthRecord;
    // Если уже выдали токены — сразу удаляем (одноразовость).
    if (record.status === 'ready') {
      await redis.del(KEY(token));
    }
    return record;
  }

  /**
   * Вызывается webhook'ом бота при получении `/start auth_<token>`.
   * Логинит/регистрирует пользователя по telegramId и кладёт токены в Redis.
   */
  async complete(token: string, tgUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  }): Promise<{ accessToken: string; refreshToken: string } | null> {
    const redis = getRedis();
    const raw = await redis.get(KEY(token));
    if (!raw) {
      logger.warn({ token }, 'bot-auth: токен не найден или истёк');
      return null;
    }
    const result = await authService.loginWithTelegramByUserId(tgUser);
    const record: BotAuthRecord = {
      status: 'ready',
      tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken },
      user: result.user,
      isNewUser: result.isNewUser,
    };
    // Продлеваем TTL, чтобы фронт успел забрать.
    await redis.set(KEY(token), JSON.stringify(record), 'EX', TTL_SECONDS);
    return record.tokens!;
  }
}

export const botAuthService = new BotAuthService();
