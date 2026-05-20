// ============================================
// MasterUz — единый хелпер геолокации
// ============================================
//
// В вебе — `navigator.geolocation`.
// В Capacitor (Android/iOS) — `@capacitor/geolocation`, который сам запрашивает
// runtime-permission через системный диалог. Без этого WebView на Android
// возвращает PERMISSION_DENIED, потому что у Capacitor WebView нет UI для
// запроса разрешений, а пользователю показывается «иконка замка в адресной строке» —
// которой в нативном приложении нет.

import { Capacitor } from '@capacitor/core';

export interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeoOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const DEFAULTS: Required<GeoOptions> = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 30_000,
};

const isNative = Capacitor.isNativePlatform();

export async function getCurrentPosition(opts: GeoOptions = {}): Promise<GeoCoords> {
  const options = { ...DEFAULTS, ...opts };

  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    // Запрашиваем permission, если ещё не выдано — системный диалог Android/iOS.
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const req = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
        throw new GeoError('PERMISSION_DENIED', 'Разрешите доступ к геолокации в настройках телефона');
      }
    }
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (err: any) {
      throw new GeoError('POSITION_UNAVAILABLE', err?.message || 'Не удалось получить координаты');
    }
  }

  // Веб-fallback
  return new Promise<GeoCoords>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeoError('UNSUPPORTED', 'Браузер не поддерживает геолокацию'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      err => {
        const code =
          err.code === err.PERMISSION_DENIED
            ? 'PERMISSION_DENIED'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'POSITION_UNAVAILABLE'
              : err.code === err.TIMEOUT
                ? 'TIMEOUT'
                : 'POSITION_UNAVAILABLE';
        reject(new GeoError(code, geoErrorMessage(code)));
      },
      options,
    );
  });
}

export type GeoErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED';

export class GeoError extends Error {
  constructor(public readonly code: GeoErrorCode, message: string) {
    super(message);
    this.name = 'GeoError';
  }
}

export function geoErrorMessage(code: GeoErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return isNative
        ? 'Разрешите доступ к геолокации в настройках телефона'
        : 'Доступ к геолокации заблокирован. Разрешите его в настройках браузера';
    case 'POSITION_UNAVAILABLE':
      return 'Не удалось определить местоположение';
    case 'TIMEOUT':
      return 'Превышено время ожидания геолокации';
    case 'UNSUPPORTED':
      return 'Геолокация не поддерживается';
  }
}

/**
 * watchPosition — для long-running отслеживания (мастер в пути).
 * Возвращает функцию для остановки.
 */
export async function watchPosition(
  onUpdate: (coords: GeoCoords) => void,
  onError?: (err: GeoError) => void,
  opts: GeoOptions = {},
): Promise<() => void> {
  const options = { ...DEFAULTS, ...opts };

  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      const req = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
        onError?.(new GeoError('PERMISSION_DENIED', geoErrorMessage('PERMISSION_DENIED')));
        return () => undefined;
      }
    }
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      },
      (pos, err) => {
        if (err) {
          onError?.(new GeoError('POSITION_UNAVAILABLE', err.message || ''));
          return;
        }
        if (pos) {
          onUpdate({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
    );
    return () => {
      Geolocation.clearWatch({ id: watchId }).catch(() => undefined);
    };
  }

  if (!('geolocation' in navigator)) {
    onError?.(new GeoError('UNSUPPORTED', geoErrorMessage('UNSUPPORTED')));
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    pos =>
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    err => {
      const code: GeoErrorCode =
        err.code === err.PERMISSION_DENIED
          ? 'PERMISSION_DENIED'
          : err.code === err.TIMEOUT
            ? 'TIMEOUT'
            : 'POSITION_UNAVAILABLE';
      onError?.(new GeoError(code, geoErrorMessage(code)));
    },
    options,
  );
  return () => navigator.geolocation.clearWatch(id);
}
