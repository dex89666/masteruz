// ============================================
// MasterUz — Referrals Service
// Агент 7 (Менеджер по монетизации)
// ============================================

import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { ReferralStatus, ReferralType } from '@prisma/client';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { toNum, moneyMul, moneyDiv } from '../../utils/helpers.js';

export class ReferralsService {
  /**
   * Применение реферального кода при регистрации
   */
  async applyReferralCode(userId: string, referralCode: string) {
    // Находим реферера по коду
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      throw ApiError.badRequest('Неверный реферальный код');
    }

    if (referrer.id === userId) {
      throw ApiError.badRequest('Нельзя использовать свой реферальный код');
    }

    // Определяем тип реферала
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('Пользователь не найден');

    const type =
      referrer.role === 'MASTER' && user.role === 'MASTER'
        ? ReferralType.MASTER_TO_MASTER
        : ReferralType.CLIENT_TO_CLIENT;

    // Получаем ставку бонуса из конфигурации
    const bonusRateKey =
      type === ReferralType.MASTER_TO_MASTER
        ? 'referral_master_bonus_rate'
        : 'referral_client_discount_rate';

    const configEntry = await prisma.platformConfig.findUnique({
      where: { key: bonusRateKey },
    });

    const bonusRate = configEntry
      ? parseFloat(configEntry.value)
      : type === ReferralType.MASTER_TO_MASTER
        ? config.platform.defaultReferralMasterBonusRate
        : config.platform.defaultReferralClientDiscountRate;

    // Создаём запись реферала
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: userId,
        type,
        bonusRate,
        status: ReferralStatus.ACTIVE,
      },
    });

    // Обновляем referred_by у пользователя
    await prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    logger.info({ referrerId: referrer.id, referredId: userId, type }, 'Реферал применён');

    return referral;
  }

  /**
   * Получение реферальной ссылки
   */
  async getReferralLink(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) throw ApiError.notFound('Пользователь не найден');

    const telegramBotUrl = `https://t.me/${config.telegram.botUsername}?start=ref_${user.referralCode}`;
    const webUrl = `${config.telegram.miniAppUrl}?ref=${user.referralCode}`;

    return {
      referralCode: user.referralCode,
      telegramLink: telegramBotUrl,
      webLink: webUrl,
    };
  }

  /**
   * Статистика рефералов
   */
  async getReferralStats(userId: string) {
    const [referrals, totalBonus] = await Promise.all([
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referred: {
            include: { profile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.referral.aggregate({
        where: {
          referrerId: userId,
          status: ReferralStatus.PAID,
        },
        _sum: { bonusAmount: true },
      }),
    ]);

    return {
      totalReferrals: referrals.length,
      activeReferrals: referrals.filter((r) => r.status === ReferralStatus.ACTIVE).length,
      totalBonus: totalBonus._sum.bonusAmount || 0,
      referrals,
    };
  }

  /**
   * Начисление реферального бонуса после выполнения заказа
   */
  async processReferralBonus(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { master: true },
    });

    if (!order || !order.master) return;

    // Проверяем, есть ли у мастера реферер
    const referral = await prisma.referral.findFirst({
      where: {
        referredId: order.master.id,
        status: ReferralStatus.ACTIVE,
      },
    });

    if (!referral) return;

    // Начисляем бонус рефереру
    const bonusAmount = moneyDiv(moneyMul(toNum(order.commissionAmount), toNum(referral.bonusRate)), 100);

    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        bonusAmount: { increment: bonusAmount },
      },
    });

    logger.info(
      { referralId: referral.id, bonusAmount, orderId },
      'Реферальный бонус начислен'
    );
  }
}

export const referralsService = new ReferralsService();
