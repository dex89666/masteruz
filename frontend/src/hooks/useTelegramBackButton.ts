// ============================================
// MasterUz — useTelegramBackButton
// Привязывает нативную кнопку «Назад» Telegram Mini App к колбэку, пока
// смонтирован компонент (оверлеи/лайтбоксы/модалки).
//
// Зачем: на iOS у Telegram свой верхний хедер, который перекрывает кнопки
// закрытия внутри WebView. Пользователь жмёт телеграмовский «Закрыть» и
// закрывает всё приложение. Нативная BackButton всегда доступна и не
// перекрывается — даёт гарантированный выход из оверлея.
// ============================================

import { useEffect } from 'react';

export function useTelegramBackButton(onBack: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const backButton = (window as any).Telegram?.WebApp?.BackButton;
    if (!backButton) return;

    try {
      backButton.onClick(onBack);
      backButton.show();
    } catch {
      return; // старый клиент Telegram без BackButton API
    }

    return () => {
      try {
        backButton.offClick(onBack);
        backButton.hide();
      } catch {
        /* noop */
      }
    };
  }, [onBack, active]);
}
