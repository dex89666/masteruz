// ============================================
// MasterUz — Payment History Page (Enhanced)
// Фильтры, типы платежей, сводка
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentsApi } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import {
  ArrowLeft, CreditCard, CheckCircle, Clock,
  XCircle, ArrowDownCircle,
  ChevronLeft, ChevronRight, Receipt,
  Filter, TrendingUp, Wallet,
  UserPlus, Gift, Star,
} from 'lucide-react';
import type { Payment, PaymentStatus } from '../types';

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  COMPLETED: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/30',
  },
  PENDING: {
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
  },
  PROCESSING: {
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  FAILED: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
  },
  REFUNDED: {
    icon: ArrowDownCircle,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
  },
};

const typeConfig: Record<string, { icon: any; labelKey: string; color: string }> = {
  ORDER_COMMISSION: {
    icon: CreditCard,
    labelKey: 'payments.typeCommission',
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  },
  REGISTRATION_FEE: {
    icon: UserPlus,
    labelKey: 'payments.typeRegistration',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  ORDER_PAYMENT: {
    icon: Wallet,
    labelKey: 'payments.typeOrder',
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  },
  REFERRAL_BONUS: {
    icon: Gift,
    labelKey: 'payments.typeReferral',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
  SUBSCRIPTION: {
    icon: Star,
    labelKey: 'payments.typeSubscription',
    color: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  },
};

type FilterStatus = '' | PaymentStatus;

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [page]);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await paymentsApi.history(page, 20);
      setPayments(res.data.data || []);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Summary stats
  const summary = useMemo(() => {
    const completed = payments.filter((p) => p.status === 'COMPLETED');
    const totalPaid = completed.reduce((s, p) => s + p.amount, 0);
    const commissions = completed.filter((p) => p.type === 'ORDER_COMMISSION').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');
    return { totalPaid, commissions, pendingCount: pending.length };
  }, [payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    if (!filterStatus) return payments;
    return payments.filter((p) => p.status === filterStatus);
  }, [payments, filterStatus]);

  function getStatusInfo(status: string) {
    return statusConfig[status] || statusConfig.PENDING;
  }

  function getTypeInfo(type: string) {
    return typeConfig[type] || {
      icon: CreditCard,
      labelKey: 'payments.payment',
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
  }

  const statusFilters: { key: FilterStatus; label: string; color: string }[] = [
    { key: '', label: t('payments.filterAll'), color: 'bg-gray-600' },
    { key: 'COMPLETED', label: t('payments.status_COMPLETED'), color: 'bg-green-500' },
    { key: 'PENDING', label: t('payments.status_PENDING'), color: 'bg-yellow-500' },
    { key: 'PROCESSING', label: t('payments.status_PROCESSING'), color: 'bg-blue-500' },
    { key: 'FAILED', label: t('payments.status_FAILED'), color: 'bg-red-500' },
  ];

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <ArrowLeft size={18} className="mr-1" />
          {t('common.back')}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl transition-colors ${
            showFilters || filterStatus
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          <Filter size={18} />
        </button>
      </div>

      <h1 className="page-title flex items-center gap-2">
        <CreditCard size={24} className="text-primary-600" />
        {t('payments.title')}
      </h1>

      {/* Summary Cards */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="card !p-3 text-center">
            <TrendingUp size={16} className="mx-auto text-green-600 dark:text-green-400 mb-1" />
            <p className="text-sm font-bold dark:text-white">
              {formatPrice(summary.totalPaid, '')}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('payments.totalExpense')}</p>
          </div>
          <div className="card !p-3 text-center">
            <CreditCard size={16} className="mx-auto text-indigo-600 dark:text-indigo-400 mb-1" />
            <p className="text-sm font-bold dark:text-white">
              {formatPrice(summary.commissions, '')}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('payments.commission')}</p>
          </div>
          <div className="card !p-3 text-center">
            <Clock size={16} className="mx-auto text-yellow-600 dark:text-yellow-400 mb-1" />
            <p className="text-sm font-bold dark:text-white">{summary.pendingCount}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('payments.status_PENDING')}</p>
          </div>
        </div>
      )}

      {/* Status Filters */}
      {showFilters && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                filterStatus === f.key
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${f.color}`} />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('payments.empty')}
          description={t('payments.emptyDesc')}
        />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={Filter}
          title={t('payments.noPayments')}
          description={t('payments.noPaymentsDesc')}
        />
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {filteredPayments.map((payment) => {
              const statusInfo = getStatusInfo(payment.status);
              const StatusIcon = statusInfo.icon;
              const typeInfo = getTypeInfo(payment.type);
              const TypeIcon = typeInfo.icon;

              return (
                <div key={payment.id} className="card hover:shadow-md dark:hover:shadow-black/20 transition-shadow">
                  <div className="flex items-center gap-3">
                    {/* Status icon */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${statusInfo.bg} ${statusInfo.color}`}>
                      <StatusIcon size={20} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {payment.order?.title || t(typeInfo.labelKey as any)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* Payment Type Badge */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                          <TypeIcon size={10} />
                          {t(typeInfo.labelKey as any)}
                        </span>
                        {/* Provider */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                          {payment.provider === 'TELEGRAM_STARS' ? 'Stars' :
                           payment.provider === 'CLICK' ? 'Click' :
                           payment.provider === 'PAYME' ? 'Payme' :
                           payment.provider}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(payment.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Amount + Status */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm dark:text-white">
                        {formatPrice(payment.amount, t('common.currency'))}
                      </p>
                      <p className={`text-[10px] font-medium mt-0.5 ${statusInfo.color}`}>
                        {t(`payments.status_${payment.status}` as any)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={20} className="dark:text-gray-400" />
              </button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={20} className="dark:text-gray-400" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
