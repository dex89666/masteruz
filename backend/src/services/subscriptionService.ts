// ============================================
// MasterUz — PRO Subscription Service
// ────────────────────────────────────────────
// Управление PRO-подписками мастеров: тарифы, активация, продление,
// trial, реферальный бонус, founder pricing.
//
// Главные точки входа:
//   - getActiveSubscription(userId) — для проверки в feed/commission
//   - startTrial(userId)            — при первой регистрации мастера
//   - purchase(userId, plan, paymentId, amount) — после успешной оплаты
//   - grantReferralBonus(referrerId) — при подписке приведённого мастера
//   - listPlans()                   — публичный прайс
// ============================================

import { MasterPlan, SubscriptionStatus, type MasterSubscription } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { alertRouter } from './alertRouter.js';

// ─── Тарифная сетка ────────────────────────────────
// Все цены в сумах. Длительности — в днях.
export interface PlanDefinition {
  plan: MasterPlan;
  label: string;
  priceSum: number;
  days: number;
  effectivePerMonth: number;
  discountPercent: number; // относительно MONTH
  isFlagship?: boolean;
  isBestValue?: boolean;
}

const MONTH_PRICE = 99_000;
const FIVE_MONTH_PRICE = 300_000;

export const PLANS: Record<Exclude<MasterPlan, 'TRIAL' | 'REFERRAL'>, PlanDefinition> = {
  MONTH: {
    plan: 'MONTH',
    label: 'Месяц',
    priceSum: MONTH_PRICE,
    days: 30,
    effectivePerMonth: MONTH_PRICE,
    discountPercent: 0,
  },
  QUARTER: {
    plan: 'QUARTER',
    label: '3 месяца',
    priceSum: 249_000,
    days: 90,
    effectivePerMonth: 83_000,
    discountPercent: 16,
  },
  FIVE_MONTH: {
    plan: 'FIVE_MONTH',
    label: '5 месяцев',
    priceSum: FIVE_MONTH_PRICE,
    days: 150,
    effectivePerMonth: 60_000,
    discountPercent: 39,
    isFlagship: true,
  },
  YEAR: {
    plan: 'YEAR',
    label: 'Год',
    priceSum: 590_000,
    days: 365,
    effectivePerMonth: 49_000,
    discountPercent: 51,
    isBestValue: true,
  },
  FOUNDER: {
    plan: 'FOUNDER',
    label: 'Founder (первые 1000) — 5 мес',
    priceSum: 300_000,
    days: 150,
    effectivePerMonth: 60_000,
    discountPercent: 39,
  },
};

const TRIAL_DAYS = Number(process.env.MASTER_TRIAL_DAYS ?? 14);
const REFERRAL_BONUS_DAYS = Number(process.env.MASTER_REFERRAL_BONUS_DAYS ?? 30);
const FOUNDER_QUOTA = Number(process.env.MASTER_FOUNDER_QUOTA ?? 1000);

// ─── API ──────────────────────────────────────────

class SubscriptionService {
  /**
   * Активная подписка = ACTIVE + currentPeriodEnd > now.
   * Возвращает null, если подписки нет.
   */
  async getActiveSubscription(masterId: string): Promise<MasterSubscription | null> {
    return prisma.masterSubscription.findFirst({
      where: {
        masterId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gt: new Date() },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });
  }

  /**
   * Быстрая проверка «активный PRO». Используется в feed-ранжировании и при списании комиссии.
   */
  async isPro(masterId: string): Promise<boolean> {
    const sub = await this.getActiveSubscription(masterId);
    return !!sub;
  }

