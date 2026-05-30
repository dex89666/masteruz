// ============================================
// MasterUz — Login Page (i18n)
// ============================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuthStore } from '../store';
import { authApi } from '../api/client';
import { useTelegram } from '../hooks';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Wrench, Zap, Shield, Wallet, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Куда вернуть после входа: если пришли из воронки (напр. /calculator → /instant-order) — туда.
  const redirectTo = ((location.state as any)?.from as string) || '/';
  const { setAuth, isAuthenticated } = useAuthStore();
  const { isMiniApp, initData } = useTelegram();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);

  // Если уже авторизован — редирект
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, redirectTo]);

  // Авторизация через Telegram Mini App (автоматическая)
  useEffect(() => {
    if (isMiniApp && initData) {
      handleMiniAppLogin();
    }
  }, [isMiniApp, initData]);

  async function handleMiniAppLogin() {
    setLoading(true);
    try {
      const response = await authApi.loginMiniApp(initData);
      if (response.data.success) {
        const { user, accessToken, refreshToken } = response.data.data;
        setAuth(user, accessToken, refreshToken);
        toast.success(t('auth.welcome'));
        navigate(redirectTo);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || t('auth.authError'));
    } finally {
      setLoading(false);
    }
  }

  // Telegram Login Widget для веба. В нативном APK не грузим — используем бот-flow.
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) return;
    (window as any).onTelegramAuth = async (user: any) => {
      setLoading(true);
      try {
        const response = await authApi.loginTelegram(user);
        if (response.data.success) {
          const { user: userData, accessToken, refreshToken } = response.data.data;
          setAuth(userData, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate(redirectTo);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error?.message || t('auth.authError'));
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', import.meta.env.VITE_TELEGRAM_BOT_NAME || 'MasterUzBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    const widgetContainer = document.getElementById('telegram-login-widget');
    if (widgetContainer) {
      widgetContainer.replaceChildren(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [setAuth, navigate, isNative, t, redirectTo]);

  // ─── One-tap логин через бота (native) ──────────────
  // Идея: создаём токен на бэке → открываем чат с ботом по deep-link →
  // юзер тапает Start → webhook бота кладёт JWT в Redis → мы поллим и забираем.
  // Никаких номеров телефона и SMS-кодов.
  const pollAbortRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => pollAbortRef.current?.stop(), []);

  // Когда пользователь возвращается из Telegram в наше приложение —
  // ускоряем следующий poll, не ждём интервал.
  const lastTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isNative) return;
    const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && lastTokenRef.current) {
        pollOnce(lastTokenRef.current).catch(() => {});
      }
    });
    return () => {
      handle.then(h => h.remove());
    };
  }, [isNative]);

  async function pollOnce(token: string): Promise<boolean> {
    try {
      const res = await authApi.botAuthPoll(token);
      if (res.data?.success && res.data.data?.ready) {
        const { accessToken, refreshToken, user } = res.data.data;
        if (accessToken && refreshToken) {
          setAuth(user, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate(redirectTo);
          return true;
        }
      }
    } catch (err: any) {
      // 410 — сессия истекла
      if (err?.response?.status === 410) {
        pollAbortRef.current?.stop();
        toast.error('Сессия авторизации истекла, попробуйте ещё раз');
        setWaitingForBot(false);
      }
    }
    return false;
  }

  async function handleNativeTelegramLogin() {
    // Защита от двойного клика
    if (waitingForBot) return;
    setWaitingForBot(true);
    try {
      const startRes = await authApi.botAuthStart();
      const data = startRes.data?.data;
      if (!startRes.data?.success || !data) {
        throw new Error('Не удалось начать авторизацию');
      }
      lastTokenRef.current = data.token;

      // Открываем Telegram. tg:// откроет нативное приложение мгновенно,
      // если оно установлено. Если нет — браузер автоматически уйдёт на webLink.
      window.open(data.deepLink, '_system', 'noopener,noreferrer');
      // Подстраховка для устройств без Telegram-app: чуть позже открываем web.
      setTimeout(() => {
        if (waitingForBot) {
          window.open(data.webLink, '_system', 'noopener,noreferrer');
        }
      }, 800);

      // Поллим до 2 минут с интервалом 1.5 сек.
      const startedAt = Date.now();
      const deadline = startedAt + 2 * 60 * 1000;
      let stopped = false;
      pollAbortRef.current = {
        stop: () => {
          stopped = true;
          setWaitingForBot(false);
        },
      };

      while (!stopped && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        if (stopped) break;
        const done = await pollOnce(data.token);
        if (done) {
          pollAbortRef.current = null;
          return;
        }
      }
      if (!stopped) {
        setWaitingForBot(false);
        toast.error('Время ожидания истекло. Попробуйте ещё раз.');
      }
    } catch (err: any) {
      setWaitingForBot(false);
      toast.error(err?.response?.data?.error?.message || err?.message || 'Ошибка авторизации');
    }
  }

  function cancelBotAuth() {
    pollAbortRef.current?.stop();
    pollAbortRef.current = null;
    lastTokenRef.current = null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 dark:text-gray-400 mt-4">{t('auth.authInProgress')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="card max-w-md w-full text-center">
        {/* Logo section */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 animate-scale-in">
            <Wrench size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('auth.subtitle')}
          </p>
        </div>

        {/* Features list */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-blue-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featureFast')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-green-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featureSafe')}</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-purple-500" />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('auth.featurePrice')}</p>
          </div>
        </div>

        {/* Telegram Login Widget */}
        <div id="telegram-login-widget" className="flex justify-center mb-6">
          {isNative ? (
            waitingForBot ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 px-5 py-4 w-full justify-center">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Откройте бота и нажмите Start
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelBotAuth}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Отменить
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleNativeTelegramLogin}
                className="inline-flex items-center gap-3 rounded-2xl bg-[#229ED9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#229ED9]/30 transition active:scale-[0.98] hover:bg-[#1c8bc0]"
              >
                <Send size={20} />
                Войти через Telegram
              </button>
            )
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500">{t('auth.telegramLoading')}</div>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('auth.legalConsent')}{' '}
            <a href="/legal/offer" className="text-primary-600 dark:text-primary-400 hover:underline">
              {t('auth.publicOffer')}
            </a>{' '}
            {t('auth.and')}{' '}
            <a href="/legal/privacy" className="text-primary-600 dark:text-primary-400 hover:underline">
              {t('auth.privacyPolicy')}
            </a>
          </p>
        </div>

        {/* Не хотите регистрироваться? → публичный AI-калькулятор (lead-magnet) */}
        <button
          type="button"
          onClick={() => navigate('/calculator')}
          className="mt-4 w-full text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 hover:underline"
        >
          Узнать цену ремонта за 30 секунд — без регистрации →
        </button>
      </div>
    </div>
  );
}
