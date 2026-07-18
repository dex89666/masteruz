// ============================================
// MasterUz — Серверная локализация уведомлений
// ============================================
//
// Уведомления (in-app и Telegram) отправляются на языке получателя.
// Язык хранится в User.language и синхронизируется с выбором во фронтенде.
//
// Использование:
//   const tr = await translatorFor(userId);
//   tr('notify.orderApproved.title')
//   tr('notify.orderApproved.message', { title: order.title })
//
// Если ключа нет в словаре языка — берётся русский, затем сам ключ.
// Так пропущенный перевод виден, но ничего не ломается.

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import ru from './ru.js';
import uz from './uz.js';
import en from './en.js';

export type Lang = 'ru' | 'uz' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['ru', 'uz', 'en'];
export const DEFAULT_LANG: Lang = 'ru';

const DICTIONARIES: Record<Lang, Record<string, unknown>> = { ru, uz, en };

/** Приводит произвольное значение к поддерживаемому языку. */
export function normalizeLang(value: unknown): Lang {
  const raw = String(value ?? '').toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as string[]).includes(raw) ? (raw as Lang) : DEFAULT_LANG;
}

function lookup(dict: Record<string, unknown>, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

/** Подставляет значения в плейсхолдеры вида {name}. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Переводчик для конкретного языка (без обращения к БД). */
export function translator(lang: Lang): Translator {
  return (key, params) => {
    const raw = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES[DEFAULT_LANG], key) ?? key;
    return interpolate(raw, params);
  };
}

/**
 * Переводчик для пользователя — читает его язык из БД.
 * При любой ошибке возвращает русский, чтобы уведомление всё равно ушло.
 */
export async function translatorFor(userId: string): Promise<Translator> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return translator(normalizeLang(user?.language));
  } catch (err) {
    logger.warn({ err, userId }, 'i18n: не удалось определить язык пользователя, используем ru');
    return translator(DEFAULT_LANG);
  }
}

export { ru, uz, en };
