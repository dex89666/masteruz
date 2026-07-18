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
  commissionRate: 'commission_rate', // % — базовая ставка (legacy fallback)
  firstOrderCommissionRate: 'first_order_commission_rate', // % — для первого заказа клиент-мастер (защита от увода)
  repeatOrderCommissionRate: 'repeat_order_commission_rate', // % — для повторных заказов
  newbieMaxPriceRatio: 'newbie_max_price_ratio',

  // ─── Ступенчатая комиссия (от стоимости работ) ───
  // РАСТУЩАЯ модель в диапазоне 15–20%: ставка растёт вместе с суммой,
  // т.к. ценность эскроу-защиты выше на крупных заказах.
  // Все ступени и пороги настраиваются в админке без релиза.
  commissionTierSmall: 'commission_tier_small',   // % для price < tierSmallMax (минимум платформы)
  commissionTierMid: 'commission_tier_mid',       // % для tierSmallMax ≤ price < tierMidMax
  commissionTierLarge: 'commission_tier_large',   // % для tierMidMax ≤ price < tierLargeMax
  commissionTierXL: 'commission_tier_xl',         // % для price ≥ tierLargeMax (максимум)
  commissionTierSmallMax: 'commission_tier_small_max', // сум
  commissionTierMidMax: 'commission_tier_mid_max',     // сум
  commissionTierLargeMax: 'commission_tier_large_max', // сум

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

  // ─── Модель оплаты «30% депозит + 70% при завершении» ───
  depositRate: 'deposit_rate',                       // % от полной стоимости (0..100). Default 30.
  falseDisputePenalty: 'false_dispute_penalty',      // штраф клиенту за ложный диспут после CASH (в сум).

  // ─── Вывод средств мастером ───
  withdrawalMinAmount: 'withdrawal_min_amount',       // сум — минимальная сумма заявки
  withdrawalCommissionRate: 'withdrawal_commission_rate', // % — удержание за вывод
  withdrawalEnabled: 'withdrawal_enabled',            // 'true' / 'false'

  // ─── Изменение цены по ходу работ ───
  // Мастер может предложить новую цену (доп. работы / уточнение объёма).
  // Любое изменение требует ЯВНОГО подтверждения клиента.
  priceChangeLimitPct: 'price_change_limit_pct',     // % — макс. рост цены за одно изменение без модерации админом.
  priceChangeMaxTotalPct: 'price_change_max_total_pct', // % — макс. суммарный рост от изначальной цены.
} as const;

