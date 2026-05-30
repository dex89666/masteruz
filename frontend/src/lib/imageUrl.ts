// ============================================
// MasterUz — Resolver URL изображений
// Бэкенд возвращает либо абсолютный URL (S3/CDN),
// либо относительный путь /uploads/... (локальное хранилище).
// На Railway фронт не проксирует /uploads — нужна явная сборка URL.
// ============================================

/**
 * Возвращает корень бэкенда (без /api) для относительных путей.
 * Зеркалит логику resolveApiUrl из api/client.ts, но без /api в конце.
 */
function resolveBackendOrigin(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && envUrl !== '/api') {
    return envUrl.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('masteruz-frontend-production.up.railway.app')) {
      return 'https://masteruz-backend-production.up.railway.app';
    }
  }
  return '';
}

const BACKEND_ORIGIN = resolveBackendOrigin();

/**
 * Принимает любую строку (URL/путь/мусор) — возвращает валидный URL картинки
 * или `null`, если строка не годится для рендера.
 *
 * Поддерживает:
 *  - https?://...     → как есть
 *  - data:image/...   → как есть
 *  - /uploads/...     → префикс бэкенда
 *  - blob:...         → как есть (локальные превью до отправки)
 */
export function resolveImageUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const url = input.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return null;
}
