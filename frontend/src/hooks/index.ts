// ============================================
// MasterUz — Custom Hooks
// Агент 2 (Фронтенд-разработчик)
// ============================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore, useAppStore } from '../store';
import { authApi, catalogApi, onlineStatusApi } from '../api/client';
import { useTranslation } from '../i18n';

/**
 * Хук для определения Telegram Mini App
 */
export function useTelegram() {
  const setIsTelegramMiniApp = useAppStore((s) => s.setIsTelegramMiniApp);

  const tg = (window as any).Telegram?.WebApp;
  const isMiniApp = !!tg?.initData;

  useEffect(() => {
    if (isMiniApp) {
      tg.ready();
      tg.expand();
      setIsTelegramMiniApp(true);
    }
  }, [isMiniApp, tg, setIsTelegramMiniApp]);

  return {
    tg,
    isMiniApp,
    initData: tg?.initData || '',
    user: tg?.initDataUnsafe?.user,
    colorScheme: tg?.colorScheme || 'light',
    themeParams: tg?.themeParams,
    close: () => tg?.close(),
    showAlert: (message: string) => tg?.showAlert(message),
    showConfirm: (message: string, callback: (confirmed: boolean) => void) =>
      tg?.showConfirm(message, callback),
    mainButton: tg?.MainButton,
    backButton: tg?.BackButton,
    // Haptic feedback
    hapticImpact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') =>
      tg?.HapticFeedback?.impactOccurred(style),
    hapticNotification: (type: 'error' | 'success' | 'warning' = 'success') =>
      tg?.HapticFeedback?.notificationOccurred(type),
    hapticSelection: () =>
      tg?.HapticFeedback?.selectionChanged(),
  };
}

/**
 * Хук для геолокации
 */
export function useGeolocation() {
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const userLocation = useAppStore((s) => s.userLocation);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getCurrentPosition } = await import('../lib/geolocation');
      const { latitude, longitude } = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
      });
      setUserLocation({ latitude, longitude });
    } catch (err: any) {
      setError(err?.message ?? 'Не удалось получить геолокацию');
    } finally {
      setLoading(false);
    }
  }, [setUserLocation]);

  return { location: userLocation, error, loading, requestLocation };
}

/**
 * Хук для режима «Крупный текст» (возраст 45–70+)
 */
export function useLargeText() {
  const largeText = useAppStore((s) => s.largeText);
  const toggleLargeText = useAppStore((s) => s.toggleLargeText);

  useEffect(() => {
    if (largeText) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }
  }, [largeText]);

  return { largeText, toggleLargeText };
}

/**
 * Хук для инициализации приложения
 */
export function useAppInit() {
  const { setAuth, setLoading, logout } = useAuthStore();
  const { setCategories, catalogLoaded, largeText } = useAppStore();

  useEffect(() => {
    // Apply large-text mode on init
    if (largeText) {
      document.documentElement.classList.add('large-text');
    }

    async function init() {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      if (token) {
        try {
          const response = await authApi.me();
          if (response.data.success) {
            setAuth(
              response.data.data,
              token,
              localStorage.getItem('refreshToken') || ''
            );
          }
        } catch {
          logout();
        }
      } else {
        setLoading(false);
      }

      // Load catalog categories (cache in store)
      if (!catalogLoaded) {
        try {
          const catRes = await catalogApi.getCategories();
          if (catRes.data.data) {
            // Сохраняем все категории (включая родительские) в store
            setCategories(catRes.data.data);
          }
        } catch {
          // silent — catalog may load later
        }
      }
    }

    init();
  }, [setAuth, setLoading, logout, setCategories, catalogLoaded]);
}

/**
 * Хук для форматирования цены (UZS) — с учётом языка
 */
export function useFormatPrice() {
  const { t, locale } = useTranslation();

  return useCallback((price: number, currencyLabel?: string): string => {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
    const suffix = currencyLabel !== undefined ? currencyLabel : t('common.currency');
    return suffix ? `${formatted} ${suffix}` : formatted;
  }, [t, locale]);
}

