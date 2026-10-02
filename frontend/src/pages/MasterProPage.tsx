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
import { useTranslation } from '../i18n';

const PLAN_PERKS = [
  { icon: TrendingUp, key: 'masterPro.perkTop' },
  { icon: Zap, key: 'masterPro.perkZero' },
  { icon: Crown, key: 'masterPro.perkBadge' },
  { icon: Clock, key: 'masterPro.perkPriority' },
];

const formatDateIn = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

const daysLeft = (endIso: string) =>
  Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / 86_400_000));

export function MasterProPage() {
  const { t, locale } = useTranslation();
  const formatDate = (iso: string) => formatDateIn(iso, locale);
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
      toast.error(t('masterPro.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function startTrial() {
    setBuying('TRIAL');
    try {
      await subscriptionsApi.startTrial();
      toast.success(`🎁 ${t('masterPro.trialActivated')}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || t('masterPro.trialFailed'));
    } finally {
      setBuying(null);
    }
  }

  async function buyPlan(plan: SubscriptionPlan) {
    if (balance < plan.priceSum) {
      toast.error(t('masterPro.insufficient'));
      return;
    }
    if (!(await confirm({
      title: t('masterPro.buyTitle'),
      message: t('masterPro.buyConfirm', { plan: plan.label, price: formatPrice(plan.priceSum) }),
      confirmText: t('masterPro.buy'),
      variant: 'info',
    }))) return;
    setBuying(plan.plan);
    try {
      await subscriptionsApi.purchaseFromBalance(plan.plan);
      toast.success(`💎 ${t('masterPro.activated', { plan: plan.label })}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || t('masterPro.buyFailed'));
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
      <Breadcrumbs items={[{ label: t('masterPro.cabinet'), href: '/dashboard' }, { label: t('masterPro.subscription') }]} />

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
            {isPro ? t('masterPro.youArePro') : t('masterPro.getPro')}
          </h1>
          <p className="mt-3 text-amber-50 max-w-2xl">
            {t('masterPro.lead')}
          </p>

          {isPro && active && (
            <div className="mt-5 inline-flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
              <Crown size={20} />
              <div>
                <div className="text-sm opacity-80">{t('masterPro.activePlan')}</div>
                <div className="font-semibold">
                  {active.plan} · {t('masterPro.until')} {formatDate(active.currentPeriodEnd)} ({daysLeft(active.currentPeriodEnd)} {t('instant.daysShort')})
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
            <div className="text-xs text-gray-500">{t('masterPro.availableBalance')}</div>
            <div className="text-xl font-bold">{formatPrice(balance)}</div>
          </div>
        </div>
        <Link
          to="/balance"
          className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium hover:opacity-90 transition"
        >
          {t('createOrder.topUp')}
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
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{t(key)}</div>
          </div>
        ))}
      </section>

      {/* Trial CTA */}
      {!isPro && trialAvailable && (
        <section className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className="text-emerald-600 dark:text-emerald-400" size={28} />
            <div>
              <div className="font-bold text-gray-900 dark:text-white">{t('masterPro.trialTitle')}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('masterPro.trialText')}</div>
            </div>
          </div>
          <button
            onClick={startTrial}
            disabled={buying === 'TRIAL'}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold transition"
          >
            {buying === 'TRIAL' ? '…' : t('masterPro.activateTrial')}
          </button>
        </section>
      )}

      {/* Тарифы */}
      <section>
        <h2 className="text-2xl font-bold mb-4">{t('masterPro.plans')}</h2>
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
                    {t('masterPro.hit')} · −{plan.discountPercent}%
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
                  ≈ {formatPrice(plan.effectivePerMonth)}/{t('masterPro.perMonth')}
                </div>

                {plan.discountPercent > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check size={14} /> {t('masterPro.saving')} {plan.discountPercent}%
                  </div>
                )}

                <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> {t('masterPro.daysPro', { n: plan.days })}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> {t('masterPro.zeroCommission')}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-500 mt-0.5 shrink-0" /> {t('masterPro.topListing')}</li>
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
                  {buying === plan.plan ? '…' : t('masterPro.buyFromBalance')}
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
            {t('masterPro.ref1')} <Link to="/referrals" className="font-semibold underline">{t('masterPro.refLink')}</Link> {t('masterPro.ref2')}
          </div>
        </section>
      )}
    </div>
  );
}
