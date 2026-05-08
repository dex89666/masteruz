// ============================================
// MasterUz — Instant Order Service
// ФотоЗаказ за 30 секунд — AI анализ + создание
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { balanceService } from '../balance/balance.service.js';
import { notificationService } from '../../services/notificationService.js';
import { toNum, moneyMul, moneyAdd, calculateCommission } from '../../utils/helpers.js';
import { OrderStatus } from '@prisma/client';
import { buildSmartVariants } from './pricing-catalog.js';

// Тип AI-уровня (AiTier будет доступен после prisma generate)
type AiTierType = 'GOOD' | 'BETTER' | 'BEST';

// ─── Конфигурация ─────────────────────────────
const DEFAULT_COMMISSION_RATE = 15;
const DEFAULT_VISIT_FEE = 100000;
const VISIT_FEE_COMMISSION_RATE = 10;

// ─── Коэффициенты для уровней AI ──────────────
const TIER_MULTIPLIERS: Record<string, { price: number; days: number; label: string }> = {
  GOOD: { price: 1.0, days: 1.3, label: 'Хороший — стандарт' },
  BETTER: { price: 1.15, days: 1.0, label: 'Отличный — оптимальный' },
  BEST: { price: 1.3, days: 0.8, label: 'Премиум — максимум качества' },
};

// ─── Минимальная длина внятного описания ──────
const MIN_CLEAR_DESCRIPTION_LEN = 25;

// ─── Шаблоны уточняющих вопросов ──────────────
// Если описание слишком общее или пересекается с несколькими категориями,
// отдаём пользователю наводящие вопросы вместо случайной категории.
type ClarifyingQuestion = {
  id: string;
  type: 'multiselect' | 'select' | 'text';
  question: string;
  hint?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'plumbing',       label: '🔧 Сантехника (трубы, краны, унитаз)' },
  { value: 'electrical',     label: '⚡ Электрика (розетки, проводка, свет)' },
  { value: 'painting',       label: '🎨 Покраска / обои / штукатурка' },
  { value: 'windows-doors',  label: '🪟 Окна / двери / балкон' },
  { value: 'furniture',      label: '🪑 Мебель (сборка, ремонт, кухня)' },
  { value: 'construction',   label: '🧱 Стены / кладка / стяжка' },
  { value: 'carpentry',      label: '🪵 Полы / паркет / ламинат' },
  { value: 'roofing',        label: '🏠 Крыша / кровля' },
  { value: 'cleaning',       label: '🧹 Уборка / клининг' },
  { value: 'conditioner',    label: '❄️ Кондиционер / вентиляция' },
  { value: 'appliances',     label: '🔌 Подключение бытовой техники' },
  { value: 'garden',         label: '🌳 Двор / газон / ландшафт' },
  { value: 'earthworks',     label: '🚜 Земляные работы / экскаватор' },
  { value: 'security',       label: '📹 Видеонаблюдение / сигнализация' },
  { value: 'design',         label: '✏️ Дизайн-проект интерьера' },
  { value: 'moving',         label: '🚚 Переезд / грузчики' },
];

function buildGenericClarifyingQuestions(): ClarifyingQuestion[] {
  return [
    {
      id: 'scope',
      type: 'multiselect',
      question: 'Какие направления работ нужны? (выберите все подходящие)',
      hint: 'Чем точнее перечислите, тем точнее будет смета',
      options: SCOPE_OPTIONS,
    },
    {
      id: 'rooms',
      type: 'multiselect',
      question: 'В каких помещениях будут работы?',
      options: [
        { value: 'bathroom',  label: 'Ванная / туалет' },
        { value: 'kitchen',   label: 'Кухня' },
        { value: 'living',    label: 'Жилая комната' },
        { value: 'hallway',   label: 'Прихожая / коридор' },
        { value: 'balcony',   label: 'Балкон / лоджия' },
        { value: 'outdoor',   label: 'Двор / улица / фасад' },
        { value: 'whole',     label: 'Вся квартира / дом' },
      ],
    },
    {
      id: 'urgency',
      type: 'select',
      question: 'Насколько срочно нужно выполнить?',
      options: [
        { value: 'today',  label: 'Сегодня — аварийная ситуация' },
        { value: 'week',   label: 'На этой неделе' },
        { value: 'month',  label: 'В течение месяца' },
        { value: 'flex',   label: 'Не срочно, гибкие сроки' },
      ],
    },
    {
      id: 'details',
      type: 'text',
      question: 'Опишите подробнее, что не работает или что нужно установить',
      placeholder: 'Например: течёт смеситель в ванной, не работает розетка на кухне, нужно покрасить две комнаты',
    },
  ];
}

