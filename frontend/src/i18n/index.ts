// ============================================
// MasterUz — i18n: Контекст, провайдер, хук
// ============================================

import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import ru, { type TranslationKeys } from './ru';
import uz from './uz';
import en from './en';

// ─── Типы ─────────────────────────────────
export type Language = 'ru' | 'uz' | 'en';

export const LANGUAGES: Record<Language, { label: string; flag: string }> = {
  ru: { label: 'Русский', flag: '🇷🇺' },
  uz: { label: "O'zbek", flag: '🇺🇿' },
  en: { label: 'English', flag: '🇬🇧' },
};

const dictionaries: Record<Language, TranslationKeys> = { ru, uz: uz as unknown as TranslationKeys, en: en as unknown as TranslationKeys };

// ─── Хелпер: глубокий доступ по ключу ────
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TKey = NestedKeyOf<TranslationKeys>;

function getNestedValue(obj: unknown, path: string): string {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return path; // fallback — вернуть сам ключ
  }, obj) as string;
}

/**
 * Подставляет значения в плейсхолдеры вида {name}.
 * Плейсхолдер без переданного значения остаётся как есть — так пропущенный
 * параметр заметен в UI, а не превращается в пустоту.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in params ? String(params[key]) : match
  );
}

// ─── Контекст ─────────────────────────────
interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Перевод по ключу. Второй аргумент — значения для плейсхолдеров {name}. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Перевод с формой множественного числа: ищет `${key}_one|_few|_many|_other`
   * по правилам языка (Intl.PluralRules) и подставляет {n}.
   */
  tn: (key: string, n: number, params?: Record<string, string | number>) => string;
  /** locale для Intl/Date — 'ru-RU' | 'uz-UZ' | 'en-US' */
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Провайдер ────────────────────────────
const STORAGE_KEY = 'masteruz_lang';

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in dictionaries) return stored as Language;
  } catch { /* SSR / no localStorage */ }
  return 'ru';
}

const LOCALE_MAP: Record<Language, string> = {
  ru: 'ru-RU',
  uz: 'uz-UZ',
  en: 'en-US',
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* noop */ }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      interpolate(getNestedValue(dictionaries[language], key), params),
    [language],
  );

  const locale = LOCALE_MAP[language];

  const tn = useCallback(
    (key: string, n: number, params?: Record<string, string | number>) => {
      const rule = new Intl.PluralRules(locale).select(n);
      const dict = dictionaries[language];
      const exact = `${key}_${rule}`;
      const resolved = getNestedValue(dict, exact) !== exact ? exact : `${key}_other`;
      return interpolate(getNestedValue(dict, resolved), { n, ...params });
    },
    [language, locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t, tn, locale }),
    [language, setLanguage, t, tn, locale],
  );

  return React.createElement(I18nContext.Provider, { value }, children);
}

// ─── Хук ──────────────────────────────────
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within <I18nProvider>');
  return ctx;
}

// ─── Ре-экспорт типов ────────────────────
export type { TranslationKeys };

// ─── Локализованные поля из БД ───────────
// Категории, подкатегории, задачи и т.п. приходят с бэкенда как
// { name, nameUz, nameEn } — показываем вариант на языке пользователя,
// при отсутствии перевода — русский оригинал.
type LocalizedNamed = { name?: string | null; nameUz?: string | null; nameEn?: string | null };

export function pickLocalizedName(item: LocalizedNamed | null | undefined, language: Language): string {
  if (!item) return '';
  if (language === 'uz' && item.nameUz) return item.nameUz;
  if (language === 'en' && item.nameEn) return item.nameEn;
  return item.name ?? '';
}

/** Хук: `const ln = useLocalizedName(); ln(order.category)` */
export function useLocalizedName() {
  const { language } = useTranslation();
  return useCallback((item: LocalizedNamed | null | undefined) => pickLocalizedName(item, language), [language]);
}

/**
 * Перевод вне React-компонентов (lib/*, сервисные модули): язык берётся
 * из сохранённой настройки — той же, что выставляет setLanguage.
 */
export function translate(key: string, params?: Record<string, string | number>): string {
  return interpolate(getNestedValue(dictionaries[getInitialLanguage()], key), params);
}
