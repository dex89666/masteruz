// ============================================
// MasterUz — AppVersionInfo
// Строка с версией приложения для меню и футера.
// На Android/iOS — версия и номер сборки из нативного пакета,
// в web/Telegram — версия бандла и дата сборки.
// ============================================

import { useInstalledAppInfo } from '../hooks/useInstalledAppInfo';
import { useTranslation } from '../i18n';

function formatBuildDate(buildId: string): string | null {
  const ts = Number(buildId);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function AppVersionInfo({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const native = useInstalledAppInfo();

  const text = native
    ? `${t('layout.appVersion')} ${native.versionName} (${t('layout.appBuild')} ${native.versionCode})`
    : [`${t('layout.appVersion')} ${__APP_VERSION__}`, formatBuildDate(__BUILD_ID__)].filter(Boolean).join(' · ');

  return <p className={className}>MasterUz · {text}</p>;
}