export class InstantOrderService {
  /**
   * AI-анализ фотографий и описания → 3 варианта (Good / Better / Best)
   */
  async analyzePhotos(userId: string, data: {
    images: string[];
    description?: string;
    voiceText?: string;
    categoryId?: string;
    categoryIds?: string[];
    latitude?: number;
    longitude?: number;
  }) {
    const { images, description, voiceText, categoryId, categoryIds } = data;
    // Нормализуем явный выбор категорий: единый массив без дублей
    const explicitIds = Array.from(
      new Set([...(categoryIds || []), ...(categoryId ? [categoryId] : [])].filter(Boolean))
    );

    if (!images || images.length === 0) {
      throw ApiError.badRequest('Необходимо загрузить хотя бы 1 фото');
    }
    if (images.length > 10) {
      throw ApiError.badRequest('Максимум 10 фотографий');
    }

    // Объединяем описание из голоса и текста
    const combinedDescription = [voiceText, description].filter(Boolean).join('. ');

    if (!combinedDescription && explicitIds.length === 0) {
      throw ApiError.badRequest('Опишите что нужно сделать (голосом или текстом) или выберите категорию');
    }

    // ═══════════════════════════════════════════════════════════════════
    // СТРАТЕГИЯ ОПРЕДЕЛЕНИЯ КАТЕГОРИЙ:
    //  • explicitIds (массив) передан → клиент выбрал N категорий вручную
    //  • описание длинное и keyword-detect нашёл ≥1 → одна или несколько категорий
    //  • описание короткое/мутное → возвращаем уточняющие вопросы (без вариантов)
    //  • найдено 0 категорий       → возвращаем уточняющие вопросы
    // ═══════════════════════════════════════════════════════════════════

    const categoryInclude = {
      subcategories: {
        where: { isActive: true },
        include: {
          tasks: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },
    };

    let detectedCategories: any[] = [];

    if (explicitIds.length > 0) {
      const explicit = await prisma.category.findMany({
        where: { id: { in: explicitIds }, isActive: true },
        include: categoryInclude,
      });
      // Сохраняем порядок, в котором клиент перечислил категории
      detectedCategories = explicitIds
        .map((id) => explicit.find((c) => c.id === id))
        .filter(Boolean) as any[];
    } else if (combinedDescription) {
      const allCategoriesActive = await prisma.category.findMany({
        where: { isActive: true },
        include: categoryInclude,
      });
      detectedCategories = this.detectCategories(combinedDescription, allCategoriesActive);
    }

    // ─── Если ничего не нашли или описание мутное → задаём вопросы ───
    const needsClarification =
      detectedCategories.length === 0 ||
      (combinedDescription.length < MIN_CLEAR_DESCRIPTION_LEN && explicitIds.length === 0);

    if (needsClarification) {
      logger.info(
        { descriptionLen: combinedDescription.length, detected: detectedCategories.length },
        'AI-анализ: недостаточно деталей → возвращаем уточняющие вопросы'
      );
      return {
        needsClarification: true,
        clarifyingQuestions: buildGenericClarifyingQuestions(),
        message:
          detectedCategories.length === 0
            ? 'Не удалось точно определить характер работ. Ответьте на пару вопросов — соберём точную смету.'
            : 'Опишите задачу подробнее, чтобы смета была точной.',
        partialMatches: detectedCategories.slice(0, 5).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      };
    }

    // ─── Если найдено НЕСКОЛЬКО категорий → строим мульти-смету ────
    if (detectedCategories.length > 1) {
      return await this.buildMultiCategoryAnalysis(
        userId,
        detectedCategories,
        combinedDescription,
        images
      );
    }

    // ─── Одна категория (классический путь) ─────────────────────────
    const category = detectedCategories[0];

    // ─── Собираем все доступные задачи (с инфо о подкатегории/категории) ─────
    const allTasks = (category.subcategories || []).flatMap((sub: any) =>
      (sub.tasks || []).map((t: any) => ({
        ...t,
        categoryId: category.id,
        categoryName: category.name,
        subcategoryName: sub.name,
      }))
    );

    if (allTasks.length === 0) {
      logger.warn({ categoryId: category.id, categoryName: category.name }, 'AI-анализ: в категории нет задач');
      throw ApiError.badRequest(
        `В категории "${category.name}" пока нет доступных услуг. ` +
        `Администратор должен добавить задачи в каталог. Попробуйте другую категорию.`
      );
    }

    // ─── УМНЫЙ AI-анализ: сначала каталог расценок, потом fallback ──
    let analysisResult: any;
    const smartResult = buildSmartVariants(category.slug, category.name, combinedDescription);

    if (smartResult) {
      // Умный каталог нашёл конкретную проблему → точные цены Ташкента 2026
      logger.info(
        { categorySlug: category.slug, problem: smartResult.problemName },
        'AI-анализ: найдена проблема в каталоге расценок'
      );

      // Подбираем taskIds из БД-задач по ключевым словам решения
      analysisResult = {
        variants: smartResult.variants.map((v: any) => {
          // Ищем подходящие задачи из каталога для привязки
          const matchedTaskIds = this.matchTasksToSolution(allTasks, v.title, v.description);
          return {
            tier: v.tier,
            tierLabel: v.tierLabel,
            taskIds: matchedTaskIds.length > 0 ? matchedTaskIds : [allTasks[0]?.id].filter(Boolean),
            materials: v.materials.map((m: any) => ({
              name: m.name,
              quantity: m.qty,
              unit: m.unit,
              unitPrice: m.unitPrice,
              total: m.total,
            })),
            estimatedPrice: v.estimatedPrice,
            estimatedDays: v.estimatedDays,
            confidence: v.confidence,
            description: `${v.title}. ${v.description}`,
          };
        }),
      };
    } else {
      // Fallback: старая логика на основе задач из каталога
      logger.info(
        { categorySlug: category.slug },
        'AI-анализ: проблема не найдена в каталоге, используем fallback'
      );
      analysisResult = this.generateVariantsFallback(category, allTasks, combinedDescription, images);
    }

    // Сохраняем шаблоны в БД
    let templates;
    try {
      templates = await Promise.all(
        analysisResult.variants.map(async (variant: any) => {
          return prisma.aiOrderTemplate.create({
            data: {
              categoryId: category.id,
              tier: variant.tier as AiTierType,
              tierLabel: variant.tierLabel,
              taskIds: variant.taskIds,
              materials: variant.materials,
              estimatedPrice: Math.min(Math.round(variant.estimatedPrice), 9_999_999_999),
              estimatedDays: variant.estimatedDays,
              confidence: variant.confidence,
              prompt: (combinedDescription || '').substring(0, 2000),
              imageAnalysis: { imageCount: images.length, description: (combinedDescription || '').substring(0, 500) },
              description: (variant.description || '').substring(0, 2000),
              createdById: userId,
            },
          });
        })
      );
    } catch (dbError: any) {
      logger.error(
        { error: dbError?.message, code: dbError?.code, meta: dbError?.meta, stack: dbError?.stack?.substring(0, 500) },
        'Ошибка сохранения AI-шаблона в БД'
      );
      // Prisma P2021 = table does not exist, P2002 = unique constraint
      if (dbError?.code === 'P2021') {
        throw ApiError.badRequest('Таблица AI-шаблонов не создана. Необходимо выполнить миграцию БД.');
      }
      const detail = dbError?.meta?.cause || dbError?.code || dbError?.message || 'Unknown DB error';
      throw ApiError.badRequest(`Ошибка при создании вариантов (${detail}). Попробуйте ещё раз.`);
    }

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
      detectedFromPhoto: explicitIds.length === 0,
      detectedCategories: [
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          nameUz: category.nameUz,
          nameEn: category.nameEn,
          icon: category.icon,
        },
      ],
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
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        subcategoryName: t.subcategoryName,
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
    const effectivePrice = moneyMul(toNum(template.estimatedPrice), urgentMultiplier);

    // Комиссии
    const workCommission = calculateCommission(effectivePrice, commissionRate);
    const visitFeeCommission = calculateCommission(visitFee, visitFeeCommissionRate);
    const commissionAmount = moneyAdd(workCommission, visitFeeCommission);

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
          status: OrderStatus.PUBLISHED,
          isUrgent,
          urgentMultiplier,
          // AI-специфичные поля
          isInstantAiOrder: true,
          aiTemplateId: template.id,
          additionalWishes: data.additionalWishes || null,
          moderationRequired: false,
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
        { orderId: order.id, clientId, tier: template.tier, price: effectivePrice },
        '🚀 Instant AI Order создан'
      );

