// ============================================
// MasterUz — Изменение цены по ходу работ
// Модалка мастера: предложить новую цену либо
// заявить фактически выполненный объём.
// ============================================

import { useState } from 'react';
import { priceChangeApi } from '../api/client';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import { X, Camera, Loader2, AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export type PriceChangeMode = 'price' | 'settlement';

interface PriceChangeModalProps {
  isOpen: boolean;
  mode: PriceChangeMode;
  orderId: string;
  currentPrice: number;   // текущая цена работ (без выезда)
  visitFee: number;       // плата за выезд — удерживается всегда
  limitPct: number;       // порог роста без модерации (по умолчанию 20)
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceChangeModal({
  isOpen, mode, orderId, currentPrice, visitFee, limitPct, onClose, onSuccess,
}: PriceChangeModalProps) {
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const currency = t('common.currency');
  const isSettlement = mode === 'settlement';
  const numeric = Number(amount.replace(/\s/g, '')) || 0;
  const diff = numeric - currentPrice;
  const stepPct = currentPrice > 0 ? (diff / currentPrice) * 100 : 0;

  // Что произойдёт после отправки — говорим мастеру заранее, без сюрпризов.
  const needsModeration = isSettlement || diff < 0 || stepPct > limitPct;

  function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.slice(0, 10 - photos.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPhotos((prev) => (prev.length >= 10 ? prev : [...prev, dataUrl]));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  async function handleSubmit() {
    if (!amount || numeric < 0) return toast.error(t('priceChange.errAmount'));
    if (!isSettlement && numeric <= 0) return toast.error(t('priceChange.errPositive'));
    if (!isSettlement && numeric === currentPrice) return toast.error(t('priceChange.errSame'));
    if (isSettlement && numeric > currentPrice) {
      return toast.error(t('priceChange.errExceeds', { price: formatPrice(currentPrice, currency) }));
    }
    if (reason.trim().length < 5) return toast.error(t('priceChange.errReason'));

    setSubmitting(true);
    try {
      if (isSettlement) {
        await priceChangeApi.proposeSettlement(orderId, {
          completedAmount: numeric,
          reason: reason.trim(),
          photos,
        });
        toast.success(t('priceChange.settlementSent'));
      } else {
        await priceChangeApi.propose(orderId, {
          newPrice: numeric,
          reason: reason.trim(),
          photos,
        });
        toast.success(
          needsModeration ? t('priceChange.sentToModerator') : t('priceChange.sentToClient')
        );
      }
      onSuccess();
      onClose();
      setAmount(''); setReason(''); setPhotos([]);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.response?.data?.error || t('priceChange.errGeneric')
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        {/* Шапка */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isSettlement ? t('priceChange.settlementTitle') : t('priceChange.title')}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isSettlement && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('priceChange.settlementNotice', { fee: formatPrice(visitFee, currency) })}
              </p>
            </div>
          )}

          {/* Текущая цена */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {isSettlement ? t('priceChange.agreedWorkPrice') : t('priceChange.currentWorkPrice')}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">{formatPrice(currentPrice, currency)}</span>
          </div>

          {/* Сумма */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {isSettlement ? t('priceChange.completedAmount') : t('priceChange.newWorkPrice')}
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
              inputMode="numeric"
              className={inputCls}
            />
          </div>

          {/* Итог и предупреждения */}
          {numeric > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('priceChange.works')}</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(numeric, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('priceChange.visit')}</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(visitFee, currency)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600 font-semibold">
                <span className="text-gray-700 dark:text-gray-200">{t('priceChange.total')}</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(numeric + visitFee, currency)}</span>
              </div>
              {!isSettlement && diff !== 0 && (
                <div className={`flex justify-between pt-1 ${diff > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  <span>{diff > 0 ? t('priceChange.growth') : t('priceChange.decrease')}</span>
                  <span>{diff > 0 ? '+' : ''}{stepPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {needsModeration && numeric > 0 && (
            <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <ShieldCheck className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {diff < 0 || isSettlement
                  ? t('priceChange.moderationDecrease')
                  : t('priceChange.moderationGrowth', { pct: String(limitPct) })}
              </p>
            </div>
          )}

          {/* Причина */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {isSettlement ? t('priceChange.reasonSettlement') : t('priceChange.reason')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={isSettlement ? t('priceChange.reasonSettlementPlaceholder') : t('priceChange.reasonPlaceholder')}
              className={inputCls}
            />
          </div>

          {/* Фото-доказательства */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('priceChange.photos')} ({photos.length}/10) — {t('priceChange.photosHint')}
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500">
                  <Camera className="w-6 h-6 text-gray-400" />
                  <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="sticky bottom-0 flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium"
          >
            {t('priceChange.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('priceChange.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PriceChangeModal;
