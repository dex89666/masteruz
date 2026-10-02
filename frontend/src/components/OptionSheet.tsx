// ============================================
// MasterUz — OptionSheet
// Выбор из длинного списка (город, район) в нижней шторке с поиском.
// Нативный <select> на Android/в WebView Telegram открывает диалог,
// который в ряде браузеров не прокручивается — до нижних пунктов не добраться.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface SheetOption {
  value: string;
  label: string;
  /** Подзаголовок группы (например, область) — список группируется по нему */
  group?: string;
}

interface OptionSheetProps {
  name: string;
  value: string;
  options: SheetOption[];
  onChange: (value: string) => void;
  placeholder: string;
  title: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

export function OptionSheet({
  name,
  value,
  options,
  onChange,
  placeholder,
  title,
  searchPlaceholder,
  emptyText,
}: OptionSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Пока шторка открыта, страница под ней не скроллится, Esc закрывает.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    // Сразу показываем выбранный пункт, а не начало списка.
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  let lastGroup: string | undefined;

  return (
    <>
      <button
        type="button"
        name={name}
        onClick={() => setOpen(true)}
        className="input flex items-center justify-between text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={18} className="shrink-0 text-gray-400" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              aria-label={title}
              className="relative w-full sm:max-w-md max-h-[85dvh] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label={t('common.close')}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-4 pb-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder ?? t('common.search')}
                    className="input pl-9"
                  />
                </div>
              </div>

              <div
                ref={listRef}
                role="listbox"
                className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+12px)]"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-8">{emptyText ?? t('common.nothingFound')}</p>
                )}
                {filtered.map((o) => {
                  const showGroup = o.group && o.group !== lastGroup;
                  lastGroup = o.group;
                  const isSelected = o.value === value;
                  return (
                    <div key={o.value}>
                      {showGroup && (
                        <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {o.group}
                        </p>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-selected={isSelected}
                        onClick={() => pick(o.value)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left min-h-[48px] ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span>{o.label}</span>
                        {isSelected && <Check size={18} className="shrink-0" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