      // Уведомляем мастеров о новом заказе
      notificationService.notifyMastersNewOrder(order.id).catch((err) => {
        logger.error({ error: err }, 'Ошибка уведомления мастеров');
      });

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
      if (toNum(order.escrowAmount) > 0) {
        await prisma.user.update({
          where: { id: order.clientId },
          data: { balance: { increment: toNum(order.escrowAmount) } },
        });
      }

      logger.info({ orderId, moderatorId, note }, 'AI-заказ отклонён модератором');
    }

    return { orderId, approved, note };
  }

  // ─── Приватные методы ──────────────────────────

  /**
   * Сборка сметы для НЕСКОЛЬКИХ направлений сразу.
   *
   * Алгоритм:
   * 1. Для каждой найденной категории строим её собственный набор вариантов
   *    (через buildSmartVariants → fallback). Берём BEST per-категория для самой полной картины.
   * 2. Объединяем результаты в 3 уровня:
   *    GOOD    = сумма GOOD по всем категориям (минимально достаточно)
   *    BETTER  = сумма BETTER (рекомендуем)
   *    BEST    = сумма BEST (всё с премиум-материалами)
   * 3. taskIds объединяются, materials конкатенируются.
   * 4. Сохраняем шаблоны в БД как обычно (categoryId — самая весомая = первая).
   */
  private async buildMultiCategoryAnalysis(
    userId: string,
    categories: any[],
    description: string,
    images: string[]
  ) {
    type SubVariant = {
      tier: AiTierType;
      tierLabel: string;
      taskIds: string[];
      materials: any[];
      estimatedPrice: number;
      estimatedDays: number;
      confidence: number;
      description: string;
    };
    type CategoryBundle = {
      category: any;
      variants: Record<AiTierType, SubVariant>;
    };

    const bundles: CategoryBundle[] = [];

    for (const cat of categories) {
      const tasks = cat.subcategories?.flatMap((s: any) => s.tasks || []) || [];
      if (tasks.length === 0) continue;

      const smart = buildSmartVariants(cat.slug, cat.name, description);
      let perTier: Record<AiTierType, SubVariant>;

      if (smart) {
        perTier = {
          GOOD: this.smartToSubVariant(smart.variants.find((v: any) => v.tier === 'GOOD'), tasks),
          BETTER: this.smartToSubVariant(smart.variants.find((v: any) => v.tier === 'BETTER'), tasks),
          BEST: this.smartToSubVariant(smart.variants.find((v: any) => v.tier === 'BEST'), tasks),
        } as any;
      } else {
        const fb = this.generateVariantsFallback(cat, tasks, description, images);
        perTier = {
          GOOD: fb.variants[0] as SubVariant,
          BETTER: fb.variants[1] as SubVariant,
          BEST: fb.variants[2] as SubVariant,
        };
      }

      bundles.push({ category: cat, variants: perTier });
    }

    if (bundles.length === 0) {
      throw ApiError.badRequest('Не удалось построить смету — в выбранных направлениях пока нет услуг.');
    }

    const primary = bundles[0].category;

    // ─── Объединяем по уровням ──────────────────────────────
    const merge = (tier: AiTierType): SubVariant => {
      const subs = bundles.map((b) => b.variants[tier]).filter(Boolean);
      const taskIds = Array.from(new Set(subs.flatMap((s) => s.taskIds)));
      const materials = subs.flatMap((s) => s.materials);
      const estimatedPrice = subs.reduce((sum, s) => sum + s.estimatedPrice, 0);
      const estimatedDays = Math.max(...subs.map((s) => s.estimatedDays || 1));
      const confidence = subs.reduce((sum, s) => sum + s.confidence, 0) / subs.length;
      const dirs = bundles.map((b) => b.category.name).join(', ');
      const tierLabel = TIER_MULTIPLIERS[tier].label;
      const desc =
        tier === 'GOOD'
          ? `Базовый объём по ${bundles.length} направлениям: ${dirs}. Минимально необходимые работы и расходники.`
          : tier === 'BETTER'
          ? `Оптимальный пакет по ${bundles.length} направлениям: ${dirs}. Рекомендуемое соотношение качество/цена.`
          : `Премиум-пакет: всё по ${bundles.length} направлениям (${dirs}) + лучшие материалы и расширенная гарантия.`;
      return {
        tier,
        tierLabel,
        taskIds,
        materials,
        estimatedPrice,
        estimatedDays,
        confidence,
        description: desc,
      };
    };

    const merged: SubVariant[] = [merge('GOOD'), merge('BETTER'), merge('BEST')];

    // ─── Сохраняем шаблоны (categoryId = primary) ────────────
    let templates;
    try {
      templates = await Promise.all(
        merged.map(async (variant) =>
          prisma.aiOrderTemplate.create({
            data: {
              categoryId: primary.id,
              tier: variant.tier as AiTierType,
              tierLabel: variant.tierLabel,
              taskIds: variant.taskIds,
              materials: variant.materials,
              estimatedPrice: Math.min(Math.round(variant.estimatedPrice), 9_999_999_999),
              estimatedDays: variant.estimatedDays,
              confidence: variant.confidence,
              prompt: description.substring(0, 2000),
              imageAnalysis: {
                imageCount: images.length,
                description: description.substring(0, 500),
                multiCategory: true,
                categorySlugs: bundles.map((b) => b.category.slug),
              },
              description: variant.description.substring(0, 2000),
              createdById: userId,
            },
          })
        )
      );
    } catch (dbError: any) {
      logger.error({ err: dbError }, 'Ошибка сохранения мульти-AI-шаблона');
      throw ApiError.badRequest('Не удалось сохранить варианты, попробуйте ещё раз');
    }

    logger.info(
      { userId, count: bundles.length, slugs: bundles.map((b) => b.category.slug) },
      'AI-анализ: мульти-категория, сборка завершена'
    );

    const allTasks = bundles.flatMap((b) =>
      (b.category.subcategories || []).flatMap((s: any) =>
        (s.tasks || []).map((t: any) => ({
          ...t,
          categoryId: b.category.id,
          categoryName: b.category.name,
          subcategoryName: s.name,
        }))
      )
    );

    return {
      category: {
        id: primary.id,
        name: primary.name,
        nameUz: primary.nameUz,
        nameEn: primary.nameEn,
        slug: primary.slug,
      },
      detectedFromPhoto: true,
      detectedCategories: bundles.map((b) => ({
        id: b.category.id,
        name: b.category.name,
        slug: b.category.slug,
        nameUz: b.category.nameUz,
        nameEn: b.category.nameEn,
        icon: b.category.icon,
      })),
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
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        subcategoryName: t.subcategoryName,
      })),
    };
  }

  /**
   * Преобразование одного решения из buildSmartVariants в SubVariant.
   */
  private smartToSubVariant(v: any, tasks: any[]): any {
    if (!v) {
      const fallback = tasks[0];
      return {
        tier: 'GOOD',
        tierLabel: TIER_MULTIPLIERS.GOOD.label,
        taskIds: fallback ? [fallback.id] : [],
        materials: [],
        estimatedPrice: 100000,
        estimatedDays: 1,
        confidence: 0.7,
        description: 'Базовый набор работ',
      };
    }
    const matched = this.matchTasksToSolution(tasks, v.title, v.description);
    return {
      tier: v.tier,
      tierLabel: v.tierLabel,
      taskIds: matched.length > 0 ? matched : tasks[0] ? [tasks[0].id] : [],
      materials: (v.materials || []).map((m: any) => ({
        name: m.name,
        quantity: m.qty,
        unit: m.unit,
        unitPrice: m.unitPrice,
        total: m.total,
      })),
      estimatedPrice: v.estimatedPrice,
      estimatedDays: v.estimatedDays,
      confidence: v.confidence,
      description: `${v.title}. ${v.description}`,
    };
  }


  /**
   * Определение ОДНОЙ категории — обёртка над detectCategories для обратной совместимости.
   */
  private detectCategory(description: string, categories: any[]): any | null {
    const list = this.detectCategories(description, categories);
    return list[0] || null;
  }

  /**
   * Определение ВСЕХ направлений работ, упомянутых в описании.
   * Возвращает массив категорий, отсортированный по убыванию score (≥ 1).
   *
   * Это позволяет поддержать сценарий, когда пользователь перечисляет
   * несколько проблем сразу: «сантехника, электрика, окно, мебель» → 4 категории.
   */
  private detectCategories(description: string, categories: any[]): any[] {
    const lower = description.toLowerCase();

    const keywords: Record<string, { exact: string[]; partial: string[] }> = {
      'plumbing': {
        exact: ['сантехник', 'сантехника', 'водопровод', 'канализация', 'унитаз', 'раковина', 'ванна', 'душевая', 'бойлер', 'радиатор', 'отопление', 'счётчик воды', 'фильтр воды', 'биде', 'джакузи', 'сифон', 'стиральная', 'посудомоечная'],
        partial: ['труб', 'кран', 'течь', 'течёт', 'потекл', 'протечк', 'засор', 'смесител', 'слив', 'водонагреват', 'тёплый пол', 'промывк', 'прочист'],
      },
      'electrical': {
        exact: ['электрик', 'электрика', 'проводка', 'розетка', 'выключатель', 'люстра', 'светильник', 'щиток', 'автомат', 'диммер', 'led', 'датчик движения'],
        partial: ['розетк', 'выключател', 'провод', 'свет', 'люстр', 'замыкан', 'счётчик', 'электр', 'ламп', 'точечн', 'кабель', 'подсветк', 'короткое', 'пробк', 'вырубил', 'пропал свет', 'не горит', 'не работает розетк'],
      },
      'furniture': {
        exact: ['мебель', 'мебельщик', 'шкаф', 'кухня', 'диван', 'кровать', 'комод', 'полка', 'стеллаж', 'тумба', 'гардероб'],
        partial: ['мебел', 'мебельщ', 'шкаф', 'стол', 'стул', 'кухн', 'полк', 'сборк', 'диван', 'кроват', 'ящик', 'фурнитур', 'петл', 'дверц', 'фасад'],
      },
      'construction': {
        exact: ['кладка', 'фундамент', 'стяжка', 'перегородка', 'газоблок', 'кирпич', 'бетон', 'арматура', 'опалубка', 'ремонт квартиры', 'ремонт дома', 'капитальный ремонт', 'косметический ремонт'],
        partial: ['стройк', 'кладк', 'стен', 'фундамент', 'бетон', 'кирпич', 'перегородк', 'газоблок', 'штукатурк', 'стяжк', 'демонтаж стен', 'снос', 'капремонт', 'ремонт квартир'],
      },
      'painting': {
        exact: ['покраска', 'штукатурка', 'шпаклёвка', 'шпатлёвка', 'обои', 'грунтовка', 'отделка', 'декоративная штукатурка'],
        partial: ['покраск', 'штукатурк', 'обо', 'шпаклёвк', 'шпатлёвк', 'отделк', 'грунтовк', 'потолок', 'побелк', 'краск', 'красить', 'поклеить', 'поклейк', 'выровнять стен'],
      },
      'windows-doors': {
        exact: ['окно', 'окна', 'дверь', 'двери', 'балкон', 'стеклопакет', 'москитная сетка', 'подоконник', 'откос', 'замок', 'ручка двери'],
        partial: ['окн', 'дверь', 'двер', 'балкон', 'стеклопакет', 'замок', 'петл', 'москитн', 'подоконник', 'откос', 'остеклен', 'заклинил', 'не открывается', 'не закрывается'],
      },
      'cleaning': {
        exact: ['уборка', 'клининг', 'дезинфекция', 'химчистка', 'мойка окон', 'генеральная уборка', 'уборка после ремонта'],
        partial: ['уборк', 'клининг', 'чистк', 'мойк', 'пыл', 'дезинфекц', 'химчистк', 'помыть', 'вымыть', 'отмыть', 'грязь', 'пятн'],
      },
      'carpentry': {
        exact: ['плотник', 'паркет', 'ламинат', 'вагонка', 'деревянный пол', 'лестница', 'беседка', 'терраса'],
        partial: ['плотник', 'дерев', 'доск', 'парк', 'ламинат', 'вагонк', 'лестниц', 'пол', 'настил', 'циклёвк', 'шлифовк'],
      },
      'roofing': {
        exact: ['крыша', 'кровля', 'кровельщик', 'кровельные работы', 'шифер', 'металлочерепица', 'профнастил', 'мягкая кровля'],
        partial: ['крыш', 'кровл', 'черепиц', 'шифер', 'профнастил', 'водосток', 'мансард', 'стропил'],
      },
      'conditioner': {
        exact: ['кондиционер', 'сплит-система', 'вентиляция', 'климат', 'фреон'],
        partial: ['кондиционер', 'сплит', 'вентиляц', 'климат', 'охлажд', 'фреон', 'дует', 'не охлаждает', 'заправк', 'холод'],
      },
      'appliances': {
        exact: ['стиральная машина', 'холодильник', 'духовка', 'плита', 'микроволновка', 'посудомоечная', 'бытовая техника'],
        partial: ['стиральн', 'холодильник', 'духовк', 'микроволнов', 'плит', 'машинк', 'техник', 'подключ'],
      },
      'garden': {
        exact: ['газон', 'ландшафт', 'ландшафтный дизайн', 'полив', 'забор', 'ворота', 'навес', 'беседка', 'сад', 'огород'],
        partial: ['газон', 'ландшафт', 'полив', 'забор', 'ворот', 'навес', 'садов', 'участ', 'террас', 'дренаж', 'озеленен'],
      },
      'earthworks': {
        exact: ['экскаватор', 'земляные работы', 'котлован', 'траншея', 'выемка грунта', 'погрузчик', 'бульдозер', 'самосвал'],
        partial: ['экскаватор', 'котлован', 'траншея', 'грунт', 'выемк', 'засыпк', 'планировк участка', 'спецтехник'],
      },
      'security': {
        exact: ['видеонаблюдение', 'домофон', 'сигнализация', 'камера', 'охрана', 'контроль доступа'],
        partial: ['видеонаблюд', 'домофон', 'сигнализац', 'камер', 'охран', 'контроль доступ', 'ip камер'],
      },
      'design': {
        exact: ['дизайн', 'дизайн-проект', 'интерьер', 'визуализация', '3d проект'],
        partial: ['дизайн', 'интерьер', 'визуализац', 'проект', 'планировк', '3d'],
      },
      'moving': {
        exact: ['переезд', 'грузчики', 'доставка мебели', 'транспортировка'],
        partial: ['переезд', 'грузчик', 'перевоз', 'перенос', 'доставк', 'погрузк'],
      },
    };

    const scored: { cat: any; score: number }[] = [];
    for (const cat of categories) {
      const cfg = keywords[cat.slug];
      if (!cfg) continue;
      let score = 0;
      for (const kw of cfg.exact) if (lower.includes(kw)) score += 3;
      for (const kw of cfg.partial) if (lower.includes(kw)) score += 1;
      if (score > 0) scored.push({ cat, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.cat);
  }

  /**
   * Подбор задач из БД-каталога, соответствующих решению из каталога расценок.
   * Используется для привязки реальных task IDs к smart-варианту.
   * 
   * Возвращает только 1 наиболее релевантную задачу (избегаем лишних).
   * Используем строгое совпадение: ищем ТОЧНЫЕ ключевые фразы, а не отдельные слова.
   */
  private matchTasksToSolution(allTasks: any[], solutionTitle: string, _solutionDesc: string): string[] {
    const title = solutionTitle.toLowerCase();
    
    // Извлекаем ключевые фразы из названия решения (целые осмысленные фразы)
    // Например: "Замена повреждённого участка трубы" → ключевая фраза "замен" + "труб"
    const keyPhrases: string[] = [];
    
    // Определяем ключевые слова-маркеры действия
    const actionWords = ['замен', 'ремонт', 'установк', 'монтаж', 'демонтаж', 'чистк', 'уборк', 'поклейк', 'покраск', 'штукатурк', 'укладк'];
    // Определяем ключевые объекты (что именно чинится)
    const objectWords = ['труб', 'кран', 'смесител', 'унитаз', 'сифон', 'канализац', 'розетк', 'выключател', 'проводк',
      'люстр', 'светильник', 'мебел', 'шкаф', 'кухн', 'дверь', 'двер', 'окн', 'стекл',
      'стен', 'потолок', 'потолк', 'пол', 'плитк', 'обо', 'ламинат',
      'стиральн', 'посудомо', 'холодильник', 'кондиционер',
      'газ', 'котёл', 'котел', 'бойлер', 'водонагреват'];
    
    // Находим какие объекты упоминаются в решении
    const matchedObjects = objectWords.filter(obj => title.includes(obj));
    
    if (matchedObjects.length === 0) {
      // Если объект не определён, используем всё название как фразу
      keyPhrases.push(title);
    } else {
      keyPhrases.push(...matchedObjects);
    }
    
    // Оцениваем задачи — но строго: задача должна содержать ТЕ ЖЕ объекты
    const scored = allTasks.map((task: any) => {
      const taskName = (task.name || '').toLowerCase();
      let score = 0;
      
      // Бонус за совпадение объектов — это ГЛАВНЫЙ критерий
      for (const phrase of keyPhrases) {
        if (taskName.includes(phrase)) score += 10;
      }
      
      // Штраф если задача содержит ДРУГИЕ объекты (не из нашего решения)
      const taskObjects = objectWords.filter(obj => taskName.includes(obj));
      for (const obj of taskObjects) {
        if (!matchedObjects.includes(obj) && matchedObjects.length > 0) {
          score -= 5; // Штраф за лишний объект — "Замена сифона" не подходит к "Замена трубы"
        }
      }
      
      return { id: task.id, name: taskName, score };
    });

    // Берём только ОДНУ лучшую задачу с положительным скором
    const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    
    if (best.length > 0) {
      return [best[0].id];
    }
    
    return [];
  }

  /**
   * Fallback: генерация 3 вариантов из доступных задач (когда каталог расценок не нашёл проблему).
   * Умный подбор: сопоставляем задачи с описанием, точный расчёт цен.
   */
  private generateVariantsFallback(category: any, allTasks: any[], description: string, images: string[]) {
    const lower = description.toLowerCase();

    // Стемминг: обрезаем русские окончания для нечёткого поиска
    const stem = (word: string) => word.replace(/(ами|ями|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ие|ые|ую|юю|ого|его|ому|ему|ость|ам|ям|ах|ях|ен|ан|\u0443|ю|а|я|и|ы|о|е|ь)$/i, '');

    // ─── Ранжируем задачи по релевантности к описанию ─────
    const scored = allTasks.map((task: any) => {
      const taskName = (task.name || '').toLowerCase();
      const taskDesc = (task.description || '').toLowerCase();
      let relevance = 0;

      // Проверяем совпадение ключевых слов описания с названием/описанием задачи
      const descWords = lower.split(/\s+/).filter(w => w.length > 2);
      for (const word of descWords) {
        const s = stem(word);
        if (s.length >= 3 && taskName.includes(s)) relevance += 3;
        if (s.length >= 3 && taskDesc.includes(s)) relevance += 1;
      }
      // Проверяем обратное: корни слов задачи в описании пользователя
      const taskWords = taskName.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of taskWords) {
        const s = stem(word);
        if (s.length >= 3 && lower.includes(s)) relevance += 2;
      }

      return { task, relevance, price: Number(task.minPrice) || 50000 };
    });

    // Сортируем: сначала по релевантности (desc), потом по цене (asc)
    scored.sort((a, b) => b.relevance - a.relevance || a.price - b.price);

    // Берём наиболее релевантные задачи (макс 8 — чтобы цена не улетала)
    const relevant = scored.filter(s => s.relevance > 0);
    const topTasks = (relevant.length > 0 ? relevant : scored).slice(0, 8);

    // GOOD: 1-2 самые релевантные задачи (минимальный объём)
    const goodCount = Math.max(1, Math.min(2, Math.ceil(topTasks.length * 0.3)));
    const goodTasks = topTasks.slice(0, goodCount).map(s => s.task);

    // BETTER: 2-3 задачи (оптимальный объём)
    const betterCount = Math.max(2, Math.min(3, Math.ceil(topTasks.length * 0.5)));
    const betterTasks = topTasks.slice(0, betterCount).map(s => s.task);

    // BEST: до 5 наиболее релевантных задач
    const bestCount = Math.min(5, topTasks.length);
    const bestTasks = topTasks.slice(0, bestCount).map(s => s.task);

    // ─── Точный расчёт стоимости ─────────────────────────
    const calculateWorkPrice = (tasks: any[]) =>
      tasks.reduce((sum: number, t: any) => sum + (Number(t.minPrice) || 50000), 0);

    const calculateDays = (tasks: any[], multiplier: number) => {
      // Парсим estimatedTime: "30-60 мин" → 0.75 часа → 0.1 дня
      const totalHours = tasks.reduce((sum: number, t: any) => {
        const time = (t.estimatedTime || '1 час').toLowerCase();
        const hourMatch = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*час/);
        const minMatch = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*мин/);
        if (hourMatch) {
          const avg = hourMatch[2] ? (parseInt(hourMatch[1]) + parseInt(hourMatch[2])) / 2 : parseInt(hourMatch[1]);
          return sum + avg;
        }
        if (minMatch) {
          const avg = minMatch[2] ? (parseInt(minMatch[1]) + parseInt(minMatch[2])) / 2 : parseInt(minMatch[1]);
          return sum + avg / 60;
        }
        return sum + 1;
      }, 0);

      return Math.max(1, Math.ceil((totalHours / 6) * multiplier)); // 6 рабочих часов в дне
    };

    // Материалы — зависят от типа работ и уровня
    const generateMaterials = (tasks: any[], tier: string) => {
      const workPrice = calculateWorkPrice(tasks);
      const materials: any[] = [];

      // Базовые расходники: 5% от стоимости работ
      const baseAmount = Math.round(workPrice * 0.05);
      materials.push({
        name: 'Расходные материалы',
        quantity: 1, unit: 'компл.',
        unitPrice: baseAmount, total: baseAmount,
      });

      if (tier === 'BETTER' || tier === 'BEST') {
        // Качественные материалы: 8% от стоимости работ
        const qualityAmount = Math.round(workPrice * 0.08);
        materials.push({
          name: 'Качественные комплектующие',
          quantity: 1, unit: 'компл.',
          unitPrice: qualityAmount, total: qualityAmount,
        });
      }

      if (tier === 'BEST') {
        // Премиум материалы: 10% от стоимости работ
        const premiumAmount = Math.round(workPrice * 0.10);
        materials.push({
          name: 'Премиум материалы и гарантия',
          quantity: 1, unit: 'компл.',
          unitPrice: premiumAmount, total: premiumAmount,
        });
      }

      return materials;
    };

    // Итоговая цена = работа * tier_multiplier + материалы
    const buildVariant = (tasks: any[], tier: keyof typeof TIER_MULTIPLIERS) => {
      const workPrice = calculateWorkPrice(tasks);
      const materials = generateMaterials(tasks, tier);
      const materialsPrice = materials.reduce((sum: number, m: any) => sum + m.total, 0);
      const estimatedPrice = Math.round(workPrice * TIER_MULTIPLIERS[tier].price + materialsPrice);

      return {
        tier,
        tierLabel: TIER_MULTIPLIERS[tier].label,
        taskIds: tasks.map((t: any) => t.id),
        materials,
        estimatedPrice,
        estimatedDays: calculateDays(tasks, TIER_MULTIPLIERS[tier].days),
        confidence: tier === 'GOOD' ? 0.85 : tier === 'BETTER' ? 0.92 : 0.97,
        description:
          tier === 'GOOD'
            ? `Базовый ремонт: ${tasks.length} ${this.pluralize(tasks.length, 'работа', 'работы', 'работ')}. Стандартные материалы. Стоимость: ${estimatedPrice.toLocaleString('ru')} сум.`
            : tier === 'BETTER'
            ? `Оптимальный вариант: ${tasks.length} ${this.pluralize(tasks.length, 'работа', 'работы', 'работ')}. Качественные комплектующие, лучшее соотношение цена/качество.`
            : `Премиум решение: ${tasks.length} ${this.pluralize(tasks.length, 'работа', 'работы', 'работ')}. Все задачи + лучшие материалы. Расширенная гарантия.`,
      };
    };

    return {
      variants: (() => {
        const good = buildVariant(goodTasks, 'GOOD');
        const better = buildVariant(betterTasks, 'BETTER');
        const best = buildVariant(bestTasks, 'BEST');

        // Защита: BETTER не более 2x от GOOD, BEST не более 3x от GOOD
        const maxBetter = Math.round(good.estimatedPrice * 2);
        const maxBest = Math.round(good.estimatedPrice * 3);
        if (better.estimatedPrice > maxBetter) better.estimatedPrice = maxBetter;
        if (best.estimatedPrice > maxBest) best.estimatedPrice = maxBest;
        // BETTER не может быть дороже BEST
        if (better.estimatedPrice > best.estimatedPrice) {
          better.estimatedPrice = Math.round(best.estimatedPrice * 0.75);
        }

        return [good, better, best];
      })(),
    };
  }

  /** Склонение числительных */
  private pluralize(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (lastDigit > 1 && lastDigit < 5) return few;
    if (lastDigit === 1) return one;
    return many;
  }
}

export const instantOrderService = new InstantOrderService();
