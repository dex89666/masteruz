// ============================================
// MasterUz — Favorites Page (Избранные мастера)
// ============================================

import { useEffect, useState } from 'react';
import { favoritesApi } from '../api/client';
import { useTranslation } from '../i18n';
import { MasterCard } from '../components/MasterCard';
import { MastersGridSkeleton } from '../components/PageSkeletons';
import { Heart } from 'lucide-react';
import type { FavoriteMaster } from '../types';

export function FavoritesPage() {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useState<FavoriteMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    try {
      const res = await favoritesApi.getAll();
      setFavorites(res.data.data || []);
    } catch {}
    setLoading(false);
  }

  function handleToggleFavorite(masterId: string, newState: boolean) {
    if (!newState) {
      setFavorites((prev) => prev.filter((f) => f.masterId !== masterId));
    }
  }

  if (loading) return <MastersGridSkeleton />;

  return (
    <div className="page-container pb-20">
      <h1 className="page-title flex items-center gap-2">
        <Heart size={24} className="text-red-500" />
        {t('favorites.title')}
      </h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto mb-4 text-gray-200 dark:text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">{t('favorites.empty')}</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">{t('favorites.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <MasterCard
              key={fav.id}
              master={fav.master as any}
              isFavorite={true}
              showFavorite={true}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
