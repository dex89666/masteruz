// ============================================
// MasterUz — Модерация изменений цены (админ)
// Ключевой рубеж против обхода платформы: сюда попадают
// ВСЕ снижения цены и расчёты по факту, а также рост > лимита.
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { priceChangeApi } from '../api/client';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import { ImageLightbox } from './ImageLightbox';
import {
  TrendingUp, TrendingDown, FileText, Loader2, ShieldAlert,
  CheckCircle2, XCircle, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminPriceChangeModeration() {
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();
  const currency = t('common.currency');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await priceChangeApi.moderationQueue({ limit: 50 });
      setItems(res.data?.data ?? []);
    } catch {
      toast.error(t('priceChange.moderationLoadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approve: boolean) {
    setActingId(id);
    try {
      await priceChangeApi.moderate(id, approve, notes[id]?.trim() || undefined);
      toast.success(approve ? t('priceChange.moderationApproved') : t('priceChange.moderationRejected'));
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('priceChange.errGeneric'));
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center py-12 text-gray-400">
        <Inbox className="w-10 h-10 mb-2" />
        <p className="text-sm">{t('priceChange.moderationEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {t('priceChange.moderationWarning')}
        </p>
      </div>

      {items.map((r) => {
        const oldPrice = Number(r.oldPrice);
        const newPrice = Number(r.newPrice);
        const visitFee = Number(r.order?.visitFee ?? 0);
        const isSettlement = r.kind === 'SETTLEMENT';
        const isDown = newPrice < oldPrice;
        const deltaPct = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
        const masterName = [r.master?.profile?.firstName, r.master?.profile?.lastName]
          .filter(Boolean).join(' ') || r.master?.phone || r.master?.id;

        return (
          <div key={r.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
            {/* Заголовок */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                  {isSettlement ? (
                    <><FileText className="w-4 h-4 text-amber-500" /> {t('priceChange.settlement')}</>
                  ) : isDown ? (
                    <><TrendingDown className="w-4 h-4 text-blue-500" /> {t('priceChange.priceDecrease')}</>
                  ) : (
                    <><TrendingUp className="w-4 h-4 text-orange-500" /> {t('priceChange.priceIncrease')}</>
                  )}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('priceChange.order')}: {r.order?.title ?? r.orderId}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('priceChange.master')}: {masterName}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  isDown || isSettlement
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                }`}
              >
                {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
              </span>
            </div>

            {/* Суммы */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('priceChange.was')}</span>
                <span className="text-gray-400 line-through">{formatPrice(oldPrice, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('priceChange.becomes')}</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(newPrice, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('priceChange.visit')}</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(visitFee, currency)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600 font-semibold">
                <span className="text-gray-700 dark:text-gray-200">{t('priceChange.totalForClient')}</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(newPrice + visitFee, currency)}</span>
              </div>
            </div>

            {/* Обоснование мастера */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">{t('priceChange.masterJustification')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{r.reason}</p>
            </div>

            {/* Фото */}
            {r.photos?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {r.photos.map((p: string, i: number) => (
                  <img
                    key={i}
                    src={p}
                    alt=""
                    onClick={() => setLightbox({ images: r.photos, index: i })}
                    className="w-16 h-16 object-cover rounded-md cursor-pointer"
                  />
                ))}
              </div>
            )}

            {/* Комментарий модератора */}
            <input
              value={notes[r.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
              placeholder={t('priceChange.moderatorNotePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />

            {/* Решение */}
            <div className="flex gap-2">
              <button
                onClick={() => decide(r.id, false)}
                disabled={actingId === r.id}
                className="flex-1 px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> {t('priceChange.reject')}
              </button>
              <button
                onClick={() => decide(r.id, true)}
                disabled={actingId === r.id}
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('priceChange.approve')}
              </button>
            </div>
          </div>
        );
      })}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

export default AdminPriceChangeModeration;
