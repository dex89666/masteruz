// ============================================
// MasterUz — Глобальный диалог ввода текста
// Замена нативного window.prompt() (не работает в Telegram Desktop WebView).
// Рендерится один раз в App, управляется из confirmStore (usePromptStore).
// ============================================

import { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { usePromptStore } from '../store/confirmStore';

export function GlobalPromptDialog() {
  const options = usePromptStore((s) => s.options);
  const settle = usePromptStore((s) => s.settle);
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(options?.defaultValue ?? '');
  }, [options]);

  if (!options) return null;

  const submit = () => settle(value.trim() === '' ? null : value.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => settle(null)} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
        <button
          onClick={() => settle(null)}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
            <MessageSquare size={26} className="text-primary-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{options.title}</h3>
          {options.message && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{options.message}</p>
          )}

          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder={options.placeholder}
            className="w-full mb-5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="flex gap-3 w-full">
            <button
              onClick={() => settle(null)}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {options.cancelText ?? 'Отмена'}
            </button>
            <button
              onClick={submit}
              className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {options.confirmText ?? 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
