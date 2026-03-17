// ============================================
// MasterUz — MasterCard (карточка мастера)
// Компактный виджет с рейтингом, специализациями, кнопкой избранного
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Heart, MapPin, CheckCircle, Briefcase, Clock } from 'lucide-react';
import { favoritesApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useTelegram } from '../hooks';
import toast from 'react-hot-toast';

interface MasterCardProps {
  master: {
    id: string;
    profile?: {
      firstName: string;
      lastName?: string | null;
      avatarUrl?: string | null;
      city?: string | null;
    } | null;
    masterProfile?: {
      rating: number;
      completedOrders: number;
      experienceYears: number;
      specializations: string[];
      isAvailable: boolean;
      isOnline: boolean;
      lastSeenAt: string | null;
    } | null;
    isVerified?: boolean;
  };
  isFavorite?: boolean;
  showFavorite?: boolean;
  onToggleFavorite?: (masterId: string, newState: boolean) => void;
  compact?: boolean;
}

export function MasterCard({ master, isFavorite = false, showFavorite = false, onToggleFavorite, compact = false }: MasterCardProps) {
  const { t } = useTranslation();
  const { hapticImpact } = useTelegram();
  const [fav, setFav] = useState(isFavorite);
  const [toggling, setToggling] = useState(false);
  const mp = master.masterProfile;
  const profile = master.profile;

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

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    hapticImpact?.('light');
    try {
      if (fav) {
        await favoritesApi.remove(master.id);
        setFav(false);
        toast.success(t('favorites.removed'));
      } else {
        await favoritesApi.add(master.id);
        setFav(true);
        toast.success(t('favorites.added'));
      }
      onToggleFavorite?.(master.id, !fav);
    } catch {
      toast.error(t('common.error'));
    }
    setToggling(false);
  }

  return (
    <Link to={`/masters/${master.id}`} className={`card hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-all animate-fade-in block ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className={`rounded-full object-cover ${compact ? 'w-10 h-10' : 'w-14 h-14'}`}
            />
          ) : (
            <div className={`rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold ${compact ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-lg'}`}>
              {profile?.firstName?.charAt(0) || '?'}
            </div>
          )}
          {/* Online/Offline indicator */}
          {mp && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 block rounded-full border-2 border-white dark:border-gray-800 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${
                mp.isOnline
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-gray-400 dark:bg-gray-600'
              }`}
              title={mp.isOnline ? t('masterCard.online') : t('masterCard.offline')}
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-gray-900 dark:text-white truncate ${compact ? 'text-sm' : 'text-base'}`}>
              {profile?.firstName || t('profile.user')} {profile?.lastName || ''}
            </h3>
            {master.isVerified && (
              <CheckCircle size={14} className="text-green-500 shrink-0" />
            )}
          </div>

          {/* Rating + Orders */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {mp && (
              <>
                <span className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{mp.rating.toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase size={11} />
                  {mp.completedOrders} {t('masterCard.orders')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {mp.experienceYears} {t('common.years')}
                </span>
              </>
            )}
          </div>

          {/* City */}
          {profile?.city && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <MapPin size={10} />
              {t(`cities.${profile.city}`) || profile.city}
            </p>
          )}

          {/* Specializations */}
          {mp && mp.specializations.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {mp.specializations.slice(0, 4).map((spec) => (
                <span key={spec} className="text-[10px] bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                  {t(`categories.${spec}`) || spec}
                </span>
              ))}
              {mp.specializations.length > 4 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">+{mp.specializations.length - 4}</span>
              )}
            </div>
          )}

          {/* Availability + Online badge */}
          {mp && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                mp.isOnline
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : mp.isAvailable
                  ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {mp.isOnline
                  ? `🟢 ${t('masterCard.online')}`
                  : mp.isAvailable
                  ? t('masterCard.available')
                  : t('masterCard.busy')}
              </span>
              {!mp.isOnline && mp.lastSeenAt && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t('masterCard.lastSeen')} {formatLastSeen(mp.lastSeenAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Favorite button */}
        {showFavorite && (
          <button
            onClick={handleToggleFavorite}
            disabled={toggling}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          >
            <Heart
              size={18}
              className={fav ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600'}
            />
          </button>
        )}
      </div>
    </Link>
  );
}
