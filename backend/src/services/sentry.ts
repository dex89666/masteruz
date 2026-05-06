// ============================================
// MasterUz — Sentry init (backend)
// Инициализация ДО импорта приложения. Если SENTRY_DSN не задан — no-op.
// ============================================

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.05,
    profilesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Удаляем чувствительные заголовки
      if (event.request?.headers) {
        delete (event.request.headers as any).authorization;
        delete (event.request.headers as any).cookie;
      }
      return event;
    },
  });
}

export { Sentry };
