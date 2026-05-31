// ============================================
// MasterUz — main.tsx (Entry Point)
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/sentry'; // должен быть до импорта App
import { initAnalytics } from './lib/analytics';
import App from './App';
import './index.css';

initAnalytics();

// Telegram Mini App initialization
const tgWebApp = (window as any).Telegram?.WebApp;
if (tgWebApp) {
  // Tell Telegram the app is ready
  tgWebApp.ready();

  // Expand to full height
  tgWebApp.expand();

  // Enable closing confirmation — shows warning before closing
  if (tgWebApp.enableClosingConfirmation) {
    tgWebApp.enableClosingConfirmation();
  }

  // Mark body as Telegram Mini App for CSS adjustments
  document.body.classList.add('tg-mini-app');

  // Реальный отступ под нативную шапку Telegram. В обычном режиме Telegram
  // сам рисует свой заголовок над WebView и возвращает 0 — поэтому жёсткий
  // спейсер в 80px создавал лишнюю пустую полосу сверху. Берём фактический
  // contentSafeAreaInset (в полноэкранном режиме — высота кнопок Telegram).
  const applyTgSafeArea = () => {
    const contentTop = tgWebApp.contentSafeAreaInset?.top ?? 0;
    document.documentElement.style.setProperty('--tg-safe-top', `${contentTop}px`);
  };
  applyTgSafeArea();
  tgWebApp.onEvent?.('contentSafeAreaChanged', applyTgSafeArea);
  tgWebApp.onEvent?.('safeAreaChanged', applyTgSafeArea);
  tgWebApp.onEvent?.('viewportChanged', applyTgSafeArea);

  // Apply Telegram theme colors to CSS variables
  if (tgWebApp.themeParams) {
    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', tgWebApp.themeParams.bg_color || '#ffffff');
    root.style.setProperty('--tg-theme-text-color', tgWebApp.themeParams.text_color || '#000000');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
