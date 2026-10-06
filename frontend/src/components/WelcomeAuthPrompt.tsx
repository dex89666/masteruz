// ============================================
// MasterUz — WelcomeAuthPrompt
// При первом открытии гостю сразу предлагаем войти — или отложить вход
// и сначала посмотреть платформу. Выбор запоминаем: окно показывается один раз,
// дальше войти можно кнопкой «Войти» в шапке и меню.
// ============================================

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wrench, LogIn, Compass } from 'lucide-react';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';

const SEEN_KEY = 'masteruz-welcome-seen';
// Здесь окно мешает: сам вход и документы, которые читают перед входом
const HIDDEN_ON = ['/login', '/privacy', '/terms', '/public-offer', '/download'];

function wasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* приватный режим — покажем ещё раз, не страшно */
  }
}

export function WelcomeAuthPrompt() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [dismissed, setDismissed] = useState(wasSeen);

  const open =
    !dismissed && !isLoading && !isAuthenticated &&
    !HIDDEN_ON.includes(location.pathname.replace(/\/$/, ''));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const close = () => {
    markSeen();
    setDismissed(true);
  };

  const login = () => {
    close();
    navigate('/login', { state: { from: location.pathname + location.search } });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40">
          <Wrench size={32} className="text-primary-600 dark:text-primary-400" />
        </div>
        <h2 id="welcome-title" className="text-xl font-bold text-gray-900 dark:text-white">
          {t('layout.welcomeTitle')}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {t('layout.welcomeText')}
        </p>
        <button
          onClick={login}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3.5 text-base font-bold text-white shadow-md hover:bg-primary-600 transition-colors"
        >
          <LogIn size={20} />
          {t('layout.welcomeLogin')}
        </button>
        <button
          onClick={close}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Compass size={18} />
          {t('layout.welcomeLater')}
        </button>
      </div>
    </div>
  );
}
