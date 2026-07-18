// ============================================
// MasterUz — Серверная локализация уведомлений
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../../src/config/database.js';
import { translator, translatorFor, normalizeLang, DEFAULT_LANG } from '../../src/i18n/index.js';
import ru from '../../src/i18n/ru.js';
import uz from '../../src/i18n/uz.js';
import en from '../../src/i18n/en.js';

const db = prisma as any;

beforeEach(() => vi.clearAllMocks());

describe('normalizeLang', () => {
  it('принимает поддерживаемые языки', () => {
    expect(normalizeLang('ru')).toBe('ru');
    expect(normalizeLang('uz')).toBe('uz');
    expect(normalizeLang('en')).toBe('en');
  });

  it('нормализует регистр и локали вида ru-RU', () => {
    expect(normalizeLang('RU')).toBe('ru');
    expect(normalizeLang('uz-UZ')).toBe('uz');
    expect(normalizeLang('en-US')).toBe('en');
  });

  it('неизвестное/пустое значение → русский', () => {
    expect(normalizeLang('fr')).toBe(DEFAULT_LANG);
    expect(normalizeLang(null)).toBe(DEFAULT_LANG);
    expect(normalizeLang(undefined)).toBe(DEFAULT_LANG);
    expect(normalizeLang(123)).toBe(DEFAULT_LANG);
  });
});

describe('translator', () => {
  it('возвращает текст на нужном языке', () => {
    expect(translator('ru')('notify.orderApproved.title')).toContain('одобрен');
    expect(translator('uz')('notify.orderApproved.title')).toContain('tasdiqlandi');
    expect(translator('en')('notify.orderApproved.title')).toContain('approved');
  });

  it('подставляет параметры', () => {
    const text = translator('ru')('notify.orderApproved.message', { title: 'Ремонт крана' });
    expect(text).toContain('Ремонт крана');
    expect(text).not.toContain('{title}');
  });

  it('валюта локализована', () => {
    expect(translator('ru')('common.currency')).toBe('сум');
    expect(translator('uz')('common.currency')).toBe('so‘m');
    expect(translator('en')('common.currency')).toBe('UZS');
  });

  it('неизвестный ключ возвращается как есть, без падения', () => {
    expect(translator('ru')('notify.nope.missing')).toBe('notify.nope.missing');
  });

  it('пропущенный параметр оставляет плейсхолдер видимым', () => {
    const text = translator('ru')('notify.orderApproved.message', {});
    expect(text).toContain('{title}');
  });
});

describe('translatorFor', () => {
  it('берёт язык из профиля пользователя', async () => {
    db.user.findUnique.mockResolvedValueOnce({ language: 'en' });
    const tr = await translatorFor('user-1');
    expect(tr('notify.orderApproved.title')).toContain('approved');
  });

  it('пользователь без языка → русский', async () => {
    db.user.findUnique.mockResolvedValueOnce({ language: null });
    const tr = await translatorFor('user-1');
    expect(tr('common.currency')).toBe('сум');
  });

  it('ошибка БД не ломает отправку — фолбэк на русский', async () => {
    db.user.findUnique.mockImplementation(() => { throw new Error('DB down'); });
    const tr = await translatorFor('user-1');
    expect(tr('common.currency')).toBe('сум');
    db.user.findUnique.mockImplementation(undefined as any);
  });
});

describe('полнота словарей', () => {
  // Собирает все листовые ключи словаря в плоский список
  function keysOf(obj: any, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null
        ? keysOf(v, `${prefix}${k}.`)
        : [`${prefix}${k}`]
    );
  }

  const ruKeys = keysOf(ru).sort();

  it('uz покрывает все ключи ru', () => {
    expect(keysOf(uz).sort()).toEqual(ruKeys);
  });

  it('en покрывает все ключи ru', () => {
    expect(keysOf(en).sort()).toEqual(ruKeys);
  });

  it('плейсхолдеры совпадают во всех языках', () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of ruKeys) {
      const get = (d: any) => key.split('.').reduce((a: any, k) => a?.[k], d) as string;
      expect(placeholders(get(uz)), `uz: ${key}`).toEqual(placeholders(get(ru)));
      expect(placeholders(get(en)), `en: ${key}`).toEqual(placeholders(get(ru)));
    }
  });
});
