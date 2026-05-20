// ============================================
// MasterUz — Login Page (i18n)
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../store';
import { authApi } from '../api/client';
import { useTelegram } from '../hooks';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Wrench, Zap, Shield, Wallet, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID as string | undefined;
const BACKEND_ORIGIN =
  (import.meta.env.VITE_TELEGRAM_OAUTH_ORIGIN as string | undefined) ??
  'https://masteruz-backend-production.up.railway.app';

function buildTelegramOAuthUrl(): string {
  const returnTo = `${BACKEND_ORIGIN}/api/auth/telegram-callback`;
  const params = new URLSearchParams({
    bot_id: TELEGRAM_BOT_ID ?? '',
    origin: BACKEND_ORIGIN,
    return_to: returnTo,
    request_access: 'write',
    embed: '0',
  });
  return `https://oauth.telegram.org/auth?${params.toString()}`;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const { isMiniApp, initData } = useTelegram();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Если уже авторизован — редирект
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

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
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || t('auth.authError'));
    } finally {
      setLoading(false);
    }
  }

  // Telegram Login Widget callback (для веб-сайта).
  // В нативном APK Login Widget не работает (Bot domain invalid) —
  // там используем OAuth-flow через внешний браузер + deep-link.
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) return; // на native не грузим widget — он всё равно не пройдёт проверку домена
    (window as any).onTelegramAuth = async (user: any) => {
      setLoading(true);
      try {
        const response = await authApi.loginTelegram(user);
        if (response.data.success) {
          const { user: userData, accessToken, refreshToken } = response.data.data;
          setAuth(userData, accessToken, refreshToken);
          toast.success(t('auth.welcome'));
          navigate('/');
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
  }, [setAuth, navigate, isNative, t]);

  function handleNativeTelegramLogin() {
    if (!TELEGRAM_BOT_ID) {
      toast.error('VITE_TELEGRAM_BOT_ID не задан в сборке');
      return;
    }
    // Открываем во внешнем браузере — Capacitor сам делегирует системе.
    window.open(buildTelegramOAuthUrl(), '_system', 'noopener,noreferrer');
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
            <button
              type="button"
              onClick={handleNativeTelegramLogin}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#229ED9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#229ED9]/30 transition active:scale-[0.98] hover:bg-[#1c8bc0]"
            >
              <Send size={20} />
              Войти через Telegram
            </button>
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
      </div>
    </div>
  );
}
