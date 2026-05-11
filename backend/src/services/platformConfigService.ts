import { prisma } from '../config/database';
import logger from '../utils/logger';

/**
 * Централизованный доступ к настройкам платформы.
 * Все финансовые параметры (комиссия, выездная плата, штрафы за обход)
 * читаются отсюда, чтобы админ мог менять их без релиза.
 */

/** Все ключи настроек, которые использует платформа. */
export const PLATFORM_CONFIG_KEYS = {
  // Комиссия с работ
  commissionRate: 'commission_rate', // % — базовая ставка
  firstOrderCommissionRate: 'first_order_commission_rate', // % — для первого заказа клиент-мастер (защита от увода)
  repeatOrderCommissionRate: 'repeat_order_commission_rate', // % — для повторных заказов
  newbieMaxPriceRatio: 'newbie_max_price_ratio',

  // Выезд мастера
  visitFee: 'visit_fee', // сум — фикс. плата за выезд
  visitFeeCommissionRate: 'visit_fee_commission_rate', // % — комиссия с выезда

  // Расчёт на месте
  estimationFee: 'estimation_fee', // сум — фикс. плата за выездной расчёт
  estimationCommissionRate: 'estimation_commission_rate', // %

  // Защита от обхода
  bypassPenaltyMultiplier: 'bypass_penalty_multiplier', // множитель штрафа (например 3 = 3× от стоимости заказа)
  virtualNumbersEnabled: 'virtual_numbers_enabled', // 'true' / 'false' — маскирование телефонов

  // Гарантии
  guaranteeDays: 'guarantee_duration_days',

  // Срочность
  urgencyMultiplier: 'urgency_multiplier',
} as const;

/** Дефолтные значения (используются, если ключа нет в БД). */
const DEFAULTS: Record<string, string> = {
  [PLATFORM_CONFIG_KEYS.commissionRate]: '15',
  [PLATFORM_CONFIG_KEYS.firstOrderCommissionRate]: '20',
  [PLATFORM_CONFIG_KEYS.repeatOrderCommissionRate]: '12',
  [PLATFORM_CONFIG_KEYS.newbieMaxPriceRatio]: '1.5',
  [PLATFORM_CONFIG_KEYS.visitFee]: '100000',
  [PLATFORM_CONFIG_KEYS.visitFeeCommissionRate]: '10',
  [PLATFORM_CONFIG_KEYS.estimationFee]: '150000',
  [PLATFORM_CONFIG_KEYS.estimationCommissionRate]: '20',
  [PLATFORM_CONFIG_KEYS.bypassPenaltyMultiplier]: '3',
  [PLATFORM_CONFIG_KEYS.virtualNumbersEnabled]: 'false',
  [PLATFORM_CONFIG_KEYS.guaranteeDays]: '30',
  [PLATFORM_CONFIG_KEYS.urgencyMultiplier]: '1.3',
};

/** Получить числовое значение настройки. */
export async function getConfigNumber(key: string, fallback?: number): Promise<number> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  const raw = row?.value ?? DEFAULTS[key] ?? (fallback !== undefined ? String(fallback) : null);
  if (raw === null) {
    logger.warn({ key }, 'PlatformConfig: ключ не задан, fallback не предоставлен');
    return 0;
  }
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : (fallback ?? 0);
}

/** Получить булево значение настройки. */
export async function getConfigBool(key: string, fallback = false): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  const raw = row?.value ?? DEFAULTS[key];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

/** Получить строковое значение настройки. */
export async function getConfigString(key: string, fallback = ''): Promise<string> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? fallback;
}

/**
 * Получить эффективную ставку комиссии для пары клиент-мастер.
 * Первый заказ → повышенная (защита от увода), повторные → базовая/льготная.
 * Если в БД не настроены отдельные ставки first/repeat — используется базовая commission_rate.
 */
export async function getEffectiveCommissionRate(
  clientId: string,
  masterId: string | null
): Promise<number> {
  const base = await getConfigNumber(PLATFORM_CONFIG_KEYS.commissionRate);

  if (!masterId) return base;

  // Был ли уже завершённый заказ между этой парой?
  const previousOrders = await prisma.order.count({
    where: {
      clientId,
      masterId,
      status: 'COMPLETED',
    },
  });

  if (previousOrders === 0) {
    // Первый заказ — берём повышенную ставку (защита от увода клиента)
    return await getConfigNumber(PLATFORM_CONFIG_KEYS.firstOrderCommissionRate, base);
  }

  // Повторный — льготная ставка
  return await getConfigNumber(PLATFORM_CONFIG_KEYS.repeatOrderCommissionRate, base);
}

/** Получить дефолтные значения для админки (если ключа ещё нет в БД). */
export function getConfigDefaults(): Record<string, string> {
  return { ...DEFAULTS };
}
