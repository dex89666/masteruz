// ============================================
// MasterUz — Order Detail Page (Антифрод механика)
// Двойное подтверждение / Статус-бар / Штрафы / Споры
// ============================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ordersApi, reviewsApi, photosApi, estimationApi, adminApi } from '../api/client';
import { StarRating } from '../components/StarRating';
import { OrderChat } from '../components/OrderChat';
import { PhotoGallery } from '../components/PhotoGallery';
import { GuaranteeWidget } from '../components/GuaranteeWidget';
import { MasterCard } from '../components/MasterCard';
import { OrderTimeline } from '../components/OrderTimeline';
import { OrderRouteMap } from '../components/OrderRouteMap';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { OrderDetailSkeleton } from '../components/PageSkeletons';
import { CommissionPaymentModal } from '../components/CommissionPaymentModal';
import AutoCancelCountdown from '../components/AutoCancelCountdown';
import { useAuthStore } from '../store';
import { useFormatPrice } from '../hooks';
import { useOrderEvents } from '../hooks/useOrderEvents';
import { useMasterLocationBroadcast } from '../hooks/useMasterLocationBroadcast';
import { useTranslation } from '../i18n';
import {
  MapPin, Clock, DollarSign, User, Phone,
  CheckCircle, XCircle, MessageSquare, Star, Send, AlertTriangle,
  Zap, CreditCard, Navigation, Map, Truck, Shield, ThumbsUp, Ban, Scale, Check, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Order, OrderResponse, OrderPhoto } from '../types';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const formatPrice = useFormatPrice();
  const { t, locale } = useTranslation();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [responsePrice, setResponsePrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Photos state
  const [photos, setPhotos] = useState<OrderPhoto[]>([]);

  // Payment modal state
  const [showPayment, setShowPayment] = useState(false);

  // Dispute state
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // Cancel confirm state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Admin comment state
  const [editingAdminComment, setEditingAdminComment] = useState(false);
  const [adminCommentDraft, setAdminCommentDraft] = useState('');

  // Live-локация мастера (для клиента — приходит по SSE)
  const [masterLive, setMasterLive] = useState<{ lat: number; lng: number } | null>(null);
  // Подтверждение прибытия в процессе (показываем спиннер)
  const [arriving, setArriving] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isMaster = user?.role === 'MASTER';
  const isClient = user?.role === 'CLIENT';
  const isOwner = order?.clientId === user?.id;
  const isAssignedMaster = order?.masterId === user?.id;

  const [searchParams, setSearchParams] = useSearchParams();
  const respondAction = searchParams.get('action') === 'respond';
  const respondFormRef = useRef<HTMLDivElement | null>(null);
  const [respondHighlight, setRespondHighlight] = useState(false);

  // Авто-прокрутка к форме отклика при переходе из Telegram-кнопки «Подтвердить заявку»
  useEffect(() => {
    if (!respondAction || !order || !isMaster || isOwner) return;
    if (order.status !== 'PUBLISHED') return;
    const timer = setTimeout(() => {
      respondFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setRespondHighlight(true);
      setTimeout(() => setRespondHighlight(false), 2400);
      // Убираем action из URL чтобы при ручном обновлении не повторялось
      setSearchParams((p) => { p.delete('action'); return p; }, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [respondAction, order, isMaster, isOwner]);

  function formatLastSeen(lastSeenAt: string | null): string {
    if (!lastSeenAt) return '';
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('masterCard.justNow');
    if (minutes < 60) return `${minutes} ${t('masterCard.minutesAgo')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${t('masterCard.hoursAgo')}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t('masterCard.daysAgo')}`;
  }

  useEffect(() => {
    if (id) loadOrder();
  }, [id]);

  // SSE real-time обновления — при любом событии перезагружаем заказ + показываем уведомление
  const handleOrderEvent = useCallback((event: string, data: Record<string, unknown>) => {
    if (!id) return;
    if (event === 'master_location') {
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setMasterLive({ lat, lng });
      }
      return;
    }
    loadOrder();
    // Показываем попап при подтверждении другой стороной
    if (event === 'master_confirmed' && isOwner) {
      toast(t('antiFraud.masterConfirmedNotify'), { duration: 6000 });
    }
    if (event === 'client_confirmed' && isAssignedMaster) {
      toast(t('antiFraud.clientConfirmedNotify'), { duration: 6000 });
    }
    if (event === 'order_completed') {
      toast.success(t('antiFraud.orderCompleted'), { duration: 6000 });
    }
    if (event === 'master_assigned') {
      toast(t('antiFraud.masterAssignedNotify'), { duration: 5000 });
    }
  }, [id, isOwner, isAssignedMaster]);

  useOrderEvents({
    orderId: id,
    enabled: !loading && !!order,
    onEvent: handleOrderEvent,
  });

  // Мастер транслирует свою позицию во время доставки
  useMasterLocationBroadcast({
    orderId: id,
    enabled:
      !!order &&
      isAssignedMaster &&
      (order.status === 'ACCEPTED' || order.status === 'IN_TRANSIT'),
  });

  async function loadOrder() {
    try {
      const response = await ordersApi.getById(id!);
      const orderData = response.data.data;
      setOrder(orderData);
      try {
        const photosRes = await photosApi.getByOrder(id!);
        setPhotos(photosRes.data.data || []);
      } catch { /* photos optional */ }
    } catch (error) {
      toast.error(t('orderDetail.orderNotFound'));
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond() {
    setSubmitting(true);
    try {
      await ordersApi.respond(id!, {
        message: '',
        priceOffer: responsePrice ? Number(responsePrice) : undefined,
      });
      toast.success(t('orderDetail.responseSent'));
      setResponsePrice('');
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('orderDetail.sendError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignMaster(masterId: string) {
    try {
      await ordersApi.assign(id!, masterId);
      toast.success(t('orderDetail.masterAssigned'));
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  }

  // ─── Мастер обновляет статус ──────────────
  // Для перехода IN_TRANSIT → IN_PROGRESS («Я приехал») запрашиваем геолокацию
  // и шлём на бэк для геофенс-проверки (расстояние до точки заказа).
  async function handleUpdateStatus(newStatus: string) {
    const needsGeofence = newStatus === 'IN_PROGRESS';

    let coords: { latitude: number; longitude: number } | undefined;
    if (needsGeofence) {
      if (!navigator.geolocation) {
        toast.error('Геолокация недоступна на этом устройстве');
        return;
      }
      setArriving(true);
      try {
        coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
      } catch (geoErr: any) {
        setArriving(false);
        toast.error(
          geoErr?.code === 1
            ? 'Разрешите доступ к геолокации, чтобы подтвердить прибытие'
            : 'Не удалось получить вашу геопозицию'
        );
        return;
      }
    }

    try {
      await ordersApi.updateStatus(id!, newStatus, coords);
      toast.success(t('antiFraud.statusUpdated'));
      loadOrder();
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        t('common.error');
      toast.error(msg, { duration: 6000 });
    } finally {
      setArriving(false);
    }
  }

  // ─── Мастер подтверждает выполнение ───────
  async function handleMasterConfirm() {
    try {
      await ordersApi.masterConfirm(id!);
      toast.success(t('antiFraud.masterConfirmed'));
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  }

  // ─── Клиент подтверждает завершение ───────
  async function handleClientConfirm() {
    try {
      await ordersApi.clientConfirm(id!);
      toast.success(t('antiFraud.clientConfirmed'));
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  }

  // ─── Отмена с предупреждением о штрафе ────
  async function handleCancel() {
    try {
      const result = await ordersApi.cancel(id!, cancelReason || undefined);
      const data = result.data.data;
      if (data.penaltyAmount > 0) {
        toast.error(`${t('antiFraud.penaltyCharged')}: ${formatPrice(data.penaltyAmount, t('common.currency'))}`);
      } else {
        toast.success(t('orderDetail.orderCancelled'));
      }
      setShowCancelConfirm(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  }

  // ─── Открытие спора ───────────────────────
  async function handleDispute() {
    if (!disputeReason.trim()) {
      toast.error(t('antiFraud.disputeReasonRequired'));
      return;
    }
    try {
      await ordersApi.dispute(id!, disputeReason);
      toast.success(t('antiFraud.disputeOpened'));
      setShowDispute(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  }

  async function handleSubmitReview() {
    if (!reviewComment.trim()) {
      toast.error(t('orderDetail.writeReview'));
      return;
    }
    setSubmitting(true);
    try {
      await reviewsApi.create({
        orderId: id!,
        rating: reviewRating,
        comment: reviewComment,
      });
      toast.success(t('orderDetail.reviewPublished'));
      setShowReview(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Расчёт штрафа для предупреждения ─────
  function getPenaltyWarning(): { amount: number; level: string } {
    if (!order) return { amount: 0, level: 'free' };
    const isOwnerCancel = isOwner;
    if (isOwnerCancel) {
      switch (order.status) {
        case 'PUBLISHED': return { amount: 0, level: 'free' };
        case 'ACCEPTED': return { amount: 20000, level: 'warning' };
        case 'IN_TRANSIT':
        case 'IN_PROGRESS': return { amount: 30000, level: 'danger' };
        default: return { amount: 0, level: 'free' };
      }
    }
    if (isAssignedMaster && order.status !== 'PUBLISHED') {
      return { amount: 30000, level: 'danger' };
    }
    return { amount: 0, level: 'free' };
  }

  const statusColors: Record<string, string> = {
    PUBLISHED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ACCEPTED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    IN_TRANSIT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    DISPUTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    ESTIMATION_IN_PROGRESS: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    ESTIMATION_DONE: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    ESTIMATE_SENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    ESTIMATE_APPROVED: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
    ESTIMATE_REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    MODERATION: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  };

  if (loading) return <OrderDetailSkeleton />;
  if (!order) return null;

  const statusColor = statusColors[order.status] || 'bg-gray-100';
  const penaltyInfo = getPenaltyWarning();

  return (
    <div className="page-container pb-20">
      {/* Навигация */}
      <Breadcrumbs items={[
        { label: t('orders.title'), href: '/orders' },
        { label: order.title },
      ]} />

      {/* Заголовок */}
      <div className={`card mb-4 ${order.isUrgent ? 'ring-2 ring-orange-400 dark:ring-orange-500' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{order.title}</h1>
            {order.isUrgent && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 animate-pulse">
                <Zap size={12} />
                {t('orders.urgentLabel')}
              </span>
            )}
          </div>
          <span className={`badge ${statusColor} shrink-0 ml-2`}>{t(`orderStatus.${order.status}`)}</span>
        </div>

        {order.status === 'PUBLISHED' && order.autoCancelAt && (
          <div className="mb-3">
            <AutoCancelCountdown autoCancelAt={order.autoCancelAt} />
          </div>
        )}

        <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-line">{order.description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <DollarSign size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
            <span className="font-semibold">{formatPrice(order.price, t('common.currency'))}</span>
            {order.priceMax && (
              <span className="text-gray-400 dark:text-gray-500 ml-1">— {formatPrice(order.priceMax, t('common.currency'))}</span>
            )}
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <MapPin size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
            <span className="truncate">
              {[order.city, order.district, order.street].filter(Boolean).join(', ') || order.address || t('orders.notSpecified')}
            </span>
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <Clock size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
            {order.deadline
              ? new Date(order.deadline).toLocaleDateString(locale)
              : t('orders.noDeadline')}
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <MessageSquare size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
            {order._count?.responses || 0} {t('orders.responses')}
          </div>
        </div>

        {/* Эскроу инфо */}
        {order.escrowAmount > 0 && (
          <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center gap-2">
            <Shield size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-400">
              {t('antiFraud.escrowHeld')}: {formatPrice(order.escrowAmount, t('common.currency'))}
            </span>
          </div>
        )}
      </div>

      {/* Информация о категории */}
      {order.category && (
        <div className="card mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('orders.category')}</span>
          <p className="font-medium dark:text-white">
            {order.category.name}
          </p>
        </div>
      )}

      {/* Выбранные задачи */}
      {order.orderTasks && order.orderTasks.length > 0 && (
        <div className="card mb-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('createOrder.selectedTasks')}</h2>
          <div className="space-y-2">
            {order.orderTasks.map((ot) => (
              <div key={ot.id} className="flex items-start gap-2 text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                <span className="text-green-600 dark:text-green-400 mt-0.5"><Check size={14} /></span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{ot.task?.name}</p>
                  {ot.task?.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ot.task.description}</p>
                  )}
                  {ot.task?.estimatedTime && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{ot.task.estimatedTime}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Фотографии заказа — видны всем */}
      {order.images && order.images.filter((img: string) => img.startsWith('http') || img.startsWith('data:')).length > 0 && (
        <div className="card mb-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">Фотографии заказа</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {order.images.filter((img: string) => img.startsWith('http') || img.startsWith('data:')).map((img: string, idx: number) => (
              <a key={idx} href={img.startsWith('data:') ? undefined : img} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={img}
                  alt={`Фото ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Таймлайн хода выполнения */}
      <div className="mb-4">
        <OrderTimeline
          orderStatus={order.status}
          createdAt={order.createdAt}
          acceptedAt={order.acceptedAt || undefined}
          inTransitAt={order.inTransitAt || undefined}
          completedAt={order.completedAt || undefined}
          masterConfirmedAt={order.masterConfirmedAt || undefined}
          clientConfirmedAt={order.clientConfirmedAt || undefined}
        />
      </div>

      {/* Комментарий администратора */}
      {(order.adminComment || isAdmin) && (
        <div className="card mb-4 border border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">{t('orderDetail.adminComment')}</p>
                {isAdmin && !editingAdminComment && (
                  <button
                    onClick={() => { setAdminCommentDraft(order.adminComment || ''); setEditingAdminComment(true); }}
                    className="text-xs text-purple-500 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {order.adminComment ? 'Изменить' : '+ Добавить'}
                  </button>
                )}
              </div>
              {editingAdminComment ? (
                <div className="mt-2">
                  <textarea
                    value={adminCommentDraft}
                    onChange={(e) => setAdminCommentDraft(e.target.value)}
                    className="input text-sm w-full"
                    rows={3}
                    placeholder="Комментарий к заказу..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.updateOrderComment(id!, adminCommentDraft);
                          setEditingAdminComment(false);
                          loadOrder();
                          toast.success('Комментарий сохранён');
                        } catch { toast.error('Ошибка сохранения'); }
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-purple-500 text-white hover:bg-purple-600"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditingAdminComment(false)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : order.adminComment ? (
                <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{order.adminComment}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ БЛОК ОЦЕНКИ (Estimation Order) ═══════ */}
      {order.isEstimationOrder && (
        <div className="card mb-4 border-2 border-cyan-300 dark:border-cyan-700 bg-cyan-50/50 dark:bg-cyan-900/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/40 rounded-xl flex items-center justify-center">
              <span className="text-lg"><Search size={20} /></span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Заказ на оценку</h3>
              <p className="text-xs text-gray-500">Выезд мастера: {formatPrice(order.estimationFee || 150000, t('common.currency'))}</p>
            </div>
          </div>

          {/* Мастер: принять заказ на оценку */}
          {isMaster && !isAssignedMaster && order.status === 'PUBLISHED' && (
            <button
              onClick={async () => {
                try {
                  await estimationApi.acceptEstimation(order.id);
                  toast.success('Заказ принят! Выезжайте к клиенту.');
                  loadOrder();
                } catch (err: any) {
                  toast.error(err.response?.data?.error?.message || 'Ошибка');
                }
              }}
              className="w-full py-3 bg-cyan-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-cyan-700"
            >
              Принять заказ на оценку (комиссия 30 000 сум)
            </button>
          )}

          {/* Мастер: составить смету */}
          {isAssignedMaster && ['ESTIMATION_IN_PROGRESS', 'ESTIMATION_DONE', 'ESTIMATE_SENT'].includes(order.status) && (
            <Link
              to={`/estimation/${order.id}/form`}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700"
            >
              {order.status === 'ESTIMATION_IN_PROGRESS' ? 'Составить смету' : 'Редактировать смету'}
            </Link>
          )}

          {/* Клиент: посмотреть смету */}
          {isOwner && ['ESTIMATE_SENT', 'ESTIMATE_APPROVED', 'ESTIMATE_REJECTED', 'MODERATION'].includes(order.status) && (
            <Link
              to={`/estimation/${order.id}/estimate`}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 mt-2"
            >
              Посмотреть смету
            </Link>
          )}

          {/* Статус-сообщения */}
          {order.status === 'ESTIMATION_IN_PROGRESS' && isOwner && (
            <p className="text-sm text-cyan-700 dark:text-cyan-400 mt-2">Мастер выехал. Ожидайте замеры и смету.</p>
          )}
          {order.status === 'ESTIMATE_APPROVED' && (
            <p className="text-sm text-green-700 dark:text-green-400 mt-2">Смета одобрена. Ожидание модерации.</p>
          )}
          {order.status === 'MODERATION' && (
            <p className="text-sm text-violet-700 dark:text-violet-400 mt-2">Смета на модерации. Администратор проверяет.</p>
          )}
          {order.status === 'ESTIMATE_REJECTED' && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">Смета отклонена клиентом. Мастер получил 120 000 сум за выезд.</p>
          )}
        </div>
      )}

      {/* Назначенный мастер */}
      {order.masterId && order.master && (
        <div className="card mb-4">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('orderDetail.assignedMaster')}</h2>
          <MasterCard master={order.master} compact showFavorite={isClient} />
        </div>
      )}

      {/* Live-карта для клиента: мастер в пути */}
      {isOwner &&
        order.masterId &&
        order.latitude &&
        order.longitude &&
        (order.status === 'ACCEPTED' || order.status === 'IN_TRANSIT') && (
          <div className="card mb-4 border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Truck size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {order.status === 'IN_TRANSIT' ? 'Мастер уже в пути' : 'Мастер скоро выедет'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {masterLive
                    ? 'Точка обновляется в реальном времени'
                    : 'Когда мастер начнёт движение, его позиция появится на карте'}
                </p>
              </div>
            </div>
            <OrderRouteMap
              orderLat={order.latitude}
              orderLng={order.longitude}
              masterLat={masterLive?.lat}
              masterLng={masterLive?.lng}
              height={240}
              showActions={false}
              orderLabel="Адрес заказа"
            />
          </div>
        )}

      {/* ═══════ КНОПКИ ДЕЙСТВИЙ МАСТЕРА ═══════ */}

      {/* Мастер: ACCEPTED → В пути */}
      {isAssignedMaster && order.status === 'ACCEPTED' && (
        <div className="card mb-4 border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <Truck size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('antiFraud.goToClient')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('antiFraud.goToClientDesc')}</p>
            </div>
          </div>
          <button
            onClick={() => handleUpdateStatus('IN_TRANSIT')}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
          >
            <Truck size={18} />
            {t('antiFraud.iAmOnMyWay')}
          </button>
          {/* Встроенная карта с маршрутом и кнопками навигаторов */}
          {order.latitude && order.longitude && (
            <div className="mt-4">
              <OrderRouteMap
                orderLat={order.latitude}
                orderLng={order.longitude}
                myLat={masterLive?.lat}
                myLng={masterLive?.lng}
                height={220}
                orderLabel={[order.city, order.district, order.street].filter(Boolean).join(', ') || order.address || 'Адрес заказа'}
              />
            </div>
          )}
        </div>
      )}

      {/* Мастер: IN_TRANSIT → Начать работу */}
      {isAssignedMaster && order.status === 'IN_TRANSIT' && (
        <div className="card mb-4 border-2 border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <CheckCircle size={22} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('antiFraud.arrivedAtClient')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('antiFraud.arrivedDesc')}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                ⚠️ Нажать можно только на месте заказа (радиус 500 м)
              </p>
            </div>
          </div>
          <button
            onClick={() => handleUpdateStatus('IN_PROGRESS')}
            disabled={arriving}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            {arriving ? 'Проверяем вашу позицию…' : t('antiFraud.startWork')}
          </button>
          {/* Встроенная карта */}
          {order.latitude && order.longitude && (
            <div className="mt-4">
              <OrderRouteMap
                orderLat={order.latitude}
                orderLng={order.longitude}
                myLat={masterLive?.lat}
                myLng={masterLive?.lng}
                height={220}
                orderLabel={[order.city, order.district, order.street].filter(Boolean).join(', ') || order.address || 'Адрес заказа'}
              />
            </div>
          )}
        </div>
      )}

      {/* Мастер: IN_PROGRESS → Подтвердить выполнение */}
      {isAssignedMaster && order.status === 'IN_PROGRESS' && !order.masterConfirmedAt && (
        <div className="card mb-4 border-2 border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <ThumbsUp size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('antiFraud.confirmWorkDone')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('antiFraud.confirmWorkDoneDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleMasterConfirm}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            <ThumbsUp size={18} />
            {t('antiFraud.workCompleted')}
          </button>
        </div>
      )}

      {/* Мастер подтвердил, ждём клиента */}
      {isAssignedMaster && order.status === 'IN_PROGRESS' && order.masterConfirmedAt && !order.clientConfirmedAt && (
        <div className="card mb-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-300 dark:border-yellow-700">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">{t('antiFraud.waitingClientConfirm')}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{t('antiFraud.autoConfirmHint')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ КНОПКИ ДЕЙСТВИЙ КЛИЕНТА ═══════ */}

      {/* Клиент: IN_PROGRESS → Подтвердить завершение */}
      {isOwner && order.status === 'IN_PROGRESS' && order.masterConfirmedAt && !order.clientConfirmedAt && (
        <div className="card mb-4 border-2 border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <ThumbsUp size={22} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white">{t('antiFraud.confirmCompletion')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{t('antiFraud.confirmCompletionDesc')}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">{t('antiFraud.autoConfirmWarning')}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleClientConfirm}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
            >
              <ThumbsUp size={18} />
              {t('antiFraud.acceptWork')}
            </button>
            <button
              onClick={() => setShowDispute(true)}
              className="py-3 px-4 rounded-xl font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all flex items-center gap-2"
            >
              <AlertTriangle size={18} />
              {t('antiFraud.openDispute')}
            </button>
          </div>
        </div>
      )}

      {/* Клиент подтвердил, ждём мастера */}
      {isOwner && order.status === 'IN_PROGRESS' && order.clientConfirmedAt && !order.masterConfirmedAt && (
        <div className="card mb-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-300 dark:border-yellow-700">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">{t('antiFraud.waitingMasterConfirm')}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">{t('antiFraud.bothMustConfirm')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Кнопка отмены (со штрафом) — для клиента и мастера */}
      {(isOwner || isAssignedMaster) && !['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(order.status) && (
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="w-full mb-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 transition-all flex items-center justify-center gap-2"
        >
          <XCircle size={16} />
          {t('orderDetail.cancelOrder')}
          {penaltyInfo.amount > 0 && (
            <span className="text-xs ml-1">({t('antiFraud.penalty')}: {formatPrice(penaltyInfo.amount, t('common.currency'))})</span>
          )}
        </button>
      )}

      {/* Кнопка отзыва */}
      {isOwner && order.status === 'COMPLETED' && !showReview && (
        <div className="flex gap-2 mb-4">
          <Link
            to={`/orders/${order.id}/review`}
            className="btn-primary flex-1 flex items-center justify-center"
          >
            <Star size={18} className="mr-2" />
            {t('orderDetail.leaveReview')}
          </Link>
          <Link
            to={`/orders/${order.id}/report`}
            className="btn-secondary flex items-center justify-center text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
          >
            <AlertTriangle size={18} className="mr-2" />
            {t('orderDetail.report')}
          </Link>
        </div>
      )}

      {/* Информация о штрафе (если заказ отменён) */}
      {order.status === 'CANCELLED' && order.penaltyAmount > 0 && (
        <div className="card mb-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <Ban size={20} className="text-red-500 dark:text-red-400" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                {t('antiFraud.penaltyApplied')}: {formatPrice(order.penaltyAmount, t('common.currency'))}
              </p>
              {order.cancelReason && (
                <p className="text-xs text-red-500 dark:text-red-400/80 mt-0.5">{order.cancelReason}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('antiFraud.cancelledBy')}: {order.cancelledBy === 'CLIENT' ? t('antiFraud.byClient') : order.cancelledBy === 'MASTER' ? t('antiFraud.byMaster') : t('antiFraud.byAdmin')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Информация о споре */}
      {order.status === 'DISPUTED' && (
        <div className="card mb-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-3">
            <Scale size={20} className="text-orange-500 dark:text-orange-400" />
            <div>
              <p className="font-semibold text-orange-700 dark:text-orange-400">{t('antiFraud.disputeInProgress')}</p>
              {order.disputeReason && (
                <p className="text-sm text-orange-600 dark:text-orange-400/80 mt-1">{order.disputeReason}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('antiFraud.disputeAdminReview')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Информация о комиссии для мастера (автоматическая) */}
      {isAssignedMaster && ['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS'].includes(order.status) && (
        <div className="card mb-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Комиссия платформы: {Number(order.commissionRate)}%</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Удерживается автоматически при завершении заказа ({formatPrice(order.commissionAmount, t('common.currency'))})
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Вы получите: {formatPrice(Number(order.escrowAmount) - Number(order.commissionAmount), t('common.currency'))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Данные клиента (видит мастер сразу после принятия заказа) */}
      {isAssignedMaster && order.client && ['ACCEPTED', 'IN_TRANSIT', 'IN_PROGRESS', 'COMPLETED'].includes(order.status) && (
        <div className="card mb-4 bg-green-50/50 dark:bg-green-900/10 border-2 border-green-300 dark:border-green-700">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
            <h3 className="font-bold text-green-800 dark:text-green-300">{t('commissionPayment.clientData')}</h3>
          </div>

          {order.client.phone && (
            <a href={`tel:${order.client.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 mb-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <Phone size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('commissionPayment.clientPhone')}</p>
                <p className="font-semibold text-gray-900 dark:text-white">{order.client.phone}</p>
              </div>
            </a>
          )}

          {order.client.profile && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <User size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('commissionPayment.clientName')}</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {order.client.profile.firstName} {order.client.profile.lastName}
                </p>
              </div>
            </div>
          )}

          {(order.city || order.address) && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 mb-2">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <MapPin size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('commissionPayment.clientAddress')}</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {[order.region, order.city, order.district, order.street, order.address].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}

          {order.latitude && order.longitude && (
            <div className="space-y-2">
              {/* Кнопка Яндекс.Навигатор */}
              <a
                href={`yandexnavi://build_route_on_map?lat_to=${order.latitude}&lon_to=${order.longitude}`}
                onClick={() => {
                  setTimeout(() => {
                    window.open(`https://yandex.ru/maps/?rtext=~${order.latitude},${order.longitude}&rtt=auto`, '_blank');
                  }, 500);
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Navigation size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Яндекс.Навигатор</p>
                  <p className="text-xs text-white/80">Проложить маршрут к клиенту</p>
                </div>
                <Map size={16} className="opacity-60" />
              </a>

              {/* Запасная ссылка на карту */}
              <a
                href={`https://yandex.ru/maps/?pt=${order.longitude},${order.latitude}&z=16&l=map`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <Map size={18} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('commissionPayment.clientGeo')}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">Показать на карте</p>
                </div>
              </a>
            </div>
          )}

          {/* Описание заказа для мастера — полное */}
          {order.description && (
            <div className="mt-3 p-3 rounded-xl bg-white dark:bg-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Описание заказа</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{order.description}</p>
            </div>
          )}

          {/* Фотографии заказа для мастера */}
          {order.images && order.images.filter((img: string) => img.startsWith('http') || img.startsWith('data:')).length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-white dark:bg-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Фотографии заказа</p>
              <div className="grid grid-cols-3 gap-2">
                {order.images.filter((img: string) => img.startsWith('http') || img.startsWith('data:')).map((img: string, idx: number) => (
                  <a key={idx} href={img.startsWith('data:') ? undefined : img} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={img}
                      alt={`Фото ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Форма отзыва */}
      {showReview && (
        <div className="card mb-4">
          <h3 className="font-semibold mb-3 dark:text-white">{t('orderDetail.rateMaster')}</h3>
          <div className="mb-3">
            <StarRating rating={reviewRating} onRate={setReviewRating} />
          </div>
          <textarea
            className="textarea mb-3"
            rows={3}
            placeholder={t('orderDetail.reviewPlaceholder')}
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleSubmitReview} disabled={submitting} className="btn-primary">{t('orderDetail.submitReview')}</button>
            <button onClick={() => setShowReview(false)} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* Фото до/после работ */}
      {(order.status === 'IN_PROGRESS' || order.status === 'COMPLETED') && (
        <PhotoGallery
          orderId={order.id}
          photos={photos}
          isParticipant={isOwner || order.masterId === user?.id}
          onPhotosChange={() => {
            photosApi.getByOrder(order.id).then(r => setPhotos(r.data.data || [])).catch(() => {});
          }}
        />
      )}

      {/* Гарантия на работу */}
      {(order.status === 'COMPLETED' || order.status === 'IN_PROGRESS') && (
        <GuaranteeWidget
          orderId={order.id}
          isClient={isOwner}
          isMaster={order.masterId === user?.id}
          orderStatus={order.status}
        />
      )}

      {/* Отклики */}
      {order.responses && order.responses.length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3 dark:text-white">
            {t('orderDetail.responses')} ({order.responses.length})
          </h2>
          <div className="space-y-3">
            {order.responses.map((resp: OrderResponse) => (
              <div key={resp.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {resp.master?.profile?.avatarUrl ? (
                        <img src={resp.master.profile.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                          <User size={20} className="text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                      {resp.master?.masterProfile && (
                        <span className={`absolute -bottom-0.5 -right-0.5 block w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                          resp.master.masterProfile.isOnline
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-gray-400 dark:bg-gray-600'
                        }`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium dark:text-white">{resp.master?.profile?.firstName || t('orderDetail.master')}</p>
                      {resp.master?.masterProfile && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Star size={12} className="text-yellow-400 mr-1" />
                          {resp.master.masterProfile.rating?.toFixed(1) || '—'}
                          <span className="mx-1">·</span>
                          {resp.master.masterProfile.completedOrders || 0} {t('orderDetail.ordersCount')}
                          {resp.master.masterProfile.isOnline ? (
                            <span className="ml-2 text-green-600 dark:text-green-400 text-xs">{t('masterCard.online')}</span>
                          ) : resp.master.masterProfile.lastSeenAt ? (
                            <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">
                              {t('masterCard.lastSeen')} {formatLastSeen(resp.master.masterProfile.lastSeenAt)}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  {resp.priceOffer && (
                    <span className="font-semibold text-primary-600 dark:text-primary-400">
                      {formatPrice(resp.priceOffer, t('common.currency'))}
                    </span>
                  )}
                </div>
                {resp.message && <p className="text-gray-700 dark:text-gray-300 mt-2">{resp.message}</p>}
                {isOwner && order.status === 'PUBLISHED' && resp.status === 'PENDING' && (
                  <button onClick={() => handleAssignMaster(resp.masterId)} className="btn-primary mt-3 text-sm">
                    {t('orderDetail.chooseMaster')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Форма отклика для мастера */}
      {isMaster && order.status === 'PUBLISHED' && !isOwner && (
        <div
          ref={respondFormRef}
          className={`card transition-all duration-500 ${
            respondHighlight ? 'ring-2 ring-primary-500 shadow-xl scale-[1.01]' : ''
          }`}
        >
          <h3 className="font-semibold mb-3 dark:text-white">{t('orderDetail.respondTitle')}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">{t('orderDetail.yourPrice')}</label>
              <input
                type="number"
                className="input"
                placeholder={t('orderDetail.priceInSum')}
                value={responsePrice}
                onChange={(e) => setResponsePrice(e.target.value)}
              />
            </div>
            <button onClick={handleRespond} disabled={submitting} className="btn-primary">
              <Send size={16} className="mr-2" />
              {t('orderDetail.respond')}
            </button>
          </div>
        </div>
      )}

      {/* Чат заказа */}
      {order.masterId && (isOwner || order.masterId === user?.id) && (
        <OrderChat orderId={order.id} isParticipant={true} />
      )}

      {/* ═══════ МОДАЛКИ ═══════ */}

      {/* Модалка подтверждения отмены со штрафом */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                penaltyInfo.level === 'danger' ? 'bg-red-100 dark:bg-red-900/40' :
                penaltyInfo.level === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/40' :
                'bg-gray-100 dark:bg-gray-700'
              }`}>
                <Ban size={24} className={
                  penaltyInfo.level === 'danger' ? 'text-red-500' :
                  penaltyInfo.level === 'warning' ? 'text-yellow-500' :
                  'text-gray-400'
                } />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('antiFraud.cancelConfirmTitle')}</h3>
                {penaltyInfo.amount > 0 ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t('antiFraud.penaltyWarning')}: {formatPrice(penaltyInfo.amount, t('common.currency'))}
                  </p>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-400">{t('antiFraud.freeCancellation')}</p>
                )}
              </div>
            </div>

            <textarea
              className="textarea mb-4"
              rows={2}
              placeholder={t('antiFraud.cancelReasonPlaceholder')}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                {t('antiFraud.confirmCancel')}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка спора */}
      {showDispute && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md animate-in slide-in-from-bottom">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Scale size={24} className="text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('antiFraud.openDisputeTitle')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('antiFraud.openDisputeDesc')}</p>
              </div>
            </div>

            <textarea
              className="textarea mb-4"
              rows={3}
              placeholder={t('antiFraud.disputeReasonPlaceholder')}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={handleDispute}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              >
                {t('antiFraud.submitDispute')}
              </button>
              <button
                onClick={() => setShowDispute(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка оплаты комиссии */}
      <CommissionPaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onSuccess={loadOrder}
        orderId={order.id}
        orderTitle={order.title}
        commissionAmount={order.commissionAmount}
        isUrgent={order.isUrgent}
      />
    </div>
  );
}
