// ============================================
// MasterUz — Ratings (Reviews) Service
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { OrderStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';

export class RatingsService {
  /**
   * Создание отзыва после завершения заказа
   */
  async createReview(reviewerId: string, data: {
    orderId: string;
    rating: number;
    comment?: string;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw ApiError.badRequest('Рейтинг должен быть от 1 до 5');
    }

    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });

    if (!order) throw ApiError.notFound('Заказ не найден');
    if (order.status !== OrderStatus.COMPLETED) {
      throw ApiError.badRequest('Отзыв можно оставить только для завершённого заказа');
    }

    // Определяем, кого оценивают
    let revieweeId: string;
    if (reviewerId === order.clientId) {
      // Клиент оценивает мастера
      if (!order.masterId) throw ApiError.badRequest('Мастер не назначен');
      revieweeId = order.masterId;
    } else if (reviewerId === order.masterId) {
      // Мастер оценивает клиента
      revieweeId = order.clientId;
    } else {
      throw ApiError.forbidden('Вы не участник этого заказа');
    }

    // Проверяем дублирование
    const existing = await prisma.review.findUnique({
      where: {
        orderId_reviewerId: {
          orderId: data.orderId,
          reviewerId,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('Вы уже оставили отзыв по этому заказу');
    }

    const review = await prisma.review.create({
      data: {
        orderId: data.orderId,
        reviewerId,
        revieweeId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    // Обновляем средний рейтинг мастера
    await this.updateMasterRating(revieweeId);

    logger.info({ reviewId: review.id, orderId: data.orderId }, 'Отзыв создан');

    return review;
  }

  /**
   * Получение отзывов мастера
   */
  async getMasterReviews(masterId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total, avgRating] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: masterId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            include: { profile: true },
          },
          order: {
            select: { title: true, category: { select: { name: true } } },
          },
        },
      }),
      prisma.review.count({ where: { revieweeId: masterId } }),
      prisma.review.aggregate({
        where: { revieweeId: masterId },
        _avg: { rating: true },
      }),
    ]);

    return {
      data: reviews,
      averageRating: avgRating._avg.rating || 0,
      totalReviews: total,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Обновление среднего рейтинга мастера
   */
  private async updateMasterRating(userId: string) {
    const avgRating = await prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
    });

    if (avgRating._avg.rating !== null) {
      await prisma.masterProfile.updateMany({
        where: { userId },
        data: { rating: Math.round(avgRating._avg.rating * 10) / 10 },
      });
    }
  }
}

export const ratingsService = new RatingsService();
