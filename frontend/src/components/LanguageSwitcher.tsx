// ============================================
// MasterUz — Переключатель языков
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation, LANGUAGES, type Language } from '../i18n';
import { usersApi } from '../api/client';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрыть при клике вне
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm dark:text-gray-300"
        aria-label="Switch language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe size={18} />
        <span className="hidden sm:inline">{LANGUAGES[language].flag} {language.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[140px]" role="listbox">
          {(Object.entries(LANGUAGES) as [Language, { label: string; flag: string }][]).map(
            ([code, { label, flag }]) => (
              <button
                key={code}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                  // Сохраняем язык на сервере, чтобы уведомления (in-app и Telegram)
                  // приходили на выбранном языке. Гость не авторизован — молча пропускаем.
                  usersApi.updateLanguage(code).catch(() => {});
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2 transition ${
                  code === language ? 'bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-700 dark:text-blue-400' : 'dark:text-gray-300'
                }`}
                role="option"
                aria-selected={code === language}
              >
                <span>{flag}</span>
                <span>{label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
