// ============================================
// MasterUz — PwaUpdatePrompt
// Уведомляет пользователей установленного web/PWA (и Telegram WebView),
// что вышла новая версия, и обновляет приложение по одному тапу.
// Native APK обновляется через UpdateChecker — здесь его пропускаем.
// ============================================

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // каждые 30 минут

export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    // Новый воркер считается готовым, только если уже есть активный controller —
    // иначе это первая установка, и обновлять нечего.
    const promote = (sw: ServiceWorker | null) => {
      if (sw && navigator.serviceWorker.controller) setWaiting(sw);
    };

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      promote(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') promote(reg.waiting);
        });
      });
    });

    // После активации нового воркера перезагружаем страницу один раз.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Периодически и при возврате на вкладку проверяем наличие новой версии.
    const checkForUpdate = () => registration?.update().catch(() => {});
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    const onVisible = () => document.visibilityState === 'visible' && checkForUpdate();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, []);

  if (!waiting || dismissed) return null;

  const handleUpdate = () => waiting.postMessage({ type: 'SKIP_WAITING' });

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] flex justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white shadow-2xl ring-1 ring-white/10 dark:bg-slate-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Доступно обновление</p>
          <p className="truncate text-xs text-slate-400">Перезапустите, чтобы применить новую версию</p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 hover:bg-emerald-600"
        >
          Обновить
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Закрыть"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
