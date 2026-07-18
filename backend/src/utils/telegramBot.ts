// ============================================
// MasterUz — Telegram Bot Service
// Push-уведомления мастерам через Telegram Bot API
// ============================================

import { config } from '../config/index.js';
import { translator, DEFAULT_LANG, type Lang } from '../i18n/index.js';
import { logger } from './logger.js';
import { acquireTelegramSlot } from '../services/telegramRateLimiter.js';

// Node.js 18+ global fetch — обход strict типизации
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _fetch = (globalThis as any).fetch as (
  input: string,
  init?: Record<string, unknown>
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

// Ленивая сборка URL — config.telegram может быть не определён в момент загрузки модуля
// (например, в unit-тестах, где config мокается частично).
const botApi = () => `https://api.telegram.org/bot${config.telegram?.botToken ?? ''}`;

interface SendMessageOptions {
  chatId: number | string | bigint;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: any;
}

interface SendLocationOptions {
  chatId: number | string;
  latitude: number;
  longitude: number;
}

export interface TelegramSendResult {
  ok: boolean;
  errorCode?: number;
  description?: string;
}

/**
 * Отправка текстового сообщения в Telegram.
 * Возвращает структурированный результат — чтобы вызывающая сторона могла
 * различать «бот заблокирован пользователем» (403) и сетевые ошибки.
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<TelegramSendResult> {
  try {
    if (!config.telegram.botToken) {
      logger.warn('Telegram Bot Token не настроен, сообщение не отправлено');
      return { ok: false, description: 'bot_token_missing' };
    }

    // Глобальный rate-limit на исходящие (30 msg/sec ограничение Telegram).
    const slot = await acquireTelegramSlot();
    if (!slot) return { ok: false, description: 'rate_limit_local' };

    const body: any = {
      chat_id: options.chatId,
      text: options.text,
      parse_mode: options.parseMode || 'HTML',
    };

    if (options.replyMarkup) {
      body.reply_markup = JSON.stringify(options.replyMarkup);
    }

    const response = await _fetch(`${botApi()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as { ok: boolean; description?: string; error_code?: number };

    if (!result.ok) {
      logger.error(
        { errorCode: result.error_code, description: result.description, chatId: String(options.chatId) },
        'Telegram API отклонил сообщение',
      );
      return { ok: false, errorCode: result.error_code, description: result.description };
    }

    logger.debug({ chatId: String(options.chatId) }, 'Telegram сообщение отправлено');
    return { ok: true };
  } catch (error) {
    logger.error({ error, chatId: String(options.chatId) }, 'Ошибка отправки Telegram сообщения');
    return { ok: false, description: error instanceof Error ? error.message : 'unknown' };
  }
}

/**
 * Отправка геолокации в Telegram
 */
export async function sendTelegramLocation(options: SendLocationOptions): Promise<boolean> {
  try {
    if (!config.telegram.botToken) return false;

    const response = await _fetch(`${botApi()}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        latitude: options.latitude,
        longitude: options.longitude,
      }),
    });

    const result = await response.json() as any;
    return result.ok === true;
  } catch (error) {
    logger.error({ error }, 'Ошибка отправки геолокации в Telegram');
    return false;
  }
}

/**
 * Уведомление мастеру: заказ одобрен, комиссия оплачена
 * Отправляет данные клиента (телефон, геолокацию, адрес)
 */
export async function notifyMasterOrderApproved(params: {
  masterTelegramId: number | bigint;
  orderTitle: string;
  orderId: string;
  clientName: string;
  clientPhone: string | null;
  address: string | null;
  street: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number;
  isUrgent: boolean;
  tasks: string[];
  lang?: Lang;
}): Promise<void> {
  const chatId = String(params.masterTelegramId);
  const tr = translator(params.lang ?? DEFAULT_LANG);

  // Формируем полный адрес
  const addressParts = [
    params.region,
    params.city,
    params.district,
    params.street,
    params.address,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ') || tr('notify.tg.notSpecified');

  const taskList = params.tasks.length > 0
    ? params.tasks.map((t) => `  • ${t}`).join('\n')
    : tr('notify.tg.tasksNotSpecified');

  const message = tr('notify.tg.orderApproved', {
    urgent: params.isUrgent ? tr('notify.tg.urgentBadge') : '',
    title: params.orderTitle,
    price: params.price.toLocaleString('ru'),
    currency: tr('common.currency'),
    surcharge: params.isUrgent ? tr('notify.tg.urgentSurcharge') : '',
    tasks: taskList,
    address: fullAddress,
    phone: params.clientPhone || tr('notify.tg.notSpecified'),
    clientName: params.clientName,
  }).trim();

  const miniAppUrl = config.telegram.miniAppUrl || 'https://masteruz.uz';
  const orderUrl = `${miniAppUrl}/orders/${params.orderId}`;
  const replyMarkup = {
    inline_keyboard: [
      [{ text: tr('notify.tg.openOrder'), web_app: { url: orderUrl } }],
    ],
  };

  await sendTelegramMessage({ chatId, text: message, replyMarkup });

  // Отправляем геолокацию отдельным сообщением, если есть координаты
  if (params.latitude && params.longitude) {
    await sendTelegramLocation({
      chatId,
      latitude: params.latitude,
      longitude: params.longitude,
    });
  }
}

/**
 * Уведомление мастеру: новый заказ в его городе/районе
 */
export async function notifyMasterNewOrder(params: {
  masterTelegramId: number | bigint;
  orderTitle: string;
  orderId: string;
  city: string | null;
  district: string | null;
  region: string | null;
  price: number;
  isUrgent: boolean;
  categoryName: string;
  distance?: number | null;
  lang?: Lang;
}): Promise<TelegramSendResult> {
  const chatId = String(params.masterTelegramId);
  const tr = translator(params.lang ?? DEFAULT_LANG);

  const locationParts = [params.city, params.district].filter(Boolean);
  const locationLabel = locationParts.join(', ') || tr('notify.tg.notSpecified');
  const distanceLabel =
    params.distance != null ? tr('notify.tg.newOrderDistance', { km: params.distance }) : '';

  // Deep link: opens the order directly inside Telegram Mini App
  const miniAppUrl = config.telegram.miniAppUrl || 'https://masteruz.uz';
  const botUsername = config.telegram.botUsername;
  const orderUrl = `${miniAppUrl}/orders/${params.orderId}`;

  const message = tr('notify.tg.newOrder', {
    urgent: params.isUrgent ? tr('notify.tg.urgentPrefix') : '',
    title: params.orderTitle,
    category: params.categoryName,
    price: params.price.toLocaleString('ru'),
    currency: tr('common.currency'),
    location: locationLabel,
    distance: distanceLabel,
  }).trim();

  // Inline-кнопки: «Подтвердить заявку» (открывает заказ в Mini App) + «Посмотреть заказ»
  const respondUrl = `${miniAppUrl}/orders/${params.orderId}?action=respond`;
  const confirmText = tr('notify.tg.confirmRequest');
  const viewText = tr('notify.tg.viewOrder');
  const replyMarkup = botUsername
    ? {
        inline_keyboard: [
          [{ text: confirmText, web_app: { url: respondUrl } }],
          [{ text: viewText, web_app: { url: orderUrl } }],
        ],
      }
    : {
        inline_keyboard: [
          [{ text: confirmText, url: respondUrl }],
          [{ text: viewText, url: orderUrl }],
        ],
      };

  return sendTelegramMessage({ chatId, text: message, replyMarkup });
}

/**
 * Уведомление мастеру: его отклик выбран
 */
export async function notifyMasterResponseAccepted(params: {
  masterTelegramId: number | bigint;
  orderTitle: string;
  orderId: string;
  price: number;
  lang?: Lang;
}): Promise<void> {
  const chatId = String(params.masterTelegramId);
  const tr = translator(params.lang ?? DEFAULT_LANG);

  const message = tr('notify.tg.responseAccepted', {
    title: params.orderTitle,
    price: params.price.toLocaleString('ru'),
    currency: tr('common.currency'),
  }).trim();

  const miniAppUrl = config.telegram.miniAppUrl || 'https://masteruz.uz';
  const orderUrl = `${miniAppUrl}/orders/${params.orderId}`;
  const replyMarkup = {
    inline_keyboard: [
      [{ text: tr('notify.tg.openOrder'), web_app: { url: orderUrl } }],
    ],
  };

  await sendTelegramMessage({ chatId, text: message, replyMarkup });
}
