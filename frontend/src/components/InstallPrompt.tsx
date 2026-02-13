// ============================================
// MasterUz — PWA Install Prompt
// ============================================

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslation } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user already dismissed
    if (localStorage.getItem('pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
    localStorage.setItem('pwa-dismissed', '1');
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 animate-slide-up">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download size={20} className="text-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">
            {t('common.appName')}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Установите приложение для быстрого доступа
          </p>
          <button
            onClick={handleInstall}
            className="btn-primary text-xs px-4 py-1.5 w-full"
          >
            Установить
          </button>
        </div>
      </div>
    </div>
  );
}
