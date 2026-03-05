// ============================================
// MasterUz — Telegram Bot Service
// Push-уведомления мастерам через Telegram Bot API
// ============================================

import { config } from '../config/index.js';
import { logger } from './logger.js';

// Node.js 18+ global fetch — обход strict типизации
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _fetch = (globalThis as any).fetch as (
  input: string,
  init?: Record<string, unknown>
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const BOT_API = `https://api.telegram.org/bot${config.telegram.botToken}`;

interface SendMessageOptions {
  chatId: number | string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  replyMarkup?: any;
}

interface SendLocationOptions {
  chatId: number | string;
  latitude: number;
  longitude: number;
}

/**
 * Отправка текстового сообщения в Telegram
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
  try {
    if (!config.telegram.botToken) {
      logger.warn('Telegram Bot Token не настроен, сообщение не отправлено');
      return false;
    }

    const body: any = {
      chat_id: options.chatId,
      text: options.text,
      parse_mode: options.parseMode || 'HTML',
    };

    if (options.replyMarkup) {
      body.reply_markup = JSON.stringify(options.replyMarkup);
    }

    const response = await _fetch(`${BOT_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json() as any;

    if (!result.ok) {
      logger.error({ error: result.description, chatId: options.chatId }, 'Ошибка отправки Telegram сообщения');
      return false;
    }

    logger.info({ chatId: options.chatId }, 'Telegram сообщение отправлено');
    return true;
  } catch (error) {
    logger.error({ error, chatId: options.chatId }, 'Ошибка отправки Telegram сообщения');
    return false;
  }
}

/**
 * Отправка геолокации в Telegram
 */
export async function sendTelegramLocation(options: SendLocationOptions): Promise<boolean> {
  try {
    if (!config.telegram.botToken) return false;

    const response = await _fetch(`${BOT_API}/sendLocation`, {
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
}): Promise<void> {
  const chatId = Number(params.masterTelegramId);

  // Формируем полный адрес
  const addressParts = [
    params.region,
    params.city,
    params.district,
    params.street,
    params.address,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ') || 'Не указан';

  const urgentLabel = params.isUrgent ? '🚨 СРОЧНЫЙ ЗАКАЗ' : '';
  const taskList = params.tasks.length > 0
    ? params.tasks.map((t) => `  • ${t}`).join('\n')
    : '  Не указаны';

  const message = `
✅ <b>Заказ одобрен! Можете приступать</b>
${urgentLabel}

📋 <b>${params.orderTitle}</b>

💰 <b>Стоимость:</b> ${params.price.toLocaleString('ru')} сум
${params.isUrgent ? '⚡ <i>Включена надбавка за срочность (+40%)</i>' : ''}

🔧 <b>Что нужно сделать:</b>
${taskList}

📍 <b>Адрес:</b> ${fullAddress}

📞 <b>Телефон клиента:</b> ${params.clientPhone || 'Не указан'}
👤 <b>Клиент:</b> ${params.clientName}

🔗 <a href="${config.telegram.miniAppUrl || 'https://masteruz.uz'}/orders/${params.orderId}">Открыть заказ</a>
`.trim();

  await sendTelegramMessage({ chatId, text: message });

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
}): Promise<void> {
  const chatId = Number(params.masterTelegramId);

  const locationParts = [params.city, params.district].filter(Boolean);
  const locationLabel = locationParts.join(', ') || 'Не указан';
  const urgentLabel = params.isUrgent ? '🚨 СРОЧНЫЙ ' : '';
  const distanceLabel = params.distance != null ? `\n📏 <b>Расстояние:</b> ${params.distance} км от вас` : '';

  // Deep link: opens the order directly inside Telegram Mini App
  const miniAppUrl = config.telegram.miniAppUrl || 'https://masteruz-ecru.vercel.app';
  const botUsername = config.telegram.botUsername;
  const webAppLink = botUsername
    ? `https://t.me/${botUsername}/app?startapp=order_${params.orderId}`
    : `${miniAppUrl}/orders/${params.orderId}`;

  const message = `
🆕 <b>${urgentLabel}Новый заказ в вашем районе!</b>

📋 <b>${params.orderTitle}</b>
🏷 <b>Категория:</b> ${params.categoryName}
💰 <b>Бюджет:</b> ${params.price.toLocaleString('ru')} сум
📍 <b>Местоположение:</b> ${locationLabel}${distanceLabel}

👉 Нажмите кнопку ниже, чтобы посмотреть заказ и откликнуться
`.trim();

  const replyMarkup = botUsername ? {
    inline_keyboard: [
      [{ text: '📋 Посмотреть заказ', web_app: { url: `${miniAppUrl}/orders/${params.orderId}` } }],
      [{ text: '✅ Откликнуться', web_app: { url: `${miniAppUrl}/orders/${params.orderId}` } }],
    ]
  } : undefined;

  await sendTelegramMessage({ chatId, text: message, replyMarkup });
}

/**
 * Уведомление мастеру: его отклик выбран
 */
export async function notifyMasterResponseAccepted(params: {
  masterTelegramId: number | bigint;
  orderTitle: string;
  orderId: string;
  price: number;
}): Promise<void> {
  const chatId = Number(params.masterTelegramId);

  const message = `
🎉 <b>Ваш отклик выбран!</b>

📋 <b>${params.orderTitle}</b>
💰 <b>Стоимость:</b> ${params.price.toLocaleString('ru')} сум

Оплатите комиссию платформы, чтобы получить контакты клиента и приступить к работе.

🔗 <a href="${config.telegram.miniAppUrl || 'https://masteruz.uz'}/orders/${params.orderId}">Открыть заказ</a>
`.trim();

  await sendTelegramMessage({ chatId, text: message });
}
