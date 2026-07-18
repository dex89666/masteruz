// ============================================
// MasterUz — Очередь выводов средств (админ)
// ============================================
// Ручная обработка: админ видит заявку, переводит деньги на карту
// и отмечает выполненной. Баланс мастера уже списан при создании
// заявки — здесь деньги повторно НЕ трогаются.
//
// Отклонение возвращает сумму мастеру, поэтому причина обязательна:
// мастер должен понимать, почему деньги вернулись.

import { useCallback, useEffect, useState } from 'react';
import { withdrawalsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import {
  Clock, Loader2, CheckCircle2, XCircle, Inbox, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const;

export function AdminWithdrawals() {
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const currency = t('common.currency');

  const [tab, setTab] = useState<(typeof TABS)[number]>('PENDING');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await withdrawalsApi.adminList({ status: tab, limit: 50 });
      setItems(res.data?.data ?? []);
    } catch {
      toast.error(t('withdrawal.adminLoadError'));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, fn: () => Promise<any>, okMsg: string) {
    setActingId(id);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('withdrawal.errGeneric'));
    } finally {
      setActingId(null);
    }
  }

  function masterName(u: any) {
    return [u?.profile?.firstName, u?.profile?.lastName].filter(Boolean).join(' ')
      || u?.phone || u?.id || '—';
  }

  return (
    <div className="space-y-4">
      {/* Вкладки статусов */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === s
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {t(`withdrawal.status${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-gray-400">
          <Inbox className="w-10 h-10 mb-2" />
          <p className="text-sm">{t('withdrawal.adminEmpty')}</p>
        </div>
      ) : (
        items.map((r) => (
          <div
            key={r.id}
            className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatPrice(Number(r.payoutAmount), currency)}
                </p>
                {Number(r.commission) > 0 && (
                  <p className="text-xs text-gray-400">
                    {t('withdrawal.amount')}: {formatPrice(Number(r.amount), currency)} ·{' '}
                    {t('withdrawal.commission')}: {formatPrice(Number(r.commission), currency)}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('withdrawal.adminMaster')}: {masterName(r.user)}
                </p>
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(r.createdAt).toLocaleString('ru')}
              </span>
            </div>

            {/* Реквизиты для перевода */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="font-mono text-gray-900 dark:text-white">{r.cardNumber}</span>
                {r.cardHolder && (
                  <span className="text-gray-500 dark:text-gray-400"> · {r.cardHolder}</span>
                )}
                {r.cardProvider && (
                  <span className="text-xs text-gray-400"> ({r.cardProvider})</span>
                )}
              </div>
            </div>

            {r.rejectReason && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t('withdrawal.rejectReason')}: {r.rejectReason}
              </p>
            )}
            {r.adminNote && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{r.adminNote}</p>
            )}

            {/* Действия — только для незакрытых заявок */}
            {(r.status === 'PENDING' || r.status === 'PROCESSING') && (
              <div className="space-y-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder={t('withdrawal.adminNote')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <div className="flex flex-wrap gap-2">
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => act(r.id, () => withdrawalsApi.adminProcessing(r.id), t('withdrawal.adminTake'))}
                      disabled={actingId === r.id}
                      className="flex-1 min-w-[130px] px-3 py-2 border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" /> {t('withdrawal.adminTake')}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const reason = window.prompt(t('withdrawal.adminRejectReason'));
                      if (reason?.trim()) {
                        act(r.id, () => withdrawalsApi.adminReject(r.id, reason.trim()), t('withdrawal.adminReject'));
                      }
                    }}
                    disabled={actingId === r.id}
                    className="flex-1 min-w-[130px] px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> {t('withdrawal.adminReject')}
                  </button>
                  <button
                    onClick={() => act(r.id, () => withdrawalsApi.adminComplete(r.id, notes[r.id]?.trim() || undefined), t('withdrawal.adminComplete'))}
                    disabled={actingId === r.id}
                    className="flex-1 min-w-[150px] px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t('withdrawal.adminComplete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default AdminWithdrawals;