  /**
   * Список тарифов для публичного API + динамический founder-флаг.
   */
  async listPlans(masterId?: string): Promise<{
    plans: PlanDefinition[];
    founderAvailable: boolean;
    trialAvailable: boolean;
    referralBonusDays: number;
  }> {
    const usedFounderCount = await prisma.masterSubscription.count({
      where: { plan: MasterPlan.FOUNDER },
    });
    const founderAvailable = usedFounderCount < FOUNDER_QUOTA;

    let trialAvailable = false;
    if (masterId) {
      const hadTrial = await prisma.masterSubscription.count({
        where: { masterId, plan: MasterPlan.TRIAL },
      });
      trialAvailable = hadTrial === 0;
    }

    // Если founder ещё доступен — показываем его вместо обычного 5-month.
    const plans = Object.values(PLANS).filter(
      (p) => p.plan !== MasterPlan.FOUNDER || founderAvailable,
    );

    return { plans, founderAvailable, trialAvailable, referralBonusDays: REFERRAL_BONUS_DAYS };
  }

  /**
   * Запуск trial при регистрации мастера. Идемпотентно: повторный вызов = no-op.
   */
  async startTrial(masterId: string): Promise<MasterSubscription | null> {
    const existing = await prisma.masterSubscription.findFirst({
      where: { masterId, plan: MasterPlan.TRIAL },
    });
    if (existing) return existing;

    const now = new Date();
    const end = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);

    const sub = await prisma.masterSubscription.create({
      data: {
        masterId,
        plan: MasterPlan.TRIAL,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    });
    logger.info({ masterId, days: TRIAL_DAYS }, '🎁 Trial PRO активирован');
    return sub;
  }

  /**
   * Покупка платного плана. Вызывается ПОСЛЕ успешной оплаты.
   * - Если уже есть активная подписка → новый период «append'ится» к её концу (накопление).
   * - Срабатывает FINANCE-алерт.
   */
  async purchase(args: {
    masterId: string;
    plan: Exclude<MasterPlan, 'TRIAL' | 'REFERRAL'>;
    paymentId: string;
    amountPaid: number;
  }): Promise<MasterSubscription> {
    const def = PLANS[args.plan];
    if (!def) throw new Error(`Неизвестный план: ${args.plan}`);

    // Founder-квота
    if (args.plan === MasterPlan.FOUNDER) {
      const used = await prisma.masterSubscription.count({ where: { plan: MasterPlan.FOUNDER } });
      if (used >= FOUNDER_QUOTA) {
        throw new Error('Founder-квота исчерпана');
      }
    }

    const active = await this.getActiveSubscription(args.masterId);
    const now = new Date();
    const start = active ? active.currentPeriodEnd : now;
    const end = new Date(start.getTime() + def.days * 86_400_000);

    const sub = await prisma.masterSubscription.create({
      data: {
        masterId: args.masterId,
        plan: args.plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        amountPaid: args.amountPaid,
        paymentId: args.paymentId,
      },
    });

    await alertRouter
      .dispatch({
        type: 'subscription_purchased',
        title: '💎 Новая PRO-подписка',
        message: `Мастер ${args.masterId.slice(0, 8)}… купил план ${def.label} за ${args.amountPaid.toLocaleString('ru-RU')} сум`,
        data: { masterId: args.masterId, plan: args.plan, amount: args.amountPaid },
        forceRoles: ['FINANCE', 'OWNER'],
      })
      .catch((err) => logger.warn({ err }, 'не удалось отправить FINANCE-алерт о покупке PRO'));

    // Реферальный бонус: если этот мастер был приведён другим мастером — начисляем +30 дней PRO рефереру.
    // Только на первую платную покупку, чтобы не накручивали повторно.
    try {
      const referral = await prisma.referral.findFirst({
        where: { referredId: args.masterId, type: 'MASTER_TO_MASTER' },
        orderBy: { createdAt: 'asc' },
      });
      const priorPaidPurchases = await prisma.masterSubscription.count({
        where: {
          masterId: args.masterId,
          plan: { notIn: [MasterPlan.TRIAL, MasterPlan.REFERRAL] },
        },
      });
      if (referral && priorPaidPurchases === 1 /* эта самая, только что */) {
        await this.grantReferralBonus(referral.referrerId, args.masterId);
      }
    } catch (err) {
      logger.warn({ err, masterId: args.masterId }, 'не удалось начислить реферальный бонус PRO');
    }

    logger.info(
      { masterId: args.masterId, plan: args.plan, amount: args.amountPaid, days: def.days },
      '💎 PRO-подписка активирована',
    );
    return sub;
  }

