// ============================================
// MasterUz — Geo Service
// Агент 4 (Специалист по геолокации)
// ============================================

import { prisma } from '../../config/database.js';
import { calculateDistance } from '../../utils/helpers.js';
import { OrderStatus } from '@prisma/client';
import { config } from '../../config/index.js';

export class GeoService {
  /**
   * Поиск заказов поблизости
   */
  async getOrdersNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    categoryId?: string
  ) {
    // Получаем все опубликованные заказы с координатами
    const where: any = {
      status: OrderStatus.PUBLISHED,
      latitude: { not: null },
      longitude: { not: null },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        category: true,
        client: {
          include: { profile: { select: { firstName: true, avatarUrl: true } } },
        },
        _count: { select: { responses: true } },
      },
    });

    // Фильтруем по расстоянию и добавляем distance
    const nearbyOrders = orders
      .map((order) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          order.latitude!,
          order.longitude!
        );
        return { ...order, distance: Math.round(distance * 10) / 10 };
      })
      .filter((order) => order.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return nearbyOrders;
  }

  /**
   * Поиск мастеров поблизости
   */
  async getMastersNearby(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    specialization?: string
  ) {
    const where: any = {
      role: 'MASTER',
      isActive: true,
      masterProfile: {
        isAvailable: true,
      },
      profile: {
        latitude: { not: null },
        longitude: { not: null },
      },
    };

    const masters = await prisma.user.findMany({
      where,
      include: {
        profile: true,
        masterProfile: true,
      },
    });

    // Фильтруем по расстоянию
    const nearbyMasters = masters
      .filter((master) => master.profile?.latitude && master.profile?.longitude)
      .map((master) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          master.profile!.latitude!,
          master.profile!.longitude!
        );
        return { ...master, distance: Math.round(distance * 10) / 10 };
      })
      .filter((master) => master.distance <= radiusKm)
      .filter((master) => {
        if (specialization && master.masterProfile) {
          return master.masterProfile.specializations.includes(specialization);
        }
        return true;
      })
      .sort((a, b) => {
        // Scoring: расстояние (40%) + рейтинг (30%) + заказы (30%)
        const scoreA = this.calculateMasterScore(a);
        const scoreB = this.calculateMasterScore(b);
        return scoreB - scoreA;
      });

    return nearbyMasters;
  }

  /**
   * Алгоритм скоринга мастера
   */
  private calculateMasterScore(master: any): number {
    const maxDistance = 50; // максимальное расстояние для нормализации
    const distanceScore = (1 - master.distance / maxDistance) * 0.4;
    const ratingScore = ((master.masterProfile?.rating || 0) / 5) * 0.3;
    const completedOrders = master.masterProfile?.completedOrders || 0;
    const completionScore = (completedOrders / (completedOrders + 10)) * 0.2;
    const newbieBonus = completedOrders < 5 ? 0.1 : 0;

    return distanceScore + ratingScore + completionScore + newbieBonus;
  }

  /**
   * Геокодинг адреса через Yandex Geocoder API.
   * Возвращает {latitude, longitude} или null при отсутствии ключа/ответа.
   */
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    const apiKey = config.yandexMaps?.apiKey;
    if (!apiKey || !address?.trim()) return null;
    try {
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=1&lang=ru_RU`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _fetch = (globalThis as any).fetch as (u: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;
      const res = await _fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const point: string | undefined = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
      if (!point) return null;
      const [lonStr, latStr] = point.split(' ');
      const longitude = parseFloat(lonStr);
      const latitude = parseFloat(latStr);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { latitude, longitude };
    } catch {
      return null;
    }
  }

  /**
   * Обратное геокодирование: координаты → разобранный адрес.
   * Пробует Я.Геокодер (если есть API-ключ), иначе fallback на Nominatim (OSM, без ключа).
   * Возвращает поля: region, city, district, street, house, formatted.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<{
    region?: string;
    city?: string;
    district?: string;
    street?: string;
    house?: string;
    formatted?: string;
  } | null> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const yandex = await this.reverseGeocodeYandex(latitude, longitude);
    if (yandex) return yandex;
    return this.reverseGeocodeNominatim(latitude, longitude);
  }

  private async reverseGeocodeYandex(latitude: number, longitude: number) {
    const apiKey = config.yandexMaps?.apiKey;
    if (!apiKey) return null;
    try {
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${longitude},${latitude}&format=json&results=1&lang=ru_RU&kind=house`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _fetch = (globalThis as any).fetch as (u: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;
      const res = await _fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const obj = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      if (!obj) return null;

      const meta = obj?.metaDataProperty?.GeocoderMetaData;
      const formatted: string | undefined = meta?.text;
      const components: Array<{ kind: string; name: string }> = meta?.Address?.Components ?? [];
      const find = (kind: string) => components.find((c) => c.kind === kind)?.name;

      return {
        region: find('province') || find('area'),
        city: find('locality'),
        district: find('district'),
        street: find('street'),
        house: find('house'),
        formatted,
      };
    } catch {
      return null;
    }
  }

  private async reverseGeocodeNominatim(latitude: number, longitude: number) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&accept-language=ru`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _fetch = (globalThis as any).fetch as (u: string, init?: any) => Promise<{ ok: boolean; json: () => Promise<any> }>;
      const res = await _fetch(url, {
        headers: { 'User-Agent': 'MasterUz/1.0 (https://masteruz.com)' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const addr = data?.address ?? {};
      return {
        region: addr.state || addr.region,
        city: addr.city || addr.town || addr.village,
        district: addr.city_district || addr.district || addr.suburb || addr.neighbourhood,
        street: addr.road || addr.pedestrian || addr.footway,
        house: addr.house_number,
        formatted: data?.display_name,
      };
    } catch {
      return null;
    }
  }
}

export const geoService = new GeoService();
