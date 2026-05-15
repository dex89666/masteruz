// ============================================
// MasterUz — PWA Install Prompt
// ============================================

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useTranslation } from '../i18n';
import { Link } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Определяем Android без Telegram Mini App
function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent) && !(window as any).Telegram?.WebApp?.initData;
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showApkBanner, setShowApkBanner] = useState(false);

  useEffect(() => {
    // В Telegram Mini App не показываем
    if ((window as any).Telegram?.WebApp?.initData) {
      setDismissed(true);
      return;
    }

    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    // Android-баннер для скачивания APK (появляется через 5 сек если нет PWA prompt)
    const apkTimer = isAndroidBrowser()
      ? setTimeout(() => setShowApkBanner(true), 5000)
      : undefined;

    function handler(e: Event) {
      e.preventDefault();
      clearTimeout(apkTimer);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(apkTimer);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowApkBanner(false);
    localStorage.setItem('pwa-dismissed', '1');
  }

  // PWA install prompt (Chrome Android)
  if (deferredPrompt && !dismissed) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 animate-slide-up">
        <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={20} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900 mb-1">{t('common.appName')}</h3>
            <p className="text-xs text-gray-500 mb-3">Установите приложение для быстрого доступа</p>
            <button onClick={handleInstall} className="btn-primary text-xs px-4 py-1.5 w-full">
              Установить
            </button>
          </div>
        </div>
      </div>
    );
  }

  // APK-баннер для Android (когда нет PWA prompt — браузер не поддерживает или уже установлено)
  if (showApkBanner && !dismissed) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-4 animate-slide-up">
        <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-slate-300">
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone size={20} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-white mb-1">Скачайте APK</h3>
            <p className="text-xs text-slate-400 mb-3">
              Установите нативное приложение MasterUz
            </p>
            <Link
              to="/download"
              onClick={handleDismiss}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 
                         text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Download size={14} />
              Скачать приложение
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