  /**
   * Покупка с внутреннего баланса мастера: атомарное списание + Payment(COMPLETED) + purchase().
   * Используется как простейший канал оплаты (без редиректа на Click/Payme).
   */
  async purchaseFromBalance(args: {
    masterId: string;
    plan: Exclude<MasterPlan, 'TRIAL' | 'REFERRAL'>;
  }): Promise<MasterSubscription> {
    const def = PLANS[args.plan];
    if (!def) throw new Error(`Неизвестный план: ${args.plan}`);

    const payment = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: args.masterId },
        select: { balance: true, role: true },
      });
      if (!user) throw new Error('Пользователь не найден');
      if (user.role !== 'MASTER') throw new Error('Подписка доступна только мастерам');

      const balance = Number(user.balance);
      if (balance < def.priceSum) {
        throw new Error(
          `Недостаточно средств. Баланс: ${balance.toLocaleString('ru-RU')} сум, нужно: ${def.priceSum.toLocaleString('ru-RU')} сум`,
        );
      }

      // Атомарное списание: при гонке двух покупок баланс не уйдёт в минус —
      // updateMany спишет только если средств всё ещё достаточно.
      const charged = await tx.user.updateMany({
        where: { id: args.masterId, balance: { gte: def.priceSum } },
        data: { balance: { decrement: def.priceSum } },
      });
      if (charged.count === 0) {
        throw new Error(
          `Недостаточно средств. Нужно: ${def.priceSum.toLocaleString('ru-RU')} сум`,
        );
      }

      return tx.payment.create({
        data: {
          userId: args.masterId,
          amount: def.priceSum,
          type: 'SUBSCRIPTION',
          provider: 'INTERNAL',
          status: 'COMPLETED',
          metadata: { plan: args.plan, source: 'balance' },
        },
      });
    });

    return this.purchase({
      masterId: args.masterId,
      plan: args.plan,
      paymentId: payment.id,
      amountPaid: def.priceSum,
    });
  }

  /**
   * Бонус +30 дней PRO для приведшего мастера.
   * Безопасно: если активной нет — стартуем с now.
   */
  async grantReferralBonus(referrerId: string, referredId: string): Promise<MasterSubscription> {
    const active = await this.getActiveSubscription(referrerId);
    const now = new Date();
    const start = active ? active.currentPeriodEnd : now;
    const end = new Date(start.getTime() + REFERRAL_BONUS_DAYS * 86_400_000);

    const sub = await prisma.masterSubscription.create({
      data: {
        masterId: referrerId,
        plan: MasterPlan.REFERRAL,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        amountPaid: 0,
        referrerMasterId: referredId,
      },
    });
    logger.info(
      { referrerId, referredId, days: REFERRAL_BONUS_DAYS },
      '🎁 Реферальный бонус PRO выдан',
    );
    return sub;
  }

  // ─── Админ-операции ────────────────────────────
  // Все методы ниже — только для ADMIN, аудит выполняется в admin.routes.

  /**
   * Все подписки конкретного мастера (для админ-карточки).
   */
  async listForMaster(masterId: string): Promise<MasterSubscription[]> {
    return prisma.masterSubscription.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Список всех подписок с фильтрами и пагинацией (для админ-таблицы).
   */
  async adminList(filters: {
    plan?: MasterPlan;
    status?: SubscriptionStatus;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{
    rows: Array<MasterSubscription & {
      master: { id: string; username: string; profile: { firstName: string | null; lastName: string | null } | null };
    }>;
    total: number;
  }> {
    const where: any = {};
    if (filters.plan) where.plan = filters.plan;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.master = {
        OR: [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { profile: { firstName: { contains: filters.search, mode: 'insensitive' } } },
          { profile: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        ],
      };
    }
    const [rows, total] = await Promise.all([
      prisma.masterSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          master: {
            select: {
              id: true,
              username: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.masterSubscription.count({ where }),
    ]);
    return { rows: rows as any, total };
  }

  /**
   * Выдать подписку вручную (без оплаты). Используется для маркетинга, компенсаций, тестов.
   * - Если активная есть → добавляет дни к её концу.
   * - Если plan не указан, по умолчанию `MONTH` с заданным `days` (или 30).
   */
  async adminGrant(args: {
    masterId: string;
    plan: MasterPlan;
    days: number;
    reason?: string;
  }): Promise<MasterSubscription> {
    if (args.days <= 0 || args.days > 3650) {
      throw new Error('Срок должен быть от 1 до 3650 дней');
    }
    const master = await prisma.user.findUnique({
      where: { id: args.masterId },
      select: { id: true, role: true },
    });
    if (!master) throw new Error('Пользователь не найден');
    if (master.role !== 'MASTER') throw new Error('Подписка доступна только мастерам');

    const active = await this.getActiveSubscription(args.masterId);
    const now = new Date();
    const start = active ? active.currentPeriodEnd : now;
    const end = new Date(start.getTime() + args.days * 86_400_000);

    const sub = await prisma.masterSubscription.create({
      data: {
        masterId: args.masterId,
        plan: args.plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        amountPaid: 0,
      },
    });
    logger.info(
      { masterId: args.masterId, plan: args.plan, days: args.days, reason: args.reason },
      '🎫 PRO выдан админом',
    );
    return sub;
  }

  /**
   * Продлить существующую подписку на N дней.
   * Если она EXPIRED — возвращает ACTIVE и пересчитывает period от now.
   */
  async adminExtend(args: {
    subscriptionId: string;
    days: number;
  }): Promise<MasterSubscription> {
    if (args.days <= 0 || args.days > 3650) {
      throw new Error('Срок должен быть от 1 до 3650 дней');
    }
    const sub = await prisma.masterSubscription.findUnique({
      where: { id: args.subscriptionId },
    });
    if (!sub) throw new Error('Подписка не найдена');

    const now = new Date();
    const baseEnd = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const newEnd = new Date(baseEnd.getTime() + args.days * 86_400_000);

    const updated = await prisma.masterSubscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodEnd: newEnd,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    logger.info(
      { subscriptionId: sub.id, masterId: sub.masterId, days: args.days, newEnd },
      '⏩ PRO-подписка продлена админом',
    );
    return updated;
  }

  /**
   * Отменить подписку (status=CANCELLED, currentPeriodEnd=now). Без возврата средств.
   */
  async adminCancel(args: { subscriptionId: string; reason?: string }): Promise<MasterSubscription> {
    const sub = await prisma.masterSubscription.findUnique({
      where: { id: args.subscriptionId },
    });
    if (!sub) throw new Error('Подписка не найдена');
    if (sub.status === SubscriptionStatus.CANCELLED) return sub;

    const updated = await prisma.masterSubscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        currentPeriodEnd: new Date(),
      },
    });
    logger.info(
      { subscriptionId: sub.id, masterId: sub.masterId, reason: args.reason },
      '⛔ PRO-подписка отменена админом',
    );
    return updated;
  }

  /**
   * Отметить устаревшие подписки EXPIRED. Вызывается из cronCleanup периодически
   * (не критично — getActiveSubscription уже фильтрует по дате).
   */
  async markExpired(): Promise<number> {
    const result = await prisma.masterSubscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    if (result.count > 0) {
      logger.info({ count: result.count }, 'PRO-подписки помечены EXPIRED');
    }
    return result.count;
  }
}

export const subscriptionService = new SubscriptionService();
