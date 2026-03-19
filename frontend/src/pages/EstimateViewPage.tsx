// ============================================
// MasterUz — Estimate View Page (Client)
// Клиент просматривает и одобряет/отклоняет смету
// ============================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { estimationApi } from '../api/client';
import { Estimate, EstimateWorkItem, EstimateMaterialItem } from '../types';
import {
  ArrowLeft, Check, X, Hammer, Package, Clock,
  Calculator, Image as ImageIcon, FileText, AlertTriangle,
  MessageCircle, Shield, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function EstimateViewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);

  useEffect(() => {
    loadEstimate();
  }, [orderId]);

  async function loadEstimate() {
    if (!orderId) return;
    try {
      const res = await estimationApi.getEstimate(orderId);
      const estimates = res.data.data;
      // API возвращает массив (последние первыми) — берём первую
      if (Array.isArray(estimates) && estimates.length > 0) {
        setEstimate(estimates[0]);
      } else if (estimates && !Array.isArray(estimates)) {
        setEstimate(estimates as any);
      }
    } catch (err: any) {
      toast.error('Смета не найдена');
    }
    setLoading(false);
  }

  async function handleApprove() {
    if (!estimate) return;
    setSubmitting(true);
    try {
      await estimationApi.approveEstimate(estimate.id);
      toast.success('Смета одобрена! Ожидайте модерации.');
      navigate(`/orders/${orderId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Ошибка одобрения');
    } finally {
      setSubmitting(false);
      setShowApproveConfirm(false);
    }
  }

  async function handleReject() {
    if (!estimate) return;
    setSubmitting(true);
    try {
      await estimationApi.rejectEstimate(estimate.id);
      toast.success('Смета отклонена. Мастер получит 120 000 сум за выезд.');
      navigate(`/orders/${orderId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Ошибка отклонения');
    } finally {
      setSubmitting(false);
      setShowRejectModal(false);
    }
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { text: string; color: string; icon: any }> = {
      DRAFT: { text: 'Черновик', color: 'bg-gray-100 text-gray-600', icon: FileText },
      SENT: { text: 'Ожидает вашего решения', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
      APPROVED: { text: 'Одобрена', color: 'bg-green-100 text-green-700', icon: Check },
      REJECTED: { text: 'Отклонена', color: 'bg-red-100 text-red-700', icon: X },
      MODERATION: { text: 'На модерации', color: 'bg-blue-100 text-blue-700', icon: Shield },
    };
    const s = map[status] || map.DRAFT;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${s.color}`}>
        <Icon size={14} /> {s.text}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center py-20">
        <FileText size={48} className="text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-600 mb-2">Смета ещё не готова</h2>
        <p className="text-gray-400">Мастер пока не составил смету</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 font-semibold">← Назад</button>
      </div>
    );
  }

  const workItems = (estimate.workItems || []) as EstimateWorkItem[];
  const materialItems = (estimate.materialItems || []) as EstimateMaterialItem[];
  const canDecide = estimate.status === 'SENT';

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Смета</h1>
          <p className="text-sm text-gray-500">Заказ #{orderId?.slice(0, 8)}</p>
        </div>
        {getStatusBadge(estimate.status)}
      </div>

      {/* Мастер */}
      {estimate.master && (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
            <span className="text-lg"><Hammer size={20} /></span>
          </div>
          <div>
            <div className="font-semibold">{estimate.master.profile?.firstName || estimate.master.username || 'Мастер'}</div>
            <div className="text-xs text-gray-400">Составил смету</div>
          </div>
        </div>
      )}

      {/* ===== РАБОТЫ ===== */}
      <section className="mb-4">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <Hammer size={18} className="text-primary-600" />
          Работы ({workItems.length})
        </h2>
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
          {workItems.map((item, idx) => (
            <div key={idx} className={`p-3 ${idx > 0 ? 'border-t dark:border-gray-700' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.quantity} {item.unit} × {item.unitPrice.toLocaleString('ru')} сум
                  </div>
                </div>
                <div className="text-sm font-bold text-primary-600 whitespace-nowrap ml-3">
                  {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
                </div>
              </div>
            </div>
          ))}
          <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border-t dark:border-gray-700">
            <div className="flex justify-between font-bold text-sm">
              <span>Итого работы:</span>
              <span className="text-primary-600">{(estimate.workTotal || 0).toLocaleString('ru')} сум</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== МАТЕРИАЛЫ ===== */}
      {materialItems.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold flex items-center gap-2 mb-2">
            <Package size={18} className="text-orange-500" />
            Материалы ({materialItems.length})
          </h2>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden">
            {materialItems.map((item, idx) => (
              <div key={idx} className={`p-3 ${idx > 0 ? 'border-t dark:border-gray-700' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {item.quantity} {item.unit} × {item.unitPrice.toLocaleString('ru')} сум
                    </div>
                  </div>
                  <div className="text-sm font-bold text-orange-500 whitespace-nowrap ml-3">
                    {(item.quantity * item.unitPrice).toLocaleString('ru')} сум
                  </div>
                </div>
              </div>
            ))}
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-t dark:border-gray-700">
              <div className="flex justify-between font-bold text-sm">
                <span>Итого материалы:</span>
                <span className="text-orange-500">{(estimate.materialTotal || 0).toLocaleString('ru')} сум</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== ИТОГО ===== */}
      <div className="bg-gradient-to-r from-primary-50 to-green-50 dark:from-primary-900/20 dark:to-green-900/20 rounded-2xl p-4 mb-4 border-2 border-primary-200 dark:border-primary-800">
        <div className="flex items-center gap-2 mb-2">
          <Calculator size={20} className="text-primary-600" />
          <span className="font-bold text-lg">Общая стоимость</span>
        </div>
        <div className="text-3xl font-bold text-primary-600">
          {(estimate.totalAmount || 0).toLocaleString('ru')} сум
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
          <Clock size={14} />
          Срок: {estimate.estimatedDays || '?'}{' '}
          {(estimate.estimatedDays || 0) === 1 ? 'день' : (estimate.estimatedDays || 0) < 5 ? 'дня' : 'дней'}
        </div>
      </div>

      {/* ===== ФОТО ===== */}
      {estimate.photos && estimate.photos.length > 0 && (
        <section className="mb-4">
          <h2 className="font-bold flex items-center gap-2 mb-2">
            <ImageIcon size={18} className="text-green-500" />
            Фото замеров ({estimate.photos.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {estimate.photos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => setPhotoView(photo)}
                className="w-24 h-24 rounded-xl overflow-hidden border dark:border-gray-700"
              >
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== ПРИМЕЧАНИЯ ===== */}
      {estimate.notes && (
        <section className="mb-4">
          <h2 className="font-bold flex items-center gap-2 mb-2">
            <FileText size={18} className="text-purple-500" />
            Примечания мастера
          </h2>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 text-sm">
            {estimate.notes}
          </div>
        </section>
      )}

      {/* ===== Чат ===== */}
      <button
        onClick={() => navigate(`/orders/${orderId}/chat`)}
        className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 mb-4"
      >
        <MessageCircle size={18} />
        Обсудить с мастером в чате
      </button>

      {/* ===== КНОПКИ РЕШЕНИЯ ===== */}
      {canDecide && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 p-4 max-w-2xl mx-auto">
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={submitting}
              className="flex-1 py-3 border-2 border-red-500 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              <X size={18} />
              Отклонить
            </button>
            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={submitting}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
            >
              <Check size={18} />
              Одобрить
            </button>
          </div>
        </div>
      )}

      {estimate.status === 'APPROVED' && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center text-sm text-green-700 dark:text-green-400">
          <Check size={24} className="mx-auto mb-2" />
          <p className="font-bold">Смета одобрена!</p>
          <p>Заказ передан на модерацию. После проверки работа начнётся.</p>
        </div>
      )}

      {estimate.status === 'REJECTED' && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center text-sm text-red-700 dark:text-red-400">
          <X size={24} className="mx-auto mb-2" />
          <p className="font-bold">Смета отклонена</p>
          <p>Мастер получил 120 000 сум за выезд.</p>
        </div>
      )}

      {estimate.status === 'MODERATION' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center text-sm text-blue-700 dark:text-blue-400">
          <Shield size={24} className="mx-auto mb-2" />
          <p className="font-bold">На модерации</p>
          <p>Администратор проверяет смету. Ожидайте решения.</p>
        </div>
      )}

      {/* ===== МОДАЛКА ОДОБРЕНИЯ ===== */}
      {showApproveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApproveConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Одобрить смету?</h3>
              <p className="text-sm text-gray-500 mb-3">
                С вашего баланса будет списано:
              </p>
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {(estimate.totalAmount || 0).toLocaleString('ru')} сум
              </div>
              <p className="text-xs text-gray-400">
                Средства будут заблокированы до модерации. После проверки мастер начнёт работу.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveConfirm(false)}
                className="flex-1 py-3 border rounded-xl font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {submitting ? 'Подождите...' : 'Подтвердить оплату'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== МОДАЛКА ОТКЛОНЕНИЯ ===== */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-3">Отклонить смету?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Мастер получит <strong>120 000 сум</strong> за выезд.
              Оставшиеся 30 000 сум — комиссия платформы.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Причина отклонения (необязательно)"
              className="w-full p-3 border rounded-xl mb-4 h-20 resize-none dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 border rounded-xl font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {submitting ? 'Подождите...' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ПРОСМОТР ФОТО ===== */}
      {photoView && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setPhotoView(null)}>
          <button
            onClick={() => setPhotoView(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <img src={photoView} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
