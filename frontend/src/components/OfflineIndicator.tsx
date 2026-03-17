// ============================================
// MasterUz — OfflineIndicator Component
// Показывает баннер при отсутствии интернета
// ============================================

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from '../i18n';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
      setShowBack(false);
    }
    function handleOnline() {
      setIsOffline(false);
      setShowBack(true);
      setTimeout(() => setShowBack(false), 3000);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showBack) return null;

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 ${
        isOffline
          ? 'bg-red-500 text-white'
          : 'bg-green-500 text-white animate-fade-in'
      }`}
    >
      {isOffline ? (
        <>
          <WifiOff size={16} />
          {t('common.offline')}
        </>
      ) : (
        <>
          <Wifi size={16} />
          {t('common.online')}
        </>
      )}
    </div>
  );
}
