// ============================================
// MasterUz — Промо нативного приложения в Telegram Mini App
// ============================================
// Показывается ТОЛЬКО пользователям, открывшим бота в Telegram на Android:
// предлагает скачать полноценное приложение (APK).
//
// Разделение ответственности с соседними компонентами:
//   InstallPrompt   — PWA/APK-баннер в обычном браузере (в Telegram молчит);
//   UpdateChecker   — обновление уже установленного APK (только в native);
//   AppUpdatePrompt — обновление веб-бандла (перезагрузка страницы);
//   этот компонент  — установка приложения из Telegram Mini App.
//
// iOS-сборки пока нет, поэтому на iOS ничего не показываем.

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, Download, X, Bell, Zap, Camera } from 'lucide-react';
import { api } from '../api/client';
import { useTranslation } from '../i18n';

const GITHUB_REPO = 'dex89666/masteruz';
const APK_FALLBACK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/MasterUz-android.apk`;

const SNOOZE_KEY = 'app-promo-snoozed-until';
const DAY_MS = 24 * 60 * 60 * 1000;
// «Позже» — напомним через 3 дня. «Уже установлено» — практически не тревожим.
const SNOOZE_LATER_MS = 3 * DAY_MS;
const SNOOZE_INSTALLED_MS = 180 * DAY_MS;
// Небольшая пауза после запуска: не перекрываем загрузку приложения.
const SHOW_DELAY_MS = 3500;

interface VersionResponse {
  success: true;
  data: { android: { versionName: string; downloadUrl: string } | null };
}

function telegramWebApp(): any {
  return (window as any).Telegram?.WebApp;
}

/** Открыт ли UI внутри Telegram Mini App. */
function isTelegramMiniApp(): boolean {
  return Boolean(telegramWebApp()?.initData);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isSnoozed(): boolean {
  const raw = localStorage.getItem(SNOOZE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && Date.now() < until;
}

function snoozeFor(ms: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    /* приватный режим — просто не запомним, не критично */
  }
}

export function TelegramAppPromo() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState<{ versionName: string; downloadUrl: string } | null>(null);

  useEffect(() => {
    // Внутри установленного приложения промо бессмысленно.
    if (Capacitor.isNativePlatform()) return;
    if (!isTelegramMiniApp() || !isAndroid()) return;
    if (isSnoozed()) return;

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);

    // Версия и ссылка — с бэкенда (источник истины: GitHub Releases).
    // Если недоступно, покажем промо со статичной ссылкой на latest.
    let cancelled = false;
    api
      .get<VersionResponse>('/app/version')
      .then(({ data }) => {
        if (!cancelled && data.data.android) setVersion(data.data.android);
      })
      .catch(() => {
        /* сеть недоступна — обойдёмся fallback-ссылкой */
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  const downloadUrl = version?.downloadUrl || APK_FALLBACK_URL;

  const handleDownload = () => {
    // В Mini App window.open ненадёжен — Telegram даёт свой openLink,
    // который откроет ссылку во внешнем браузере.
    const tg = telegramWebApp();
    if (tg?.openLink) tg.openLink(downloadUrl);
    else window.open(downloadUrl, '_blank', 'noopener,noreferrer');

    // Скачивание началось — не показываем промо снова какое-то время.
    snoozeFor(SNOOZE_INSTALLED_MS);
    setVisible(false);
  };

  const handleLater = () => {
    snoozeFor(SNOOZE_LATER_MS);
    setVisible(false);
  };

  const handleAlreadyInstalled = () => {
    snoozeFor(SNOOZE_INSTALLED_MS);
    setVisible(false);
  };

  const benefits = [
    { Icon: Bell, text: t('appPromo.benefitPush') },
    { Icon: Zap, text: t('appPromo.benefitSpeed') },
    { Icon: Camera, text: t('appPromo.benefitOffline') },
  ];

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('appPromo.title')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {version
                  ? t('appPromo.subtitle', { version: version.versionName })
                  : t('appPromo.subtitleNoVersion')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLater}
            aria-label={t('appPromo.later')}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-5 space-y-3">
          {benefits.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">{t('appPromo.hintInstall')}</p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition active:scale-[0.98] hover:bg-blue-700"
          >
            <Download className="h-5 w-5" />
            {t('appPromo.download')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLater}
              className="flex-1 rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              {t('appPromo.later')}
            </button>
            <button
              type="button"
              onClick={handleAlreadyInstalled}
              className="flex-1 rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {t('appPromo.alreadyInstalled')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TelegramAppPromo;
