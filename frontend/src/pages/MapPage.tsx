// ============================================
// MasterUz — Map Page (Yandex Maps)
// Агент 2 (Фронтенд-разработчик)
// ============================================

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { geoApi } from '../api/client';
import { useGeolocation, useFormatPrice } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MapPin, Navigation, List, X } from 'lucide-react';
import type { Order } from '../types';
import { useTranslation } from '../i18n';

declare global {
  interface Window {
    ymaps: any;
  }
}

export function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const { location, requestLocation } = useGeolocation();
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Load Yandex Maps
  useEffect(() => {
    if (window.ymaps) {
      initMap();
      return;
    }

    const apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY || '';
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.onload = () => {
      window.ymaps.ready(() => {
        initMap();
      });
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
      }
    };
  }, []);

  // Load orders when location is available
  useEffect(() => {
    if (location) {
      loadNearbyOrders();
    }
  }, [location]);

  // Add markers when orders or map change
  useEffect(() => {
    if (mapReady && orders.length > 0) {
      addMarkers();
    }
  }, [mapReady, orders]);

  function initMap() {
    if (!mapRef.current || mapInstance.current) return;

    const center = location
      ? [location.latitude, location.longitude]
      : [41.2995, 69.2401]; // Ташкент по умолчанию

    mapInstance.current = new window.ymaps.Map(mapRef.current, {
      center,
      zoom: 12,
      controls: ['zoomControl', 'geolocationControl'],
    });

    setMapReady(true);
    setLoading(false);
  }

  async function loadNearbyOrders() {
    if (!location) return;
    try {
      const response = await geoApi.ordersNearby(
        location.latitude,
        location.longitude,
        20, // 20 km radius
      );
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Error loading map orders:', error);
    }
  }

  function addMarkers() {
    if (!mapInstance.current || !window.ymaps) return;

    // Clear old markers
    mapInstance.current.geoObjects.removeAll();

    // Add user location marker
    if (location) {
      const userMark = new window.ymaps.Placemark(
        [location.latitude, location.longitude],
        { hintContent: t('mapPage.youAreHere') },
        {
          preset: 'islands#blueCircleDotIcon',
        }
      );
      mapInstance.current.geoObjects.add(userMark);
    }

    // Add order markers
    orders.forEach((order) => {
      if (!order.latitude || !order.longitude) return;

      const placemark = new window.ymaps.Placemark(
        [order.latitude, order.longitude],
        {
          hintContent: order.title,
          balloonContent: `
            <div style="max-width:200px">
              <strong>${order.title}</strong>
              <br/>${formatPrice(order.price)}
              <br/><small>${order.address || order.city || ''}</small>
            </div>
          `,
        },
        {
          preset: 'islands#orangeDotIcon',
        }
      );

      placemark.events.add('click', () => {
        setSelectedOrder(order);
      });

      mapInstance.current.geoObjects.add(placemark);
    });
  }

  function centerOnUser() {
    if (location && mapInstance.current) {
      mapInstance.current.setCenter(
        [location.latitude, location.longitude],
        14,
        { duration: 500 }
      );
    } else {
      requestLocation();
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col relative">
      {/* Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-2 rounded-lg shadow text-sm font-medium ${
              viewMode === 'map'
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <MapPin size={14} className="inline mr-1" />
            {t('nav.map')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-lg shadow text-sm font-medium ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <List size={14} className="inline mr-1" />
            {t('mapPage.listView')}
          </button>
        </div>

        <button
          onClick={centerOnUser}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700"
          title={t('mapPage.myPosition')}
        >
          <Navigation size={18} className="text-primary-600" />
        </button>
      </div>

      {/* Map view */}
      {viewMode === 'map' && (
        <>
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          )}
          <div
            ref={mapRef}
            className="flex-1 w-full"
            style={{ display: loading ? 'none' : 'block' }}
          />
        </>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto pt-14 px-3 pb-20">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <MapPin size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {location
                  ? t('mapPage.noOrdersNearby')
                  : t('mapPage.detectLocation')}
              </p>
              {!location && (
                <button onClick={requestLocation} className="btn-primary mt-3">
                  <MapPin size={16} className="mr-1" />
                  {t('mapPage.detect')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="card dark:bg-gray-800 dark:ring-gray-700 block hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold mb-1 dark:text-white">{order.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                    {order.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-primary-600">
                      {formatPrice(order.price)}
                    </span>
                    <span className="text-gray-400">
                      <MapPin size={12} className="inline mr-1" />
                      {order.address || order.city || '—'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected order card */}
      {selectedOrder && viewMode === 'map' && (
        <div className="absolute bottom-20 left-3 right-3 z-10">
          <div className="card dark:bg-gray-800 dark:ring-gray-700 shadow-xl relative">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={18} />
            </button>
            <h3 className="font-semibold mb-1 pr-6 dark:text-white">{selectedOrder.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
              {selectedOrder.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary-600">
                {formatPrice(selectedOrder.price)}
              </span>
              <Link
                to={`/orders/${selectedOrder.id}`}
                className="btn-primary text-sm"
              >
                {t('common.more')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
