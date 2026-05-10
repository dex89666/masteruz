// ============================================
// MasterUz — Yandex Maps loader (singleton)
// Гарантирует, что скрипт API подгружается один раз и кешируется.
// ============================================

declare global {
  interface Window {
    ymaps: any;
  }
}

let loaderPromise: Promise<any> | null = null;

export function loadYandexMaps(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.ymaps && window.ymaps.Map) return Promise.resolve(window.ymaps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const rawKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '';
    const apiKey = rawKey === '__SET_ME__' ? '' : rawKey;
    const existing = document.querySelector<HTMLScriptElement>('script[data-ymaps-loader]');
    if (existing) {
      existing.addEventListener('load', () => window.ymaps.ready(() => resolve(window.ymaps)));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.dataset.ymapsLoader = '1';
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Не удалось загрузить Яндекс.Карты'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
