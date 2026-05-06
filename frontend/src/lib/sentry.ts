// ============================================
// MasterUz — Sentry init (frontend)
// При отсутствии VITE_SENTRY_DSN — no-op.
// ============================================

import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    beforeSend(event) {
      // Не отправляем токены и куки
      if (event.request?.headers) {
        delete (event.request.headers as any).authorization;
        delete (event.request.headers as any).cookie;
      }
      return event;
    },
  });
}

export { Sentry };
