// ============================================
// MasterUz — AppUpdatePrompt
// Универсальное уведомление о новой версии. Работает во всех каналах:
// Telegram Mini App, PWA и нативный APK (через server.url).
//
// Как: в сборку зашит __BUILD_ID__; рядом с бандлом лежит /version.json
// с тем же id. Периодически (и при возврате на вкладку) сверяем зашитый id
// с серверным. Отличается → на сервере вышла новая версия → показываем баннер.
// «Обновить» = перезагрузка (подтянет свежий index с новыми ассетами).
//
// Если пользователь жмёт «Позже» — следующее напоминание приходит ЧАЩЕ
// (интервал сокращается с каждым отказом), пока он не обновится.
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // фоновая сверка версии — каждые 5 мин
const SNOOZE_STEPS_MS = [10, 6, 4, 3, 2].map((m) => m * 60 * 1000); // эскалация «Позже»

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string | null };
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

async function applyWaitingServiceWorker(): Promise<void> {
  // Best-effort: если PWA-воркер ждёт в waiting — активируем его перед reload,
  // чтобы офлайн-кэш тоже обновился. На native/Telegram просто no-op.
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    /* noop */
  }
}

export function AppUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [visible, setVisible] = useState(false);
  const snoozeIndexRef = useRef(0);
  const snoozeTimerRef = useRef<number | null>(null);

  // Сверка версии: если серверный buildId отличается от зашитого — есть апдейт.
  const check = useCallback(async () => {
    const serverId = await fetchServerBuildId();
    if (serverId && serverId !== __BUILD_ID__) {
      setUpdateAvailable(true);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  // Как только апдейт обнаружен — показываем баннер.
  useEffect(() => {
    if (updateAvailable) setVisible(true);
  }, [updateAvailable]);

  useEffect(() => () => {
    if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
  }, []);

  if (!updateAvailable || !visible) return null;

  const handleUpdate = async () => {
    await applyWaitingServiceWorker();
    window.location.reload();
  };

  const handleSnooze = () => {
    setVisible(false);
    // Эскалация: каждый отказ сокращает паузу до следующего напоминания.
    const idx = Math.min(snoozeIndexRef.current, SNOOZE_STEPS_MS.length - 1);
    const delay = SNOOZE_STEPS_MS[idx];
    snoozeIndexRef.current = idx + 1;
    if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = window.setTimeout(() => setVisible(true), delay);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] flex justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white shadow-2xl ring-1 ring-white/10 dark:bg-slate-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Доступно обновление</p>
          <p className="truncate text-xs text-slate-400">Нажмите, чтобы загрузить новую версию</p>
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
          onClick={handleSnooze}
          aria-label="Позже"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
