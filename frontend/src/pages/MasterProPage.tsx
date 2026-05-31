// ============================================
// MasterUz — PRO Subscription Page
// Витрина тарифов PRO + покупка с баланса + статус подписки
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, Sparkles, Check, Zap, TrendingUp, Gift, Clock, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  subscriptionsApi,
  balanceApi,
  type SubscriptionPlan,
  type ActiveSubscription,
} from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useFormatPrice } from '../hooks';
import { confirm } from '../store/confirmStore';

const PLAN_PERKS = [
  { icon: TrendingUp, key: 'Топ-выдача в рассылке заказов (+15 к рангу)' },
  { icon: Zap, key: '0% комиссии платформы на все заказы' },
  { icon: Crown, key: 'PRO-бейдж в профиле и карточке' },
  { icon: Clock, key: 'Приоритетное уведомление о новых заказах' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const daysLeft = (endIso: string) =>
  Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / 86_400_000));

export function MasterProPage() {
  const formatPrice = useFormatPrice();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [founderAvailable, setFounderAvailable] = useState(false);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [active, setActive] = useState<ActiveSubscription | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, meRes, balanceRes] = await Promise.all([
        subscriptionsApi.listPlans(),
        subscriptionsApi.me(),
        balanceApi.getBalance(),
      ]);
      setPlans(plansRes.data.data.plans);
      setFounderAvailable(plansRes.data.data.founderAvailable);
      setTrialAvailable(plansRes.data.data.trialAvailable);
      setActive(meRes.data.data.active);
      setBalance(Number(balanceRes.data.data.balance) || 0);
    } catch {
      toast.error('Не удалось загрузить тарифы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function startTrial() {
    setBuying('TRIAL');
    try {
      await subscriptionsApi.startTrial();
      toast.success('🎁 Trial активирован на 14 дней');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Не удалось активировать trial');
    } finally {
      setBuying(null);
    }
  }

  async function buyPlan(plan: SubscriptionPlan) {
    if (balance < plan.priceSum) {
      toast.error('Недостаточно средств на балансе. Сначала пополните кошелёк.');
      return;
    }
    if (!(await confirm({
      title: 'Покупка PRO',
      message: `Купить «${plan.label}» за ${formatPrice(plan.priceSum)} с баланса?`,
      confirmText: 'Купить',
      variant: 'info',
    }))) return;
    setBuying(plan.plan);
    try {
      await subscriptionsApi.purchaseFromBalance(plan.plan);
      toast.success(`💎 PRO «${plan.label}» активирован`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Покупка не удалась');
    } finally {
      setBuying(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }

  const isPro = !!active;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <Breadcrumbs items={[{ label: 'Кабинет', href: '/dashboard' }, { label: 'PRO-подписка' }]} />

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-8 shadow-xl">
        <div className="absolute -right-10 -top-10 opacity-20">
          <Crown size={220} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-100">
            <Sparkles size={18} />
            <span className="text-sm font-medium uppercase tracking-wider">MasterUz PRO</span>
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold">
            {isPro ? 'Вы — PRO мастер' : 'Подключите PRO и опередите конкурентов'}
          </h1>
          <p className="mt-3 text-amber-50 max-w-2xl">
            0% комиссии, топ-выдача в рассылке, приоритетные уведомления — больше заказов, выше доход.
          </p>

          {isPro && active && (
            <div className="mt-5 inline-flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
              <Crown size={20} />
              <div>
                <div className="text-sm opacity-80">Активен план</div>
                <div className="font-semibold">
                  {active.plan} · до {formatDate(active.currentPeriodEnd)} ({daysLeft(active.currentPeriodEnd)} дн.)
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Баланс + CTA пополнить */}
      <section className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
            <Wallet className="text-emerald-600 dark:text-emerald-400" size={22} />
          </div>
          <div>
            <div className="text-xs text-gray-500">Доступно на балансе</div>
            <div className="text-xl font-bold">{formatPrice(balance)}</div>
          </div>
        </div>
        <Link
          to="/balance"
          className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium hover:opacity-90 transition"
        >
          Пополнить баланс
        </Link>
      </section>

      {/* Преимущества */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PLAN_PERKS.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2"
          >
            <div className="p-2 w-fit rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <Icon className="text-amber-600 dark:text-amber-400" size={18} />
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{key}</div>
          </div>
        ))}
      </section>

      {/* Trial CTA */}
      {!isPro && trialAvailable && (
        <section className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className="text-emerald-600 dark:text-emerald-400" size={28} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white">14 дней PRO бесплатно</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Без карты. Активируется в один клик.</div>
            </div>
          </div>
          <button
            onClick={startTrial}
            disabled={buying === 'TRIAL'}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold transition"
          >
            {buying === 'TRIAL' ? '…' : 'Активировать trial'}
          </button>
        </section>
      )}

      {/* Тарифы */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Тарифы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isFlagship = plan.isFlagship;
            const isFounder = plan.plan === 'FOUNDER';
            const cardBase =
              'relative bg-white dark:bg-gray-900 rounded-2xl border p-5 flex flex-col transition';
            const cardEmphasis = isFlagship
              ? 'border-amber-400 dark:border-amber-500 shadow-lg ring-2 ring-amber-400/30'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700';

            return (
              <div key={plan.plan} className={`${cardBase} ${cardEmphasis}`}>
                {isFlagship && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-amber-500 text-white shadow">
                    ХИТ · −{plan.discountPercent}%
                  </span>
                )}
                {isFounder && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-rose-500 text-white shadow">
                    FOUNDER
                  </span>
                )}

                <div className="text-sm text-gray-500 dark:text-gray-400">{plan.label}</div>
                <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(plan.priceSum)}
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  ≈ {formatPrice(plan.effectivePerMonth)}/мес
                </div>

                {plan.discountPercent > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check size={14} /> экономия {plan.discountPercent}%
                  </div>
                )}

                <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> {plan.days} дней PRO</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> 0% комиссии</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> Топ-выдача</li>
                </ul>

                <button
                  onClick={() => buyPlan(plan)}
                  disabled={buying === plan.plan || (isFounder && !founderAvailable)}
                  className={`mt-5 w-full px-4 py-2.5 rounded-xl font-semibold transition disabled:opacity-50 ${
                    isFlagship
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90'
                  }`}
                >
                  {buying === plan.plan ? '…' : 'Купить с баланса'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Реферал-подсказка */}
      {!isPro && (
        <section className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 flex items-center gap-3">
          <Gift className="text-purple-600 dark:text-purple-400 shrink-0" size={24} />
          <div className="text-sm text-gray-800 dark:text-gray-200">
            Пригласите мастера по своей <Link to="/referrals" className="font-semibold underline">реферальной ссылке</Link> — после его первой оплаты вы получите <b>+30 дней PRO</b> бесплатно.
          </div>
        </section>
      )}
    </div>
  );
}
