// ============================================
// MasterUz — Order Route Map
// Встроенная Я-карта на странице заказа: маршрут до клиента,
// live-точка мастера, расстояние, кнопки навигатора.
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Navigation, ExternalLink } from 'lucide-react';
import { loadYandexMaps } from '../lib/yandexMaps';

interface Props {
  orderLat: number;
  orderLng: number;
  /** Координаты мастера для live-трекинга (необязательно) */
  masterLat?: number;
  masterLng?: number;
  /** Координаты «меня» (для построения маршрута) */
  myLat?: number;
  myLng?: number;
  /** Высота карты */
  height?: number;
  /** Показывать кнопки внешних навигаторов */
  showActions?: boolean;
  /** Подпись точки заказа */
  orderLabel?: string;
}

export function OrderRouteMap({
  orderLat,
  orderLng,
  masterLat,
  masterLng,
  myLat,
  myLng,
  height = 260,
  showActions = true,
  orderLabel = 'Адрес заказа',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const orderMarkRef = useRef<any>(null);
  const liveMarkRef = useRef<any>(null);
  const myMarkRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // ─── Инициализация карты ─────────────────────
  useEffect(() => {
    let destroyed = false;
    loadYandexMaps()
      .then((ymaps) => {
        if (destroyed || !containerRef.current) return;
        mapRef.current = new ymaps.Map(containerRef.current, {
          center: [orderLat, orderLng],
          zoom: 14,
          controls: ['zoomControl'],
        });

        // Точка заказа — красная
        orderMarkRef.current = new ymaps.Placemark(
          [orderLat, orderLng],
          { iconCaption: orderLabel },
          {
            preset: 'islands#redHomeCircleIcon',
            iconColor: '#ef4444',
          }
        );
        mapRef.current.geoObjects.add(orderMarkRef.current);
      })
      .catch((err: Error) => {
        if (!destroyed) setLoadError(err.message);
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch { /* ignore */ }
        mapRef.current = null;
      }
    };
  }, []);

  // ─── Маршрут от «меня» к заказу ───────────────
  useEffect(() => {
    if (!mapRef.current || myLat == null || myLng == null) return;
    const ymaps = window.ymaps;
    if (!ymaps?.route) return;

    // Удаляем старый маршрут
    if (routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current);
      routeRef.current = null;
    }

    ymaps
      .route(
        [
          [myLat, myLng],
          [orderLat, orderLng],
        ],
        { mapStateAutoApply: true, multiRoute: true, routingMode: 'auto' }
      )
      .then((multiRoute: any) => {
        routeRef.current = multiRoute;
        mapRef.current.geoObjects.add(multiRoute);
        // Активный маршрут — извлекаем расстояние и время
        multiRoute.model.events.add('requestsuccess', () => {
          const active = multiRoute.getActiveRoute();
          if (!active) return;
          const distance = active.properties.get('distance')?.text;
          const duration = active.properties.get('duration')?.text;
          if (distance && duration) setRouteInfo({ distance, duration });
        });
      })
      .catch(() => { /* offline / нет маршрута */ });
  }, [myLat, myLng, orderLat, orderLng]);

  // ─── Live-точка мастера ──────────────────────
  useEffect(() => {
    if (!mapRef.current || masterLat == null || masterLng == null) return;
    const ymaps = window.ymaps;
    if (!ymaps?.Placemark) return;

    if (liveMarkRef.current) {
      liveMarkRef.current.geometry.setCoordinates([masterLat, masterLng]);
    } else {
      liveMarkRef.current = new ymaps.Placemark(
        [masterLat, masterLng],
        { iconCaption: 'Мастер' },
        { preset: 'islands#blueAutoIcon', iconColor: '#3b82f6' }
      );
      mapRef.current.geoObjects.add(liveMarkRef.current);
    }
  }, [masterLat, masterLng]);

  // ─── Точка «я» (мой собственный маркер, если без маршрута) ──
  useEffect(() => {
    if (!mapRef.current || myLat == null || myLng == null) return;
    const ymaps = window.ymaps;
    if (!ymaps?.Placemark) return;
    if (myMarkRef.current) {
      myMarkRef.current.geometry.setCoordinates([myLat, myLng]);
    } else {
      myMarkRef.current = new ymaps.Placemark(
        [myLat, myLng],
        { iconCaption: 'Вы' },
        { preset: 'islands#geolocationIcon', iconColor: '#6366f1' }
      );
      mapRef.current.geoObjects.add(myMarkRef.current);
    }
  }, [myLat, myLng]);

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
        style={{ height }}
      >
        Карта недоступна. {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
        style={{ height, width: '100%' }}
      />

      {routeInfo && (
        <div className="flex items-center justify-between text-sm bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
          <span className="text-indigo-700 dark:text-indigo-300">
            <Navigation size={14} className="inline mr-1" />
            {routeInfo.distance} · {routeInfo.duration}
          </span>
        </div>
      )}

      {showActions && (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`yandexnavi://build_route_on_map?lat_to=${orderLat}&lon_to=${orderLng}`}
            onClick={() => {
              setTimeout(() => {
                window.open(
                  `https://yandex.ru/maps/?rtext=~${orderLat},${orderLng}&rtt=auto`,
                  '_blank'
                );
              }, 500);
            }}
            className="py-2.5 rounded-xl font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <Navigation size={16} />
            Яндекс.Навигатор
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${orderLat},${orderLng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 rounded-xl font-medium text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink size={16} />
            Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
