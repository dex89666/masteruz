// ============================================
// MasterUz — Balance Page (Антифрод: кошелёк)
// Пополнение, транзакции, эскроу
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { balanceApi } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useAuthStore } from '../store';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import {
  Wallet, Plus, ArrowUpCircle, ArrowDownCircle, Lock,
  RefreshCw, AlertTriangle, CreditCard, ChevronDown,
  TrendingDown, Receipt, Gift
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { BalanceTransaction, BalanceTransactionType } from '../types';

const PROVIDERS = ['CLICK', 'PAYME', 'TELEGRAM_STARS'] as const;
const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];

const typeIcons: Record<BalanceTransactionType, typeof Wallet> = {
  TOPUP: ArrowUpCircle,
  ESCROW_HOLD: Lock,
  ESCROW_RELEASE: ArrowDownCircle,
  PENALTY: AlertTriangle,
  REFUND: RefreshCw,
  COMMISSION: Receipt,
  PAYOUT: TrendingDown,
  ESTIMATION_FEE: CreditCard,
  ESTIMATE_PAYOUT: ArrowDownCircle,
  ADMIN_TOPUP: ArrowUpCircle,
  ADMIN_WITHDRAW: ArrowDownCircle,
  REFERRAL_BONUS: Gift,
};

const typeColors: Record<BalanceTransactionType, string> = {
  TOPUP: 'text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
  ESCROW_HOLD: 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  ESCROW_RELEASE: 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30',
  PENALTY: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
  REFUND: 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  COMMISSION: 'text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
  PAYOUT: 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800',
  ESTIMATION_FEE: 'text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30',
  ESTIMATE_PAYOUT: 'text-teal-500 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
  ADMIN_TOPUP: 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  ADMIN_WITHDRAW: 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30',
  REFERRAL_BONUS: 'text-cyan-500 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30',
};

const amountSign: Record<BalanceTransactionType, '+' | '-'> = {
  TOPUP: '+',
  ESCROW_HOLD: '-',
  ESCROW_RELEASE: '-',
  PENALTY: '-',
  REFUND: '+',
  COMMISSION: '-',
  PAYOUT: '-',
  ESTIMATION_FEE: '-',
  ESTIMATE_PAYOUT: '+',
  ADMIN_TOPUP: '+',
  ADMIN_WITHDRAW: '-',
  REFERRAL_BONUS: '+',
};

export function BalancePage() {
  const { user } = useAuthStore();
  const formatPrice = useFormatPrice();
  const { t, locale } = useTranslation();

  const [balance, setBalance] = useState<number>(user?.balance || 0);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Top-up state
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [provider, setProvider] = useState<string>('CLICK');
  const [topUpLoading, setTopUpLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        balanceApi.getBalance(),
        balanceApi.getTransactions(1, 20),
      ]);
      setBalance(balRes.data.data.balance);
      setTransactions(txRes.data.data || []);
      setHasMore((txRes.data.data?.length || 0) >= 20);
      setPage(1);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await balanceApi.getTransactions(nextPage, 20);
      const newTxs = res.data.data || [];
      setTransactions(prev => [...prev, ...newTxs]);
      setPage(nextPage);
      setHasMore(newTxs.length >= 20);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleTopUp() {
    const amount = Number(topUpAmount);
    if (!amount || amount < 10000) {
      toast.error(t('balance.minAmount'));
      return;
    }
    setTopUpLoading(true);
    try {
      const res = await balanceApi.topUp(amount, provider);
      const paymentData = res.data.data?.paymentData;

      if (provider === 'TELEGRAM_STARS' && paymentData?.starsAmount) {
        toast.success(`Оплатите ${paymentData.starsAmount} ⭐ Stars через Telegram бот`);
        setShowTopUp(false);
        setTopUpAmount('');
      } else if (paymentData?.url) {
        window.open(paymentData.url, '_blank');
        toast.success('Перенаправляем на страницу оплаты...');
        setShowTopUp(false);
        setTopUpAmount('');
      } else {
        toast.success(t('balance.topUpSuccess'));
        setShowTopUp(false);
        setTopUpAmount('');
        loadData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setTopUpLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      <Breadcrumbs items={[
        { label: t('balance.title') },
      ]} />

      {/* ═══════ Карточка баланса ═══════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-6 text-white mb-6 shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-4" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-white/80">
            <Wallet size={18} />
            <span className="text-sm font-medium">{t('balance.currentBalance')}</span>
          </div>
          <p className="text-3xl font-bold tracking-tight mb-4">
            {formatPrice(balance, t('common.currency'))}
          </p>
          <button
            onClick={() => setShowTopUp(!showTopUp)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-all backdrop-blur-sm"
          >
            <Plus size={18} />
            {t('balance.topUp')}
          </button>
        </div>
      </div>

      {/* ═══════ Форма пополнения ═══════ */}
      {showTopUp && (
        <div className="card mb-6 animate-in slide-in-from-top">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-primary-500" />
            {t('balance.topUpTitle')}
          </h3>

          {/* Быстрые суммы */}
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setTopUpAmount(String(amt))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  topUpAmount === String(amt)
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 ring-2 ring-primary-300 dark:ring-primary-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {formatPrice(amt, '')}
              </button>
            ))}
          </div>

          {/* Ввод суммы */}
          <div className="mb-4">
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('balance.amount')}</label>
            <input
              type="number"
              className="input text-lg font-semibold"
              placeholder={t('balance.amountPlaceholder')}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              min={10000}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('balance.minAmount')}</p>
          </div>

          {/* Провайдер */}
          <div className="mb-4">
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">{t('balance.selectProvider')}</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    provider === p
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {p === 'CLICK' ? '💳 Click' : p === 'PAYME' ? '💳 Payme' : '⭐ Stars'}
                </button>
              ))}
            </div>
          </div>

          {/* Кнопка */}
          <button
            onClick={handleTopUp}
            disabled={topUpLoading || !topUpAmount || Number(topUpAmount) < 10000}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {topUpLoading ? <LoadingSpinner size="sm" /> : <Plus size={18} />}
            {t('balance.topUpBtn')}
          </button>
        </div>
      )}

      {/* ═══════ История транзакций ═══════ */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Receipt size={18} className="text-gray-400" />
          {t('balance.transactions')}
        </h2>

        {transactions.length === 0 ? (
          <div className="card text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Receipt size={28} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('balance.noTransactions')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-500">{t('balance.noTransactionsDesc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const Icon = typeIcons[tx.type] || Wallet;
              const colorClass = typeColors[tx.type] || 'text-gray-500 bg-gray-50 dark:bg-gray-800';
              const sign = amountSign[tx.type] || '';
              const isPositive = sign === '+';

              return (
                <div key={tx.id} className="card flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {t(`balance.type_${tx.type}` as any)}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.description}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString(locale, {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                    }`}>
                      {sign}{formatPrice(Math.abs(tx.amount), t('common.currency'))}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      → {formatPrice(tx.balanceAfter, '')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Загрузить ещё */}
        {hasMore && transactions.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-center gap-2"
          >
            {loadingMore ? <LoadingSpinner size="sm" /> : <ChevronDown size={16} />}
            {t('common.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
