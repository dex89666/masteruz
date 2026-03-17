// ============================================
// MasterUz — Theme Toggle Component
// Переключатель тёмной темы
// ============================================

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../hooks';
import { useTranslation } from '../i18n';
import { useState, useRef, useEffect } from 'react';

export function ThemeToggle() {
  const { mode, setMode, isDark } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: t('common.themeLight') },
    { value: 'dark', icon: Moon, label: t('common.themeDark') },
    { value: 'system', icon: Monitor, label: t('common.themeSystem') },
  ];

  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={t('common.theme')}
        aria-label={t('common.theme')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CurrentIcon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 py-1 z-50 min-w-[140px] animate-scale-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setMode(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                mode === opt.value
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <opt.icon size={16} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
