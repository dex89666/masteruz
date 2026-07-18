// ============================================
// MasterUz — Панель изменения цены по ходу работ
// Мастер: предложить цену / заявить факт. объём / отозвать.
// Клиент: подтвердить или отклонить заявку.
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { priceChangeApi } from '../api/client';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import { PriceChangeModal, type PriceChangeMode } from './PriceChangeModal';
import { ImageLightbox } from './ImageLightbox';
import {
  TrendingUp, TrendingDown, ShieldCheck, Clock, CheckCircle2,
  XCircle, Loader2, Pencil, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PriceChangePanelProps {
  orderId: string;
  orderStatus: string;
  currentPrice: number;  // цена работ (без выезда)
  visitFee: number;
  isMaster: boolean;     // текущий пользователь — назначенный мастер
  isClient: boolean;     // текущий пользователь — владелец заказа
  onUpdated?: () => void; // перезагрузить заказ после изменения сумм
}

// Статусы заказа, в которых цену ещё можно менять (совпадает с бэкендом).
const CHANGEABLE = ['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS'];
const LIMIT_PCT = 20; // порог роста без модерации

export function PriceChangePanel({
  orderId, orderStatus, currentPrice, visitFee, isMaster, isClient, onUpdated,
}: PriceChangePanelProps) {
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();
  const currency = t('common.currency');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [modalMode, setModalMode] = useState<PriceChangeMode | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await priceChangeApi.listByOrder(orderId);
      setRequests(res.data?.data ?? []);
    } catch {
      // Панель не критична — молча скрываем при ошибке
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const active = requests.find((r) => r.status === 'PENDING' || r.status === 'MODERATION');
  const lastRejectedPriceChange = requests.find(
    (r) => r.kind === 'PRICE_CHANGE' && r.status === 'REJECTED'
  );
  // Расчёт по факту доступен, только если клиент отказался и расчёт ещё не заявлен.
  const settlementDone = requests.some((r) => r.kind === 'SETTLEMENT');
  const canProposeSettlement = isMaster && !!lastRejectedPriceChange && !settlementDone && !active;
  const canProposePrice = isMaster && CHANGEABLE.includes(orderStatus) && !active && !settlementDone;

  async function respond(action: 'approve' | 'reject', requestId: string) {
    setActing(true);
    try {
      if (action === 'approve') {
        await priceChangeApi.approve(requestId);
        toast.success(t('priceChange.approved'));
      } else {
        await priceChangeApi.reject(requestId);
        toast.success(t('priceChange.rejected'));
      }
      await load();
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('priceChange.errGeneric'));
    } finally {
      setActing(false);
    }
  }

  async function cancelOwn(requestId: string) {
    setActing(true);
    try {
      await priceChangeApi.cancel(requestId);
      toast.success(t('priceChange.withdrawn'));
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('priceChange.errGeneric'));
    } finally {
      setActing(false);
    }
  }

  if (loading) return null;
  // Нечего показывать и нечего предложить — панель не рендерим.
  if (!requests.length && !canProposePrice) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Pencil className="w-4 h-4" /> {t('priceChange.title')}
        </h3>
        {canProposePrice && (
          <button
            onClick={() => setModalMode('price')}
            className="text-sm px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
          >
            {t('priceChange.changePrice')}
          </button>
        )}
        {canProposeSettlement && (
          <button
            onClick={() => setModalMode('settlement')}
            className="text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex items-center gap-1"
          >
            <FileText className="w-4 h-4" /> {t('priceChange.settlement')}
          </button>
        )}
      </div>

      {/* Активная заявка — клиенту с кнопками решения */}
      {active && (
        <PriceChangeCard
          request={active}
          visitFee={visitFee}
          formatPrice={formatPrice}
          t={t}
          currency={currency}
          onPhoto={(images, index) => setLightbox({ images, index })}
          footer={
            <>
              {active.status === 'MODERATION' && (
                <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                  <ShieldCheck className="w-4 h-4" />
                  {isClient ? t('priceChange.underReviewClient') : t('priceChange.underReview')}
                </div>
              )}

              {active.status === 'PENDING' && isClient && (
                <div className="flex gap-2">
                  <button
                    onClick={() => respond('reject', active.id)}
                    disabled={acting}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {t('priceChange.reject')}
                  </button>
                  <button
                    onClick={() => respond('approve', active.id)}
                    disabled={acting}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t('priceChange.approve')}
                  </button>
                </div>
              )}

              {active.status === 'PENDING' && isMaster && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4" /> {t('priceChange.waitingClient')}
                  </span>
                  <button
                    onClick={() => cancelOwn(active.id)}
                    disabled={acting}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 disabled:opacity-50"
                  >
                    {t('priceChange.withdraw')}
                  </button>
                </div>
              )}

              {active.status === 'MODERATION' && isMaster && (
                <button
                  onClick={() => cancelOwn(active.id)}
                  disabled={acting}
                  className="w-full text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 disabled:opacity-50"
                >
                  {t('priceChange.withdrawRequest')}
                </button>
              )}
            </>
          }
        />
      )}

      {/* Мастеру: клиент отказался — нужен расчёт по факту */}
      {canProposeSettlement && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          {t('priceChange.settlementBanner', { fee: formatPrice(visitFee, currency) })}
        </div>
      )}

      {/* История */}
      {requests.filter((r) => r.id !== active?.id).length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-gray-400 uppercase">{t('priceChange.history')}</p>
          {requests
            .filter((r) => r.id !== active?.id)
            .map((r) => (
              <PriceChangeCard
                key={r.id}
                request={r}
                visitFee={visitFee}
                formatPrice={formatPrice}
                t={t}
                currency={currency}
                compact
                onPhoto={(images, index) => setLightbox({ images, index })}
              />
            ))}
        </div>
      )}

      {modalMode && (
        <PriceChangeModal
          isOpen
          mode={modalMode}
          orderId={orderId}
          currentPrice={currentPrice}
          visitFee={visitFee}
          limitPct={LIMIT_PCT}
          onClose={() => setModalMode(null)}
          onSuccess={() => { load(); onUpdated?.(); }}
        />
      )}

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

