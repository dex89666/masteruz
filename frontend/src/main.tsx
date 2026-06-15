// ============================================
// MasterUz — main.tsx (Entry Point)
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import './lib/sentry'; // должен быть до импорта App
import { initAnalytics } from './lib/analytics';
import App from './App';
import './index.css';

initAnalytics();

// Нативная оболочка (Capacitor): отмечаем body, чтобы CSS включил
// edge-to-edge режим с safe-area отступами для header/bottom-nav.
if (Capacitor.isNativePlatform()) {
  document.body.classList.add('cap-native');
}

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

  // Полный безопасный отступ сверху = системный safe-area (notch/статус-бар)
  // + contentSafeAreaInset (нативные кнопки Telegram). Без суммирования на
  // iOS остаётся ~47px перекрытия, и логотип уезжает под системные иконки.
  const applyTgSafeArea = () => {
    const systemTop = tgWebApp.safeAreaInset?.top ?? 0;
    const contentTop = tgWebApp.contentSafeAreaInset?.top ?? 0;
    document.documentElement.style.setProperty('--tg-safe-top', `${systemTop + contentTop}px`);
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
