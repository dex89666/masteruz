// ============================================
// MasterUz — Master Public Profile Page
// Публичный профиль мастера с отзывами
// ============================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usersApi, favoritesApi, portfolioApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ProfileSkeleton } from '../components/PageSkeletons';
import {
  Star, MapPin, Award, Shield,
  Heart, MessageSquare, User,
  Image, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as UserType, Review, PortfolioItem } from '../types';

export function MasterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // formatPrice removed (hourlyRate hidden from public profile)
  const { t } = useTranslation();

  const [master, setMaster] = useState<UserType | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const isClient = user?.role === 'CLIENT';

  useEffect(() => {
    if (id) loadMaster();
  }, [id]);

  async function loadMaster() {
    try {
      const res = await usersApi.getMaster(id!);
      setMaster(res.data.data);
      setReviews(res.data.data?.reviewsReceived || []);
      // Load portfolio
      try {
        const portfolioRes = await portfolioApi.getMasterPortfolio(id!);
        setPortfolio(portfolioRes.data.data || []);
      } catch { /* no portfolio — ok */ }
      // Check if favorite
      if (isClient) {
        try {
          const favRes = await favoritesApi.check(id!);
          setIsFavorite(favRes.data.data?.isFavorite || false);
        } catch { /* ignore */ }
      }
    } catch {
      toast.error(t('masters.masterNotFound'));
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!isClient) return;
    try {
      if (isFavorite) {
        await favoritesApi.remove(id!);
        setIsFavorite(false);
        toast.success(t('favorites.removed'));
      } else {
        await favoritesApi.add(id!);
        setIsFavorite(true);
        toast.success(t('favorites.added'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  }

  if (loading) return <ProfileSkeleton />;
  if (!master) return null;

  const mp = master.masterProfile;
  const profile = master.profile;

  return (
    <div className="page-container pb-20">
      {/* Back button */}
      <Breadcrumbs items={[
        { label: t('masters.title'), href: '/masters' },
        { label: profile?.firstName ? `${profile.firstName} ${profile?.lastName || ''}` : t('masters.master') },
      ]} />

      {/* Header card */}
      <div className="card mb-4">
        <div className="flex items-start gap-4">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile?.firstName || t('masters.master')}{' '}
                  {profile?.lastName || ''}
                </h1>
                {master.isVerified && (
                  <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400 mt-0.5">
                    <Shield size={12} className="mr-0.5" />
                    {t('common.verified')}
                  </span>
                )}
              </div>
              {isClient && (
                <button
                  onClick={toggleFavorite}
                  className={`p-2 rounded-full transition-colors ${
                    isFavorite ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-300 dark:text-gray-600 hover:text-red-400'
                  }`}
                >
                  <Heart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>

            {profile?.city && (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                <MapPin size={14} className="mr-1" />
                {t(`cities.${profile.city}` as any) || profile.city}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {mp && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="card text-center p-3">
            <div className="flex items-center justify-center mb-1">
              <Star size={16} className="text-yellow-400 mr-1" />
              <span className="text-lg font-bold dark:text-white">{mp.rating?.toFixed(1) || '—'}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('masterCard.rating')}</p>
          </div>
          <div className="card text-center p-3">
            <div className="text-lg font-bold text-primary-600 dark:text-primary-400">{mp.completedOrders || 0}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('masterCard.completedOrders')}</p>
          </div>
          <div className="card text-center p-3">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{mp.experienceYears || 0}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('masterCard.experience')}</p>
          </div>
          <div className="card text-center p-3">
            <div className={`text-lg font-bold ${mp.isAvailable ? 'text-green-500' : 'text-red-400'}`}>
              {mp.isAvailable ? '' : ''}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mp.isAvailable ? t('masterCard.available') : t('masterCard.busy')}
            </p>
          </div>
        </div>
      )}

      {/* Bio */}
      {profile?.bio && (
        <div className="card mb-4">
          <h2 className="font-semibold mb-2 dark:text-white">{t('masters.about')}</h2>
          <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line">{profile.bio}</p>
        </div>
      )}

      {/* Service Categories (from MasterCategory M:N) */}
      {(mp as any)?.masterCategories && (mp as any).masterCategories.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold mb-2 dark:text-white">{t('masterCard.serviceCategories')}</h2>
          <div className="flex flex-wrap gap-2">
            {(mp as any).masterCategories.map((mc: any) => {
              const cat = mc.category;
              if (!cat) return null;
              return (
                <span key={cat.id} className="inline-flex items-center gap-1.5 badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-sm">
                  {cat.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Specializations (legacy) */}
      {mp && mp.specializations && mp.specializations.filter((s: string) => s && s !== 'general').length > 0 && !(mp as any).masterCategories?.length && (
        <div className="card mb-4">
          <h2 className="font-semibold mb-2 dark:text-white">{t('masterCard.specializations')}</h2>
          <div className="flex flex-wrap gap-2">
            {mp.specializations.filter((s: string) => s && s !== 'general').map((spec: string) => {
              const label = t(`categories.${spec}` as any);
              return (
                <span key={spec} className="badge bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-sm">
                  {label === `categories.${spec}` ? spec : label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Certificates */}
      {(master as any).certificates && (master as any).certificates.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-semibold mb-2 dark:text-white">{t('masters.certificates')}</h2>
          <div className="space-y-2">
            {(master as any).certificates.map((cert: any) => (
              <div key={cert.id} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Award size={18} className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium dark:text-white">{cert.title}</p>
                  {cert.isVerified && (
                    <span className="text-xs text-green-600 dark:text-green-400">{t('common.verified')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Gallery */}
      {portfolio.length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-3 dark:text-white flex items-center gap-2">
            <Image size={20} className="text-primary-500" />
            {t('portfolio.title')} ({portfolio.length})
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {portfolio.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setLightboxIdx(idx)}
                className="aspect-square rounded-xl overflow-hidden relative group"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-white text-xs font-medium line-clamp-1">{item.title}</span>
                </div>
                {item.likesCount > 0 && (
                  <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <Heart size={8} fill="currentColor" />
                    {item.likesCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Lightbox */}
      {lightboxIdx !== null && portfolio[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          >
            <X size={28} />
          </button>

          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-4 text-white/80 hover:text-white z-10"
            >
              <ChevronLeft size={36} />
            </button>
          )}
          {lightboxIdx < portfolio.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-4 text-white/80 hover:text-white z-10"
            >
              <ChevronRight size={36} />
            </button>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={portfolio[lightboxIdx].imageUrl}
              alt={portfolio[lightboxIdx].title}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center">
              <h3 className="text-white text-lg font-semibold">{portfolio[lightboxIdx].title}</h3>
              {portfolio[lightboxIdx].description && (
                <p className="text-white/70 text-sm mt-1">{portfolio[lightboxIdx].description}</p>
              )}
              {portfolio[lightboxIdx].category && (
                <span className="inline-block mt-2 text-xs bg-white/20 text-white px-3 py-1 rounded-full">
                  {portfolio[lightboxIdx].category?.name}
                </span>
              )}
              <p className="text-white/50 text-xs mt-2">
                {lightboxIdx + 1} / {portfolio.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3 dark:text-white">
          {t('masters.reviews')} ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('masters.noReviews')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {review.reviewer?.profile?.avatarUrl ? (
                      <img src={review.reviewer.profile.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <User size={16} className="text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium dark:text-white">
                        {review.reviewer?.profile?.firstName || t('masters.client')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 dark:text-gray-600'}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>
                )}
                {review.order && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {review.order.category?.name && `${review.order.category.name} · `}
                    {review.order.title}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