/**
 * Хук для темы (светлая/тёмная/системная)
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'masteruz_theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system';
    } catch {
      return 'system';
    }
  });

  const resolvedTheme = mode === 'system' ? getSystemTheme() : mode;
  const isDark = resolvedTheme === 'dark';

  // Apply class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setModeState('system'); // re-trigger
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(THEME_KEY, m); } catch { /* noop */ }
  }, []);

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  return { mode, setMode, isDark, resolvedTheme, toggle };
}

/**
 * Хук для дебаунса значения
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Хук для отслеживания прокрутки
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

const ONLINE_MODE_KEY = 'masteruz-online-mode';

/**
 * Хук для управления онлайн-статусом мастера.
 * Мастер сам решает, когда быть онлайн (toggle на дашборде).
 * Heartbeat отправляется каждые 30 секунд, пока режим включён.
 */
export function useOnlineStatus() {
  const { user, setUser } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isOnline, setIsOnline] = useState(() => localStorage.getItem(ONLINE_MODE_KEY) === 'true');
  const [toggling, setToggling] = useState(false);

  const isMaster = user?.role === 'MASTER';

  // Heartbeat с геолокацией
  const sendHeartbeat = useCallback(async () => {
    try {
      const { getCurrentPosition } = await import('../lib/geolocation');
      const { latitude, longitude } = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5_000,
      });
      onlineStatusApi.heartbeat(latitude, longitude).catch(() => {});
    } catch {
      onlineStatusApi.heartbeat().catch(() => {});
    }
  }, []);

  // Запуск heartbeat-цикла
  const startHeartbeat = useCallback(() => {
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 30_000);
  }, [sendHeartbeat]);

  // Остановка heartbeat-цикла
  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Включить онлайн-режим
  const goOnline = useCallback(async () => {
    if (!isMaster || toggling) return;
    setToggling(true);
    try {
      await onlineStatusApi.heartbeat();
      localStorage.setItem(ONLINE_MODE_KEY, 'true');
      setIsOnline(true);
      if (user?.masterProfile) {
        setUser({ ...user, masterProfile: { ...user.masterProfile, isOnline: true } });
      }
      startHeartbeat();
    } finally {
      setToggling(false);
    }
  }, [isMaster, toggling, user, setUser, startHeartbeat]);

  // Выключить онлайн-режим
  const goOffline = useCallback(async () => {
    if (!isMaster || toggling) return;
    setToggling(true);
    try {
      stopHeartbeat();
      await onlineStatusApi.goOffline();
      localStorage.setItem(ONLINE_MODE_KEY, 'false');
      setIsOnline(false);
      if (user?.masterProfile) {
        setUser({ ...user, masterProfile: { ...user.masterProfile, isOnline: false } });
      }
    } finally {
      setToggling(false);
    }
  }, [isMaster, toggling, user, setUser, stopHeartbeat]);

  // Toggle (для удобства UI)
  const toggleOnline = useCallback(() => {
    return isOnline ? goOffline() : goOnline();
  }, [isOnline, goOnline, goOffline]);

  // Автозапуск heartbeat при загрузке, если мастер ранее был онлайн
  useEffect(() => {
    if (!isMaster) return;
    if (!isOnline) return;

    startHeartbeat();

    function handleBeforeUnload() {
      const token = localStorage.getItem('accessToken');
      if (token) {
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_API_URL || '/api'}/users/go-offline`,
          new Blob([JSON.stringify({})], { type: 'application/json' }),
        );
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopHeartbeat();
        onlineStatusApi.goOffline().catch(() => {});
      } else {
        startHeartbeat();
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopHeartbeat();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      onlineStatusApi.goOffline().catch(() => {});
    };
  }, [isMaster, isOnline, startHeartbeat, stopHeartbeat]);

  // Синхронизация с masterProfile из сервера
  useEffect(() => {
    if (user?.masterProfile) {
      setIsOnline(!!user.masterProfile.isOnline);
      localStorage.setItem(ONLINE_MODE_KEY, user.masterProfile.isOnline ? 'true' : 'false');
    }
  }, [user?.masterProfile?.isOnline]);

  return { isOnline, toggling, toggleOnline, goOnline, goOffline };
}
