// ============================================
// MasterUz — Analytics
// Тонкий слой: Yandex.Metrica + Sentry breadcrumbs.
// Если счётчик не задан (VITE_YM_COUNTER) — no-op, ничего не падает.
// ============================================

import { Sentry, sentryEnabled } from './sentry';

const counterId = Number(import.meta.env.VITE_YM_COUNTER || 0) || null;

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: any[]) => void;
  }
}

/**
 * Инициализирует счётчик Yandex.Metrica.
 * Скрипт догружается асинхронно — не блокирует первый рендер.
 */
export function initAnalytics() {
  if (!counterId) return;
  if (typeof window === 'undefined') return;
  if ((window as any).ym) return; // уже инициализирован

  // Снипет Метрики, инлайн (без копирования из админки)
  /* eslint-disable */
  (function (m: any, e: any, t: any, r: any, i: any) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = +new Date();
    const k = e.createElement(t);
    const a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window as any, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
  /* eslint-enable */

  (window as any).ym?.(counterId, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
    defer: true,
  });
}

/**
 * Универсальное отслеживание события воронки.
 * Шлёт в Yandex.Metrica и пишет breadcrumb в Sentry.
 */
export function track(event: AnalyticsEvent, params?: Record<string, unknown>) {
  if (counterId && typeof window !== 'undefined' && (window as any).ym) {
    (window as any).ym(counterId, 'reachGoal', event, params);
  }
  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      category: 'funnel',
      message: event,
      level: 'info',
      data: params,
    });
  }
}

export function trackPageView(url: string) {
  if (counterId && typeof window !== 'undefined' && (window as any).ym) {
    (window as any).ym(counterId, 'hit', url);
  }
}

// ─── Каталог событий воронки (доменно-значимые) ──────────────
export type AnalyticsEvent =
  | 'order_created'
  | 'order_viewed'
  | 'master_assigned'
  | 'master_response_sent'
  | 'payment_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'master_registration_started'
  | 'master_registration_paid'
  | 'consent_accepted'
  | 'login_completed'
  | 'complaint_submitted';
