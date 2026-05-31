// ============================================
// MasterUz — UpdateChecker
// Проверяет наличие новой версии APK и предлагает обновиться.
// Источник версии — /api/app/version (бэк читает из GitHub Releases).
// На web и в Telegram WebView ничего не показывает (обновления — автоматически).
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../api/client';
import { useInstalledAppInfo } from '../hooks/useInstalledAppInfo';

interface RemoteVersion {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  changelog: string;
  mandatory: boolean;
  publishedAt: string;
}

interface VersionResponse {
  success: true;
  data: { android: RemoteVersion | null; ios: RemoteVersion | null };
}

// Эскалация «Позже»: с каждым отказом напоминание приходит чаще.
const SNOOZE_STEPS_MS = [30, 15, 10, 5, 3].map((m) => m * 60 * 1000);
const RECHECK_INTERVAL_MS = 15 * 60 * 1000; // фоновая перепроверка версии

export function UpdateChecker() {
  const installed = useInstalledAppInfo();
  const [latest, setLatest] = useState<RemoteVersion | null>(null);
  const [visible, setVisible] = useState(false);
  const snoozeIndexRef = useRef(0);
  const snoozeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!installed) return;
    let cancelled = false;

    const checkVersion = () => {
      api
        .get<VersionResponse>('/app/version')
        .then(({ data }) => {
          if (cancelled) return;
          const remote = installed.platform === 'android' ? data.data.android : data.data.ios;
          if (!remote) return;
          setLatest(remote);
          // Показываем баннер, если на сервере версия новее установленной.
          if (remote.versionCode > installed.versionCode) setVisible(true);
        })
        .catch(() => {
          /* сеть могла отвалиться — это не повод тревожить пользователя */
        });
    };

    checkVersion();
    const interval = window.setInterval(checkVersion, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [installed]);

  useEffect(() => () => {
    if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
  }, []);

  if (!installed || !latest || !visible) return null;
  if (latest.versionCode <= installed.versionCode) return null;

  const handleUpdate = () => {
    // На native платформах _system заставляет Capacitor открыть ссылку
    // во внешнем браузере, чтобы пользователь смог скачать APK.
    window.open(latest.downloadUrl, '_system', 'noopener,noreferrer');
  };

  const handleDismiss = () => {
    if (latest.mandatory) return;
    setVisible(false);
    // Каждый отказ сокращает паузу до следующего напоминания.
    const idx = Math.min(snoozeIndexRef.current, SNOOZE_STEPS_MS.length - 1);
    const delay = SNOOZE_STEPS_MS[idx];
    snoozeIndexRef.current = idx + 1;
    if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = window.setTimeout(() => setVisible(true), delay);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Download className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Доступно обновление
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Версия {latest.versionName}
              </p>
            </div>
          </div>
          {!latest.mandatory && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Закрыть"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {latest.changelog && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <pre className="whitespace-pre-wrap font-sans">{latest.changelog}</pre>
          </div>
        )}

        {latest.mandatory && (
          <p className="mt-3 text-sm font-medium text-rose-600">
            Это обязательное обновление. Без него приложение работать не будет.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleUpdate}
            className="flex-1 rounded-2xl bg-emerald-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition active:scale-[0.98] hover:bg-emerald-600"
          >
            Обновить сейчас
          </button>
          {!latest.mandatory && (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-2xl bg-slate-100 px-5 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              Позже
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
