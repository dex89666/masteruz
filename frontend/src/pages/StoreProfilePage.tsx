// ============================================
// MasterUz — Страница магазина (детали)
// ============================================

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { storesApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export function StoreProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const { data: store, isLoading, refetch } = useQuery({
    queryKey: ['store', slug],
    queryFn: () => storesApi.getBySlug(slug!).then(r => r.data.data),
    enabled: !!slug,
  });

  const reviewMutation = useMutation({
    mutationFn: () => storesApi.addReview(slug!, { rating: reviewRating, comment: reviewComment }),
    onSuccess: () => {
      toast.success(t('stores.reviewAdded'));
      setShowReviewForm(false);
      setReviewComment('');
      refetch();
    },
    onError: () => toast.error(t('common.error')),
  });

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!store) return <div className="text-center py-20 text-gray-500">{t('stores.notFound')}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Cover */}
      <div className="h-48 md:h-64 bg-gradient-to-br from-orange-400 to-amber-300 relative">
        {store.coverUrl && <img src={store.coverUrl} alt="" className="w-full h-full object-cover" />}
        <Link to="/stores" className="absolute top-4 left-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full px-4 py-2 text-sm font-medium">
          ← {t('common.back')}
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-12 relative z-10">
        {/* Store header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-orange-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-3xl shrink-0">
              {store.logoUrl ? <img src={store.logoUrl} alt="" className="w-full h-full rounded-2xl object-cover" /> : '🏪'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{store.name}</h1>
                {store.isVerified && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ {t('common.verified')}</span>}
              </div>
              {store.description && <p className="text-gray-600 dark:text-gray-400 mt-1">{store.description}</p>}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">⭐ {store.rating.toFixed(1)} ({store.reviewCount})</span>
                <span className="flex items-center gap-1">📍 {store.address || store.city}</span>
                {store.workingHours && <span className="flex items-center gap-1">🕐 {store.workingHours}</span>}
                {store.deliveryAvailable && <span className="flex items-center gap-1 text-green-600">🚚 {t('stores.deliveryAvailable')}</span>}
              </div>
              {store.discountForMasters && (
                <div className="mt-2 inline-block bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm px-3 py-1 rounded-lg">
                  🔥 {t('stores.masterDiscount')}: -{store.discountForMasters}%
                </div>
              )}
            </div>
          </div>

          {/* Contact buttons */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <a href={`tel:${store.phone}`} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition text-sm font-medium">
              📞 {t('stores.call')}
            </a>
            {store.telegramUsername && (
              <a href={`https://t.me/${store.telegramUsername}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition text-sm font-medium">
                ✈️ Telegram
              </a>
            )}
            {store.website && (
              <a href={store.website} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl hover:bg-gray-300 transition text-sm font-medium">
                🌐 {t('stores.website')}
              </a>
            )}
          </div>
        </div>

        {/* Products */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📦 {t('stores.productsTitle')}</h2>
          {store.products && store.products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.products.map((product: any) => (
                <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg mb-3 flex items-center justify-center text-3xl">📦</div>
                  )}
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{product.name}</h3>
                  {product.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{product.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-orange-600 font-bold">{product.price.toLocaleString()} {t('common.currency')}</span>
                    {product.unit && <span className="text-xs text-gray-500">/ {product.unit}</span>}
                  </div>
                  {!product.inStock && <span className="text-xs text-red-500 mt-1 block">{t('stores.outOfStock')}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{t('stores.noProducts')}</p>
          )}
        </div>

        {/* Reviews */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">⭐ {t('stores.reviewsTitle')}</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowReviewForm(v => !v)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition"
              >
                {t('stores.writeReview')}
              </button>
            )}
          </div>

          {showReviewForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setReviewRating(star)} className="text-2xl">
                    {star <= reviewRating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={t('stores.reviewPlaceholder')}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                rows={3}
              />
              <button
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
                className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {reviewMutation.isPending ? t('common.saving') : t('stores.submitReview')}
              </button>
            </div>
          )}

          {store.reviews && store.reviews.length > 0 ? (
            <div className="space-y-3">
              {store.reviews.map((review: any) => (
                <div key={review.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-500">{'⭐'.repeat(review.rating)}</span>
                    <span className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  {review.comment && <p className="text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{t('stores.noReviews')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
