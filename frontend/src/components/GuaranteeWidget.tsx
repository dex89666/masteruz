// ============================================
// MasterUz — GuaranteeWidget (виджет гарантии)
// ============================================

import { useState, useEffect } from 'react';
import { ShieldCheck, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { guaranteesApi } from '../api/client';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';
import type { Guarantee } from '../types';

interface GuaranteeWidgetProps {
  orderId: string;
  orderStatus: string;
  isClient: boolean;
  isMaster: boolean;
}

export function GuaranteeWidget({ orderId, orderStatus, isClient, isMaster }: GuaranteeWidgetProps) {
  const { t, locale } = useTranslation();
  const [guarantee, setGuarantee] = useState<Guarantee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuarantee();
  }, [orderId]);

  async function loadGuarantee() {
    try {
      const res = await guaranteesApi.getByOrder(orderId);
      setGuarantee(res.data.data);
    } catch {
      // No guarantee — normal for non-completed orders
    }
    setLoading(false);
  }

  async function handleActivateGuarantee() {
    try {
      const res = await guaranteesApi.create(orderId);
      setGuarantee(res.data.data);
      toast.success(t('guarantee.activated'));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('common.error'));
    }
  }

  async function handleClaim() {
    if (!confirm(t('guarantee.confirmClaim'))) return;
    try {
      const res = await guaranteesApi.claim(orderId);
      setGuarantee(res.data.data);
      toast.success(t('guarantee.claimSent'));
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || t('common.error'));
    }
  }

  async function handleResolve() {
    try {
      const res = await guaranteesApi.resolve(orderId);
      setGuarantee(res.data.data);
      toast.success(t('guarantee.resolved'));
    } catch {
      toast.error(t('common.error'));
    }
  }

  if (loading) return null;

  // Если нет гарантии и заказ завершён — предлагаем активировать
  if (!guarantee && orderStatus === 'COMPLETED') {
    return (
      <div className="card mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/10 dark:border-green-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
            <ShieldCheck size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-800 dark:text-green-300">{t('guarantee.title')}</h4>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{t('guarantee.activateDesc')}</p>
          </div>
          <button
            onClick={handleActivateGuarantee}
            className="btn-success text-xs px-4 py-2"
          >
            {t('guarantee.activate')}
          </button>
        </div>
      </div>
    );
  }

  if (!guarantee) return null;

  const isExpired = new Date(guarantee.expiresAt) < new Date();
  const daysLeft = Math.max(0, Math.ceil((new Date(guarantee.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className={`card mb-4 ${
      guarantee.claimedAt && !guarantee.resolvedAt
        ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
        : guarantee.resolvedAt
        ? 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
        : isExpired
        ? 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
        : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${
          guarantee.claimedAt && !guarantee.resolvedAt
            ? 'bg-orange-100 dark:bg-orange-900/40'
            : guarantee.resolvedAt
            ? 'bg-gray-100 dark:bg-gray-700'
            : 'bg-green-100 dark:bg-green-900/40'
        }`}>
          <ShieldCheck size={20} className={
            guarantee.claimedAt && !guarantee.resolvedAt
              ? 'text-orange-600 dark:text-orange-400'
              : guarantee.resolvedAt
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-green-600 dark:text-green-400'
          } />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {t('guarantee.title')}
            {guarantee.claimedAt && !guarantee.resolvedAt && (
              <span className="badge-warning text-[10px]">{t('guarantee.claimActive')}</span>
            )}
            {guarantee.resolvedAt && (
              <span className="badge-success text-[10px]">{t('guarantee.resolvedLabel')}</span>
            )}
          </h4>

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
            <p className="flex items-center gap-1">
              <Clock size={11} />
              {t('guarantee.duration')}: {guarantee.durationDays} {t('guarantee.days')}
            </p>
            <p className="flex items-center gap-1">
              {isExpired ? <AlertCircle size={11} className="text-red-500" /> : <CheckCircle2 size={11} className="text-green-500" />}
              {isExpired
                ? t('guarantee.expired')
                : `${t('guarantee.validUntil')} ${new Date(guarantee.expiresAt).toLocaleDateString(locale)} (${daysLeft} ${t('guarantee.daysLeft')})`
              }
            </p>
          </div>

          {/* Actions */}
          {isClient && !guarantee.claimedAt && !isExpired && guarantee.isActive && (
            <button
              onClick={handleClaim}
              className="mt-2 text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              <AlertCircle size={12} />
              {t('guarantee.claim')}
            </button>
          )}

          {isMaster && guarantee.claimedAt && !guarantee.resolvedAt && (
            <button
              onClick={handleResolve}
              className="mt-2 text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              <CheckCircle2 size={12} />
              {t('guarantee.markResolved')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
