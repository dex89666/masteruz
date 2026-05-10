// ============================================
// MasterUz — Master Location Broadcast
// Мастер при IN_TRANSIT шлёт координаты раз в 15с,
// бэк рассылает SSE-событие `master_location` клиенту.
// ============================================

import { useEffect, useRef } from 'react';
import { ordersApi } from '../api/client';

const BROADCAST_INTERVAL_MS = 15_000;

interface Options {
  orderId: string | undefined;
  enabled: boolean;
}

export function useMasterLocationBroadcast({ orderId, enabled }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !navigator.geolocation) return;

    const send = (coords: GeolocationCoordinates) => {
      lastSentAtRef.current = Date.now();
      lastCoordsRef.current = { lat: coords.latitude, lng: coords.longitude };
      ordersApi
        .masterLocation(orderId, {
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading ?? undefined,
          speed: coords.speed ?? undefined,
        })
        .catch(() => { /* в фоне, ошибки игнорируем */ });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Throttling: шлём не чаще, чем раз в BROADCAST_INTERVAL_MS,
        // плюс отдельно если сместились больше чем на ~25м.
        const now = Date.now();
        const last = lastCoordsRef.current;
        const movedFar =
          last &&
          (Math.abs(last.lat - pos.coords.latitude) > 0.0002 ||
            Math.abs(last.lng - pos.coords.longitude) > 0.0002);
        if (now - lastSentAtRef.current >= BROADCAST_INTERVAL_MS || movedFar || !last) {
          send(pos.coords);
        }
      },
      () => { /* пользователь отменил геолокацию — тихо */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [orderId, enabled]);
}
