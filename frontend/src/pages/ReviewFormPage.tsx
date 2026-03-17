// ============================================
// MasterUz — Review Form Page
// Оставление отзыва по завершённому заказу
// ============================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersApi, reviewsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTelegram } from '../hooks';
import { Star, Send, ArrowLeft, MessageSquare, ThumbsUp } from 'lucide-react';
import type { Order } from '../types';
import toast from 'react-hot-toast';

const QUICK_COMMENTS = [
  { key: 'excellent', emoji: '🌟' },
  { key: 'quality', emoji: '👍' },
  { key: 'fast', emoji: '⚡' },
  { key: 'polite', emoji: '😊' },
  { key: 'clean', emoji: '🧹' },
  { key: 'recommend', emoji: '💯' },
];

export function ReviewFormPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedQuick, setSelectedQuick] = useState<string[]>([]);
  const { hapticImpact, hapticNotification } = useTelegram();

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId]);

  async function loadOrder() {
    try {
      const res = await ordersApi.getById(orderId!);
      setOrder(res.data.data);
      // Check if review already exists
      if (res.data.data?.reviews?.length > 0) {
        setSubmitted(true);
        setRating(res.data.data.reviews[0].rating);
        setComment(res.data.data.reviews[0].comment || '');
      }
    } catch (error) {
      toast.error(t('common.error'));
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  function toggleQuickComment(key: string) {
    setSelectedQuick(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (rating === 0) {
      toast.error(t('review.ratingRequired'));
      return;
    }

    setSubmitting(true);
    try {
      // Build comment from quick tags + custom comment
      const quickTexts = selectedQuick.map(k => t(`review.quick_${k}`));
      const fullComment = [...quickTexts, comment].filter(Boolean).join('. ');

      await reviewsApi.create({
        orderId: orderId!,
        rating,
        comment: fullComment || undefined,
      });

      setSubmitted(true);
      hapticNotification?.('success');
      toast.success(t('review.submitted'));
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!order) return null;

  // Success screen after submitting
  if (submitted) {
    return (
      <div className="page-container pb-20">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 animate-scale-in">
            <ThumbsUp size={40} className="text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('review.thankYou')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">{t('review.thankYouDesc')}</p>

          <div className="flex items-center gap-1 my-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                size={28}
                className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}
              />
            ))}
          </div>

          {comment && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic max-w-sm">«{comment}»</p>
          )}

          <button
            onClick={() => navigate('/my-orders')}
            className="btn-primary mt-6"
          >
            {t('review.backToOrders')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
      >
        <ArrowLeft size={20} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title">{t('review.title')}</h1>

      {/* Order info */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-6">
        <h3 className="font-medium text-gray-900 dark:text-white">{order.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {order.category?.name} • {new Date(order.createdAt).toLocaleDateString()}
        </p>
        {order.master?.profile && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {order.master.profile.firstName?.[0] || '?'}
              </span>
            </div>
            <span className="text-sm font-medium">
              {order.master.profile.firstName} {order.master.profile.lastName || ''}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-3">{t('review.rateWork')}</h2>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                type="button"
                onClick={() => { setRating(i); hapticImpact?.('light'); }}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={40}
                  className={`transition-colors ${
                    i <= rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-200 hover:text-yellow-200'
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {rating === 5 ? t('review.rating5') :
               rating === 4 ? t('review.rating4') :
               rating === 3 ? t('review.rating3') :
               rating === 2 ? t('review.rating2') :
               t('review.rating1')}
            </p>
          )}
        </div>

        {/* Quick comments */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('review.quickTags')}</h3>
          <div className="flex flex-wrap gap-2">
            {QUICK_COMMENTS.map(({ key, emoji }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleQuickComment(key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedQuick.includes(key)
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-600 text-primary-700 dark:text-primary-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                {emoji} {t(`review.quick_${key}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <MessageSquare size={16} className="mr-1" />
            {t('review.comment')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('review.commentPlaceholder')}
            rows={4}
            className="input w-full resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/500</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {submitting ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              {t('common.loading')}
            </>
          ) : (
            <>
              <Send size={18} />
              {t('review.submit')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
