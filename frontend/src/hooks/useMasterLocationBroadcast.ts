// ============================================
// MasterUz — Master Location Broadcast
// Фоновое отслеживание позиции мастера (ACCEPTED / IN_TRANSIT / IN_PROGRESS).
//
// 1. watchPosition — стрим координат в реальном времени
// 2. visibilitychange — форсим getCurrentPosition сразу после возврата
//    из фона (браузеры обычно паузят watchPosition в скрытой вкладке)
// 3. pagehide — sendBeacon с последней позицией, чтобы при закрытии
//    приложения/вкладки последняя точка точно попала на бэк
// 4. Wake Lock API — пытаемся удержать экран включённым, когда мастер в пути
// ============================================

import { useEffect, useRef } from 'react';
import { ordersApi } from '../api/client';

const BROADCAST_INTERVAL_MS = 10_000;     // не чаще раза в 10 сек
const FOREGROUND_PULSE_MS = 30_000;       // принудительный пинг раз в 30 сек, даже без движения

interface Options {
  orderId: string | undefined;
  enabled: boolean;
}

export function useMasterLocationBroadcast({ orderId, enabled }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number; heading?: number; speed?: number } | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !navigator.geolocation) return;

    const send = (
      coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'heading' | 'speed'>,
      force = false
    ) => {
      const now = Date.now();
      const last = lastCoordsRef.current;
      const movedFar =
        last &&
        (Math.abs(last.lat - coords.latitude) > 0.0002 ||
          Math.abs(last.lng - coords.longitude) > 0.0002);
      if (!force && !movedFar && now - lastSentAtRef.current < BROADCAST_INTERVAL_MS) return;

      lastSentAtRef.current = now;
      lastCoordsRef.current = {
        lat: coords.latitude,
        lng: coords.longitude,
        heading: coords.heading ?? undefined,
        speed: coords.speed ?? undefined,
      };
      ordersApi
        .masterLocation(orderId, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading ?? undefined,
          speed: coords.speed ?? undefined,
        })
        .catch(() => { /* в фоне, ошибки игнорируем */ });
    };

    // 1. Непрерывный watch (работает пока вкладка видима)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => send(pos.coords),
      () => { /* пользователь отменил геолокацию — тихо */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    // 2. Forced pulse — гарантирует свежую позицию минимум раз в 30 сек,
    //    даже если watchPosition «спит» (например, на iOS в фоне)
    const pulse = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => send(pos.coords, true),
        () => { /* fail silently */ },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    };
    pulseTimerRef.current = setInterval(pulse, FOREGROUND_PULSE_MS);

    // 3. При возврате из фона — немедленно обновляемся
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        pulse();
        // Также попробуем заново взять Wake Lock — он сбрасывается при сворачивании
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 4. fetch keepalive при закрытии — последняя точка точно дойдёт
    const onPageHide = () => {
      const c = lastCoordsRef.current;
      if (!c) return;
      const url = (import.meta.env.VITE_API_URL || '/api') + `/orders/${orderId}/master-location`;
      try {
        fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: c.lat,
            longitude: c.lng,
            heading: c.heading,
            speed: c.speed,
          }),
          keepalive: true,
        }).catch(() => { /* noop */ });
      } catch { /* noop */ }
    };
    window.addEventListener('pagehide', onPageHide);

    // 5. Wake Lock — пробуем удержать экран (мастер за рулём, экран не должен гаснуть)
    async function acquireWakeLock() {
      try {
        // @ts-ignore — wakeLock не во всех TS-libs
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          // @ts-ignore
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch { /* unsupported / denied */ }
    }
    acquireWakeLock();

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (wakeLockRef.current) {
        wakeLockRef.current.release?.().catch(() => { /* noop */ });
        wakeLockRef.current = null;
      }
    };
  }, [orderId, enabled]);
}
