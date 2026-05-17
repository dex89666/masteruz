// ============================================
// MasterUz — Client Review Page
// Мастер оценивает клиента после завершения заказа (двусторонние отзывы)
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ArrowLeft, ThumbsUp, AlertTriangle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import { ordersApi, riskApi } from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTelegram } from '../hooks';
import type { Order } from '../types';

interface NegativeFlag {
  key: 'wasRude' | 'wasNoShow' | 'haggledHard' | 'changedScope' | 'delayedPayment';
  label: string;
  description: string;
}

const NEGATIVE_FLAGS: NegativeFlag[] = [
  { key: 'wasNoShow', label: 'Не пришёл / не открыл', description: 'Клиент не появился в назначенное время' },
  { key: 'wasRude', label: 'Хамил / грубил', description: 'Неуважительное поведение' },
  { key: 'haggledHard', label: 'Торговался после', description: 'Сбивал цену после согласования' },
  { key: 'changedScope', label: 'Менял ТЗ по ходу', description: 'Расширял задание во время работ' },
  { key: 'delayedPayment', label: 'Тянул оплату', description: 'Задерживал перевод после завершения' },
];

export function ClientReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [rating, setRating] = useState(0);
  const [flags, setFlags] = useState<Set<NegativeFlag['key']>>(new Set());
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.getById(orderId!);
      setOrder(res.data.data);
    } catch {
      toast.error('Не удалось загрузить заказ');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [orderId, navigate]);

  useEffect(() => { if (orderId) load(); }, [orderId, load]);

  function toggleFlag(key: NegativeFlag['key']) {
    hapticImpact?.('light');
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Поставьте оценку');
      return;
    }
    setSubmitting(true);
    try {
      await riskApi.reviewClient({
        orderId: orderId!,
        overall: rating,
        wasRude: flags.has('wasRude'),
        wasNoShow: flags.has('wasNoShow'),
        haggledHard: flags.has('haggledHard'),
        changedScope: flags.has('changedScope'),
        delayedPayment: flags.has('delayedPayment'),
        comment: comment.trim() || undefined,
      });
      hapticNotification?.('success');
      setSubmitted(true);
      toast.success('Отзыв о клиенте сохранён');
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Не удалось отправить отзыв');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!order) return null;

  if (submitted) {
    return (
      <div className="page-container pb-20">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 animate-scale-in">
            <ThumbsUp size={40} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Спасибо</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ваш отзыв учтён в риск-скоринге клиента и поможет коллегам.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold"
          >
            В кабинет мастера
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-24 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 hover:text-gray-900 dark:hover:text-white"
      >
        <ArrowLeft size={16} /> Назад
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Оценка клиента</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-1 mb-6">
        Заказ #{order.id.slice(0, 8)} · «{order.title}»
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Звёзды */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold mb-3 dark:text-white">Общая адекватность</h2>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => { hapticImpact?.('light'); setRating(i); }}
                className="p-1 transition-transform hover:scale-110 active:scale-95"
                aria-label={`${i} из 5`}
              >
                <Star
                  size={40}
                  className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              {rating <= 2 ? 'Сложный клиент' : rating === 3 ? 'Нормальный' : rating === 4 ? 'Хороший' : 'Отличный'}
            </p>
          )}
        </section>

        {/* Негативные флаги */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="font-semibold dark:text-white">Что не так? (необязательно)</h2>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {NEGATIVE_FLAGS.map((f) => {
              const active = flags.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleFlag(f.key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    active
                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700'
                      : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className={`font-medium ${active ? 'text-rose-700 dark:text-rose-300' : 'text-gray-800 dark:text-gray-200'}`}>
                    {f.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.description}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Комментарий */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <label className="block font-semibold dark:text-white mb-2">Комментарий (необязательно)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Поделитесь деталями — отзыв виден только модераторам и в риск-скоринге"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="text-xs text-gray-400 mt-1 text-right">{comment.length}/1000</div>
        </section>

        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold disabled:opacity-50 transition"
        >
          <Send size={18} />
          {submitting ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