// ─── Карточка одной заявки ───────────────────────────────────────
const STATUS_META: Record<string, { key: string; cls: string; Icon: any }> = {
  PENDING: { key: 'priceChange.statusPending', cls: 'text-orange-600 dark:text-orange-400', Icon: Clock },
  MODERATION: { key: 'priceChange.statusModeration', cls: 'text-blue-600 dark:text-blue-400', Icon: ShieldCheck },
  APPROVED: { key: 'priceChange.statusApproved', cls: 'text-green-600 dark:text-green-400', Icon: CheckCircle2 },
  REJECTED: { key: 'priceChange.statusRejected', cls: 'text-red-600 dark:text-red-400', Icon: XCircle },
  CANCELLED: { key: 'priceChange.statusCancelled', cls: 'text-gray-500 dark:text-gray-400', Icon: XCircle },
};

function PriceChangeCard({
  request, visitFee, formatPrice, t, currency, compact, footer, onPhoto,
}: {
  request: any;
  visitFee: number;
  formatPrice: (v: number, c?: string) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
  currency: string;
  compact?: boolean;
  footer?: React.ReactNode;
  onPhoto?: (images: string[], index: number) => void;
}) {
  const oldPrice = Number(request.oldPrice);
  const newPrice = Number(request.newPrice);
  const isSettlement = request.kind === 'SETTLEMENT';
  const isDown = newPrice < oldPrice;
  const meta = STATUS_META[request.status] ?? STATUS_META.PENDING;
  const StatusIcon = meta.Icon;

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
          {isSettlement ? (
            <><FileText className="w-4 h-4 text-amber-500" /> {t('priceChange.settlement')}</>
          ) : isDown ? (
            <><TrendingDown className="w-4 h-4 text-blue-500" /> {t('priceChange.priceDecrease')}</>
          ) : (
            <><TrendingUp className="w-4 h-4 text-orange-500" /> {t('priceChange.priceIncrease')}</>
          )}
        </span>
        <span className={`text-xs flex items-center gap-1 ${meta.cls}`}>
          <StatusIcon className="w-3.5 h-3.5" /> {t(meta.key)}
        </span>
      </div>

      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-gray-400 line-through">{formatPrice(oldPrice, currency)}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(newPrice, currency)}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          + {t('priceChange.visit').toLowerCase()} {formatPrice(visitFee, currency)} = <b>{formatPrice(newPrice + visitFee, currency)}</b>
        </span>
      </div>

      {!compact && request.reason && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{request.reason}</p>
      )}

      {!compact && request.photos?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {request.photos.map((p: string, i: number) => (
            <img
              key={i}
              src={p}
              alt=""
              onClick={() => onPhoto?.(request.photos, i)}
              className="w-14 h-14 object-cover rounded-md cursor-pointer"
            />
          ))}
        </div>
      )}

      {!compact && request.moderatorNote && (
        <p className="text-xs text-blue-700 dark:text-blue-300">{t('priceChange.moderator')}: {request.moderatorNote}</p>
      )}

      {footer}
    </div>
  );
}

export default PriceChangePanel;
