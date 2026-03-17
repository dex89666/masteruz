// ============================================
// MasterUz — Geo Service
// Агент 4 (Специалист по геолокации)
// ============================================

import { prisma } from '../../config/database.js';
import { calculateDistance } from '../../utils/helpers.js';
import { OrderStatus } from '@prisma/client';

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
   * Геокодинг адреса (через Yandex Maps Geocoder API)
   */
  async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      // В реальном проекте — вызов Yandex Geocoder API
      // const response = await fetch(
      //   `https://geocode-maps.yandex.ru/1.x/?apikey=${config.yandexMaps.apiKey}&geocode=${encodeURIComponent(address)}&format=json`
      // );
      // const data = await response.json();
      // Парсинг координат из ответа...

      // Заглушка для разработки
      return null;
    } catch {
      return null;
    }
  }
}

export const geoService = new GeoService();
