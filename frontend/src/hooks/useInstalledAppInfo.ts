// ============================================
// MasterUz — useAppVersion
// Хук, отдающий текущую установленную версию приложения.
// На native (Android/iOS) — через @capacitor/app.
// В web/Telegram — null (там обновления приходят автоматически с сервера).
// ============================================

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export interface InstalledAppInfo {
  versionCode: number; // Android build number
  versionName: string; // 1.0.42
  platform: 'android' | 'ios';
}

export function useInstalledAppInfo(): InstalledAppInfo | null {
  const [info, setInfo] = useState<InstalledAppInfo | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    App.getInfo()
      .then((data) => {
        if (cancelled) return;
        // На Android build = versionCode, на iOS = build number (строка).
        const versionCode = Number(data.build) || 1;
        setInfo({
          versionCode,
          versionName: data.version,
          platform: Capacitor.getPlatform() as 'android' | 'ios',
        });
      })
      .catch(() => {
        /* в web/Telegram плагин недоступен — это нормально */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}
