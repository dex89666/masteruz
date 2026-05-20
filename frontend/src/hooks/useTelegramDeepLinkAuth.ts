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

const DEEPLINK_PREFIX = 'uz.masteruz.app://auth';

export function useTelegramDeepLinkAuth(): void {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = async (event: URLOpenListenerEvent) => {
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
          toast.success('Вход выполнен через Telegram');
          navigate('/', { replace: true });
        }
      } catch {
        toast.error('Не удалось завершить вход через Telegram');
      }
    };

    const listenerPromise = App.addListener('appUrlOpen', handle);
    return () => {
      void listenerPromise.then((l) => l.remove());
    };
  }, [navigate, setAuth]);
}