/** Дефолтные значения (используются, если ключа нет в БД). */
const DEFAULTS: Record<string, string> = {
  [PLATFORM_CONFIG_KEYS.commissionRate]: '15',
  [PLATFORM_CONFIG_KEYS.firstOrderCommissionRate]: '5', // надбавка к ступени для первого заказа клиент↔мастер
  [PLATFORM_CONFIG_KEYS.repeatOrderCommissionRate]: '0', // надбавки нет
  [PLATFORM_CONFIG_KEYS.newbieMaxPriceRatio]: '1.5',
  // ─── Ступени комиссии (РАСТУЩАЯ модель) ───
  // Рабочий диапазон платформы — 15–20%. Ставка растёт вместе с суммой:
  // на крупных заказах ценность эскроу-защиты выше (обе стороны боятся кидка).
  // Все ступени настраиваются в админке без релиза.
  [PLATFORM_CONFIG_KEYS.commissionTierSmall]: '15',  // price < 100k  → 15%
  [PLATFORM_CONFIG_KEYS.commissionTierMid]: '16',    // 100k–300k     → 16%
  [PLATFORM_CONFIG_KEYS.commissionTierLarge]: '18',  // 300k–800k     → 18%
  [PLATFORM_CONFIG_KEYS.commissionTierXL]: '20',     // ≥ 800k        → 20%
  [PLATFORM_CONFIG_KEYS.commissionTierSmallMax]: '100000',
  [PLATFORM_CONFIG_KEYS.commissionTierMidMax]: '300000',
  [PLATFORM_CONFIG_KEYS.commissionTierLargeMax]: '800000',
  // Выезд мастера — фиксированная плата. Меняется админом без релиза.
  [PLATFORM_CONFIG_KEYS.visitFee]: '100000',
  // Платформа берёт комиссию со ВСЕХ расчётов, включая выезд.
  [PLATFORM_CONFIG_KEYS.visitFeeCommissionRate]: '15',
  [PLATFORM_CONFIG_KEYS.estimationFee]: '150000',
  [PLATFORM_CONFIG_KEYS.estimationCommissionRate]: '20',
  [PLATFORM_CONFIG_KEYS.bypassPenaltyMultiplier]: '3',
  [PLATFORM_CONFIG_KEYS.virtualNumbersEnabled]: 'false',
  [PLATFORM_CONFIG_KEYS.guaranteeDays]: '30',
  [PLATFORM_CONFIG_KEYS.urgencyMultiplier]: '1.3',
  [PLATFORM_CONFIG_KEYS.depositRate]: '30',
  [PLATFORM_CONFIG_KEYS.falseDisputePenalty]: '50000',
  // Вывод средств: по умолчанию включён и бесплатный — на старте важнее,
  // чтобы мастер видел живые деньги, чем заработать на комиссии за вывод.
  [PLATFORM_CONFIG_KEYS.withdrawalMinAmount]: '50000',
  [PLATFORM_CONFIG_KEYS.withdrawalCommissionRate]: '0',
  [PLATFORM_CONFIG_KEYS.withdrawalEnabled]: 'true',
  // Рост цены до +20% за одно изменение — только согласие клиента.
  // Выше — дополнительно модерация админом (защита от накрутки на месте).
  [PLATFORM_CONFIG_KEYS.priceChangeLimitPct]: '20',
  // Суммарный рост от изначальной цены заказа — не более +50%.
  [PLATFORM_CONFIG_KEYS.priceChangeMaxTotalPct]: '50',
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
 * Базовая ступенчатая комиссия по стоимости работ.
 * Ставка растёт вместе с суммой заказа. Возвращает ставку из 4 ступеней.
 */
export async function getTieredCommissionRate(workPrice: number): Promise<number> {
  const [small, mid, large, xl, smallMax, midMax, largeMax] = await Promise.all([
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierSmall, 15),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierMid, 16),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierLarge, 18),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierXL, 20),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierSmallMax, 100_000),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierMidMax, 300_000),
    getConfigNumber(PLATFORM_CONFIG_KEYS.commissionTierLargeMax, 800_000),
  ]);

  if (workPrice < smallMax) return small;
  if (workPrice < midMax) return mid;
  if (workPrice < largeMax) return large;
  return xl;
}

/**
 * Получить эффективную ставку комиссии для пары клиент-мастер.
 * Первый заказ → повышенная (защита от увода), повторные → базовая/льготная.
 * Если в БД не настроены отдельные ставки first/repeat — используется базовая commission_rate.
 *
 * @deprecated Используйте `getTieredEffectiveCommissionRate(price, clientId, masterId)`.
 *             Эта функция оставлена для обратной совместимости и возвращает
 *             ступенчатую базовую ставку без учёта надбавки за первый заказ.
 */
export async function getEffectiveCommissionRate(
  _clientId: string,
  _masterId: string | null
): Promise<number> {
  return await getConfigNumber(PLATFORM_CONFIG_KEYS.commissionRate);
}

/**
 * Ступенчатая комиссия с учётом истории клиент↔мастер.
 * Базовая ставка определяется ступенью по `workPrice`, поверх неё —
 * надбавка `first_order_commission_rate` для первого заказа этой пары
 * (защита от увода) или `repeat_order_commission_rate` для повторных.
 * Финальная ставка ограничена снизу значением tier XL (минимум платформы).
 */
export async function getTieredEffectiveCommissionRate(
  workPrice: number,
  clientId: string,
  masterId: string | null
): Promise<number> {
  const base = await getTieredCommissionRate(workPrice);
  if (!masterId) return base;

  // PRO-подписка → 0% комиссии (главное преимущество тарифа)
  const { subscriptionService } = await import('./subscriptionService.js');
  if (await subscriptionService.isPro(masterId)) return 0;

  const previousOrders = await prisma.order.count({
    where: { clientId, masterId, status: 'COMPLETED' },
  });

  const surchargeKey = previousOrders === 0
    ? PLATFORM_CONFIG_KEYS.firstOrderCommissionRate
    : PLATFORM_CONFIG_KEYS.repeatOrderCommissionRate;

  const surcharge = await getConfigNumber(surchargeKey, 0);

  // Надбавка за первый заказ пары (защита от увода) добавляется к ступени.
  // Клампим в разумные пределы [0..100], НЕ зажимаем снизу на tier XL —
  // иначе растущая модель сломается (мелкие заказы вернулись бы к 15%).
  return Math.min(100, Math.max(0, base + surcharge));
}

/** Получить дефолтные значения для админки (если ключа ещё нет в БД). */
export function getConfigDefaults(): Record<string, string> {
  return { ...DEFAULTS };
}
