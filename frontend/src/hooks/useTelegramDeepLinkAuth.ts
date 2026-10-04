// ============================================
// MasterUz — useTelegramDeepLinkAuth
// Слушает appUrlOpen от Capacitor App и обрабатывает deep-link uz.masteruz.app://auth.
// При получении токенов сохраняет их в authStore и переходит на главную.
// ============================================

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store';
import { authApi } from '../api/client';
import { translate } from '../i18n';

const DEEPLINK_PREFIX = 'uz.masteruz.app://auth';
// Возврат из официального входа Telegram (как в Telegram Login SDK для Android)
const TG_LOGIN_PREFIX = 'uz.masteruz.app://telegram-login';
/** Сессия входа: сохраняем до перехода в Telegram — приложение могли выгрузить из памяти */
export const TG_NATIVE_SESSION_KEY = 'tg_native_session';

export function useTelegramDeepLinkAuth(): void {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleTelegramLogin = async (rawUrl: string) => {
      const url = new URL(rawUrl);
      const code = url.searchParams.get('code');
      const session = localStorage.getItem(TG_NATIVE_SESSION_KEY);
      localStorage.removeItem(TG_NATIVE_SESSION_KEY);
      if (!code || !session) {
        if (url.searchParams.get('error')) toast.error(translate('auth.oidcCancelled'));
        return;
      }
      try {
        const res = await authApi.telegramNativeFinish(session, code);
        const { user, accessToken, refreshToken } = res.data.data;
        setAuth(user, accessToken, refreshToken);
        toast.success(translate('auth.welcome'));
        navigate('/', { replace: true });
      } catch (err: any) {
        toast.error(err?.response?.data?.error?.message || translate('auth.tgLoginFailed'));
      }
    };

    const handle = async (event: URLOpenListenerEvent) => {
      if (event.url.startsWith(TG_LOGIN_PREFIX)) {
        await handleTelegramLogin(event.url);
        return;
      }
      if (!event.url.startsWith(DEEPLINK_PREFIX)) return;

      try {
        const url = new URL(event.url);
        const access = url.searchParams.get('access');
        const refresh = url.searchParams.get('refresh');
        if (!access || !refresh) return;

        // Кладём access во временное хранилище ДО вызова /me,
        // потому что api клиент берёт токен из localStorage.
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);

        const me = await authApi.me();
        if (me.data.success) {
          setAuth(me.data.data, access, refresh);
          toast.success(translate('auth.tgLoginOk'));
          navigate('/', { replace: true });
        }
      } catch {
        toast.error(translate('auth.tgLoginFailed'));
      }
    };

    const listenerPromise = App.addListener('appUrlOpen', handle);
    return () => {
      void listenerPromise.then((l) => l.remove());
    };
  }, [navigate, setAuth]);
}
