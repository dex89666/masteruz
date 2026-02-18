// ============================================
// MasterUz — Instant Order Service
// ФотоЗаказ за 30 секунд — AI анализ + создание
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { balanceService } from '../balance/balance.service.js';
import { notificationService } from '../../services/notificationService.js';
import { OrderStatus } from '@prisma/client';

// Тип AI-уровня (AiTier будет доступен после prisma generate)
type AiTierType = 'GOOD' | 'BETTER' | 'BEST';

// ─── Конфигурация ─────────────────────────────
const DEFAULT_COMMISSION_RATE = 15;
const DEFAULT_VISIT_FEE = 100000;
const VISIT_FEE_COMMISSION_RATE = 10;

// ─── Коэффициенты для уровней AI ──────────────
const TIER_MULTIPLIERS: Record<string, { price: number; days: number; label: string }> = {
  GOOD: { price: 1.0, days: 1.3, label: 'Хороший — стандарт' },
  BETTER: { price: 1.4, days: 1.0, label: 'Отличный — оптимальный' },
  BEST: { price: 2.0, days: 0.8, label: 'Премиум — максимум качества' },
};

export class InstantOrderService {
  /**
   * AI-анализ фотографий и описания → 3 варианта (Good / Better / Best)
   */
  async analyzePhotos(userId: string, data: {
    images: string[];
    description?: string;
    voiceText?: string;
    categoryId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const { images, description, voiceText, categoryId } = data;

    if (!images || images.length === 0) {
      throw ApiError.badRequest('Необходимо загрузить хотя бы 1 фото');
    }
    if (images.length > 10) {
      throw ApiError.badRequest('Максимум 10 фотографий');
    }

    // Объединяем описание из голоса и текста
    const combinedDescription = [voiceText, description].filter(Boolean).join('. ');

    if (!combinedDescription && !categoryId) {
      throw ApiError.badRequest('Опишите что нужно сделать (голосом или текстом) или выберите категорию');
    }

    // ─── Определяем категорию ──────────────
    let category;
    if (categoryId) {
      category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          subcategories: {
            where: { isActive: true },
            include: {
              tasks: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      });
    } else {
      // AI auto-detect: берём первую активную категорию по ключевым словам
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        include: {
          subcategories: {
            where: { isActive: true },
            include: {
              tasks: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      });

      // Простейший keyword-matching (в будущем → LLM)
      category = this.detectCategory(combinedDescription, categories);
    }

    if (!category) {
      throw ApiError.badRequest('Не удалось определить категорию. Пожалуйста, выберите категорию вручную.');
    }

    // ─── Собираем все доступные задачи ─────
    const allTasks = category.subcategories.flatMap((sub: any) => sub.tasks);

    if (allTasks.length === 0) {
      throw ApiError.badRequest('В выбранной категории нет доступных задач. Попробуйте другую категорию.');
    }

    // ─── AI-подбор задач (Mock + Smart Logic) ──
    const analysisResult = this.generateVariants(category, allTasks, combinedDescription, images);

    // Сохраняем шаблоны в БД
    const templates = await Promise.all(
      analysisResult.variants.map(async (variant: any) => {
        return prisma.aiOrderTemplate.create({
          data: {
            categoryId: category!.id,
            tier: variant.tier as AiTierType,
            tierLabel: variant.tierLabel,
            taskIds: variant.taskIds,
            materials: variant.materials,
            estimatedPrice: variant.estimatedPrice,
            estimatedDays: variant.estimatedDays,
            confidence: variant.confidence,
            prompt: combinedDescription,
            imageAnalysis: { imageCount: images.length, description: combinedDescription },
            description: variant.description,
            createdById: userId,
          },
        });
      })
    );

    logger.info(
      { userId, categoryId: category.id, variantCount: templates.length },
      'AI-анализ завершён, варианты созданы'
    );

    return {
      category: {
        id: category.id,
        name: category.name,
        nameUz: category.nameUz,
        nameEn: category.nameEn,
        slug: category.slug,
      },
      detectedFromPhoto: !categoryId,
      variants: templates.map((t: any) => ({
        id: t.id,
        tier: t.tier,
        tierLabel: t.tierLabel,
        taskIds: t.taskIds,
        materials: t.materials,
        estimatedPrice: t.estimatedPrice,
        estimatedDays: t.estimatedDays,
        confidence: t.confidence,
        description: t.description,
      })),
      allTasks: allTasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        nameUz: t.nameUz,
        nameEn: t.nameEn,
        minPrice: t.minPrice,
        estimatedTime: t.estimatedTime,
      })),
    };
  }

  /**
   * Создание заказа из выбранного AI-варианта
   */
  async createFromTemplate(clientId: string, data: {
    templateId: string;
    title: string;
    description: string;
    additionalWishes?: string;
    voiceDescription?: string;
    address: string;
    city?: string;
    district?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
    images: string[];
    deadline?: string;
    isUrgent?: boolean;
    offerAccepted: boolean;
  }) {
    // Проверяем оферту
    if (!data.offerAccepted) {
      throw ApiError.badRequest('Необходимо принять условия оферты');
    }

    // Загружаем шаблон
    const template = await prisma.aiOrderTemplate.findUnique({
      where: { id: data.templateId },
    });
    if (!template) {
      throw ApiError.notFound('AI-вариант не найден');
    }

    // Проверяем категорию
    const category = await prisma.category.findUnique({
      where: { id: template.categoryId },
    });
    if (!category || !category.isActive) {
      throw ApiError.badRequest('Категория не найдена или неактивна');
    }

    // Получаем конфигурацию платформы
    const [commissionConfig, visitFeeConfig, visitFeeCommConfig, urgencyConfig] = await Promise.all([
      prisma.platformConfig.findUnique({ where: { key: 'commission_rate' } }),
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee' } }),
      prisma.platformConfig.findUnique({ where: { key: 'visit_fee_commission_rate' } }),
      prisma.platformConfig.findUnique({ where: { key: 'urgency_multiplier' } }),
    ]);
    const commissionRate = commissionConfig ? parseFloat(commissionConfig.value) : DEFAULT_COMMISSION_RATE;
    const visitFee = visitFeeConfig ? parseFloat(visitFeeConfig.value) : DEFAULT_VISIT_FEE;
    const visitFeeCommissionRate = visitFeeCommConfig ? parseFloat(visitFeeCommConfig.value) : VISIT_FEE_COMMISSION_RATE;

    // Обработка срочности (из настроек или по умолчанию 40%)
    const urgencyPercent = urgencyConfig ? parseFloat(urgencyConfig.value) : 40;
    const URGENT_MULTIPLIER = 1 + urgencyPercent / 100;
    const isUrgent = data.isUrgent === true;
    const urgentMultiplier = isUrgent ? URGENT_MULTIPLIER : 1.0;
    const effectivePrice = template.estimatedPrice * urgentMultiplier;

    // Комиссии
    const workCommission = effectivePrice * (commissionRate / 100);
    const visitFeeCommission = visitFee * (visitFeeCommissionRate / 100);
    const commissionAmount = workCommission + visitFeeCommission;

    // Сумма для эскроу
    const escrowAmount = effectivePrice + visitFee;

    // Проверка баланса и блокировка средств
    const clientBalance = await balanceService.getBalance(clientId);
    if (clientBalance < escrowAmount) {
      throw ApiError.badRequest(
        `Недостаточно средств. Баланс: ${clientBalance.toLocaleString('ru')} сум, ` +
        `необходимо: ${escrowAmount.toLocaleString('ru')} сум`
      );
    }

    await balanceService.holdFunds(clientId, escrowAmount, 'pending');

    // Определяем, нужна ли модерация (есть доп. пожелания)
    const hasModerationWishes = !!data.additionalWishes && data.additionalWishes.trim().length > 0;

    try {
      const order = await prisma.order.create({
        data: {
          clientId,
          categoryId: template.categoryId,
          title: data.title,
          description: data.description,
          price: effectivePrice,
          commissionRate,
          commissionAmount,
          visitFee,
          escrowAmount,
          offerAccepted: true,
          status: hasModerationWishes ? OrderStatus.MODERATION : OrderStatus.PUBLISHED,
          isUrgent,
          urgentMultiplier,
          // AI-специфичные поля
          isInstantAiOrder: true,
          aiTemplateId: template.id,
          additionalWishes: data.additionalWishes || null,
          moderationRequired: hasModerationWishes,
          voiceDescription: data.voiceDescription || null,
          // Адрес
          address: data.address,
          city: data.city,
          district: data.district,
          region: data.region,
          latitude: data.latitude,
          longitude: data.longitude,
          images: data.images,
          deadline: data.deadline ? new Date(data.deadline) : null,
          // Задачи из шаблона
          ...(template.taskIds.length > 0
            ? { orderTasks: { create: template.taskIds.map((taskId: string) => ({ taskId })) } }
            : {}),
        },
        include: {
          category: true,
          client: { include: { profile: true } },
          orderTasks: { include: { task: true } },
          aiTemplate: true,
        },
      });

      // Обновляем orderId в транзакции эскроу
      await prisma.balanceTransaction.updateMany({
        where: { userId: clientId, orderId: 'pending', type: 'ESCROW_HOLD' },
        data: { orderId: order.id },
      });

      logger.info(
        { orderId: order.id, clientId, tier: template.tier, price: effectivePrice, moderation: hasModerationWishes },
        '🚀 Instant AI Order создан'
      );

      // Уведомления
      if (hasModerationWishes) {
        // Уведомляем менеджеров о модерации
        logger.info({ orderId: order.id }, 'Заказ отправлен на модерацию (доп. пожелания)');
      } else {
        // Уведомляем мастеров о новом заказе
        notificationService.notifyMastersNewOrder(order.id).catch((err) => {
          logger.error({ error: err }, 'Ошибка уведомления мастеров');
        });
      }

      return order;
    } catch (error) {
      // Откат эскроу при ошибке
      await prisma.user.update({
        where: { id: clientId },
        data: { balance: { increment: escrowAmount } },
      });
      throw error;
    }
  }

  /**
   * Получить шаблон по ID
   */
  async getTemplate(templateId: string) {
    const template = await prisma.aiOrderTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw ApiError.notFound('Шаблон не найден');
    return template;
  }

  /**
   * Получить все AI-заказы на модерации (для менеджера)
   */
  async getPendingModeration(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          isInstantAiOrder: true,
          moderationRequired: true,
          status: OrderStatus.MODERATION,
        },
        include: {
          category: true,
          client: { include: { profile: true } },
          orderTasks: { include: { task: true } },
          aiTemplate: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: {
          isInstantAiOrder: true,
          moderationRequired: true,
          status: OrderStatus.MODERATION,
        },
      }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Модерация AI-заказа менеджером (одобрить / отклонить)
   */
  async moderateOrder(orderId: string, moderatorId: string, approved: boolean, note?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { aiTemplate: true },
    });
    if (!order) throw ApiError.notFound('Заказ не найден');
    if (!order.isInstantAiOrder) throw ApiError.badRequest('Это не AI-заказ');
    if (order.status !== OrderStatus.MODERATION) {
      throw ApiError.badRequest('Заказ не на модерации');
    }

    if (approved) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PUBLISHED },
      });

      notificationService.notifyMastersNewOrder(orderId).catch((err) => {
        logger.error({ error: err }, 'Ошибка уведомления мастеров');
      });

      logger.info({ orderId, moderatorId }, 'AI-заказ одобрен модератором');
    } else {
      // Отклонён — возвращаем средства
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: note || 'Отклонено модератором',
          cancelledBy: moderatorId,
          cancelledAt: new Date(),
        },
      });

      // Возвращаем эскроу (возврат клиенту напрямую)
      if (order.escrowAmount > 0) {
        await prisma.user.update({
          where: { id: order.clientId },
          data: { balance: { increment: order.escrowAmount } },
        });
      }

      logger.info({ orderId, moderatorId, note }, 'AI-заказ отклонён модератором');
    }

    return { orderId, approved, note };
  }

  // ─── Приватные методы ──────────────────────────

  /**
   * Определение категории по ключевым словам описания (mock-AI)
   */
  private detectCategory(description: string, categories: any[]): any | null {
    const lower = description.toLowerCase();
    const keywords: Record<string, string[]> = {
      'plumbing': ['сантехник', 'труб', 'кран', 'унитаз', 'ванн', 'душ', 'канализ', 'водопровод', 'течь', 'смеситель'],
      'electrical': ['электрик', 'розетк', 'выключател', 'провод', 'свет', 'люстр', 'щиток', 'замыкан', 'счётчик'],
      'furniture': ['мебел', 'шкаф', 'стол', 'стул', 'кухн', 'полк', 'сборк', 'диван', 'кроват'],
      'construction': ['стройк', 'кладк', 'стен', 'фундамент', 'бетон', 'кирпич', 'перегородк'],
      'painting': ['покраск', 'штукатурк', 'обо', 'шпаклёвк', 'отделк', 'грунтовк', 'потолок', 'ламинат'],
      'windows-doors': ['окн', 'дверь', 'двер', 'балкон', 'стеклопакет', 'замок', 'петл'],
      'cleaning': ['уборк', 'клининг', 'чистк', 'мойк', 'пыл', 'дезинфекц'],
      'carpentry': ['плотник', 'дерев', 'доск', 'парк', 'ламинат', 'вагонк'],
    };

    let bestMatch: any = null;
    let bestScore = 0;

    for (const cat of categories) {
      const catKeywords = keywords[cat.slug] || [];
      const score = catKeywords.filter((kw: string) => lower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cat;
      }
    }

    // Если совпадений нет — берём первую категорию
    return bestMatch || categories[0] || null;
  }

  /**
   * Генерация 3 вариантов (Good / Better / Best) из доступных задач
   */
  private generateVariants(category: any, allTasks: any[], description: string, images: string[]) {
    // Сортируем задачи по цене
    const sorted = [...allTasks].sort((a: any, b: any) => (a.minPrice ?? 0) - (b.minPrice ?? 0));

    // Минимальное кол-во задач для каждого уровня
    const minTasks = Math.max(1, Math.floor(sorted.length * 0.3));
    const midTasks = Math.max(2, Math.floor(sorted.length * 0.6));
    const maxTasks = sorted.length;

    const goodTasks = sorted.slice(0, minTasks);
    const betterTasks = sorted.slice(0, midTasks);
    const bestTasks = sorted;

    const calculatePrice = (tasks: any[]) =>
      tasks.reduce((sum: number, t: any) => sum + (t.minPrice ?? 50000), 0);

    const calculateDays = (tasks: any[], multiplier: number) =>
      Math.max(1, Math.ceil(tasks.length * 0.5 * multiplier));

    // Материалы — упрощённый расчёт
    const generateMaterials = (tasks: any[], tier: string) => {
      const base = [
        { name: 'Расходные материалы', quantity: 1, unit: 'компл.', unitPrice: 50000, total: 50000 },
      ];
      if (tier === 'BETTER' || tier === 'BEST') {
        base.push({ name: 'Доп. материалы (качество)', quantity: 1, unit: 'компл.', unitPrice: 100000, total: 100000 });
      }
      if (tier === 'BEST') {
        base.push({ name: 'Премиум материалы', quantity: 1, unit: 'компл.', unitPrice: 200000, total: 200000 });
      }
      return base;
    };

    const variants = [
      {
        tier: 'GOOD',
        tierLabel: TIER_MULTIPLIERS.GOOD.label,
        taskIds: goodTasks.map((t: any) => t.id),
        materials: generateMaterials(goodTasks, 'GOOD'),
        estimatedPrice: Math.round(calculatePrice(goodTasks) * TIER_MULTIPLIERS.GOOD.price),
        estimatedDays: calculateDays(goodTasks, TIER_MULTIPLIERS.GOOD.days),
        confidence: 0.85,
        description: `Базовый вариант: ${goodTasks.length} работ. Стандартные материалы, оптимальная цена.`,
      },
      {
        tier: 'BETTER',
        tierLabel: TIER_MULTIPLIERS.BETTER.label,
        taskIds: betterTasks.map((t: any) => t.id),
        materials: generateMaterials(betterTasks, 'BETTER'),
        estimatedPrice: Math.round(calculatePrice(betterTasks) * TIER_MULTIPLIERS.BETTER.price),
        estimatedDays: calculateDays(betterTasks, TIER_MULTIPLIERS.BETTER.days),
        confidence: 0.90,
        description: `Оптимальный вариант: ${betterTasks.length} работ. Качественные материалы, лучшее соотношение цена/качество.`,
      },
      {
        tier: 'BEST',
        tierLabel: TIER_MULTIPLIERS.BEST.label,
        taskIds: bestTasks.map((t: any) => t.id),
        materials: generateMaterials(bestTasks, 'BEST'),
        estimatedPrice: Math.round(calculatePrice(bestTasks) * TIER_MULTIPLIERS.BEST.price),
        estimatedDays: calculateDays(bestTasks, TIER_MULTIPLIERS.BEST.days),
        confidence: 0.95,
        description: `Премиум вариант: ${bestTasks.length} работ. Все задачи + лучшие материалы. Максимальное качество.`,
      },
    ];

    return { variants };
  }
}

export const instantOrderService = new InstantOrderService();
