// ============================================
// MasterUz — Master Search Page
// Поиск и фильтрация мастеров
// ============================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usersApi, favoritesApi } from '../api/client';
import { MasterCard } from '../components/MasterCard';
import { MastersGridSkeleton } from '../components/PageSkeletons';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import {
  Search, Filter, SlidersHorizontal, ChevronLeft, ChevronRight, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { User } from '../types';

const CITY_KEYS = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus', 'Karshi'] as const;

const SPECIALIZATIONS = [
  'plumbing', 'electrical', 'furniture', 'construction',
  'painting', 'windows-doors', 'appliance-install', 'carpentry',
  'cleaning', 'garden-outdoor',
] as const;

export function MasterSearchPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isClient = user?.role === 'CLIENT';

  const [masters, setMasters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [specialization, setSpecialization] = useState(searchParams.get('spec') || '');
  const [minRating, setMinRating] = useState(searchParams.get('rating') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'rating');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadMasters();
    if (isClient) loadFavorites();
  }, [page, sortBy]);

  async function loadMasters() {
    setLoading(true);
    try {
      const res = await usersApi.searchMasters({
        page,
        limit: 20,
        search: search || undefined,
        city: city || undefined,
        specialization: specialization || undefined,
        minRating: minRating ? Number(minRating) : undefined,
        sortBy,
        sortOrder: 'desc',
      });
      setMasters(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFavorites() {
    try {
      const res = await favoritesApi.getAll();
      const ids = new Set((res.data.data || []).map((f: any) => f.masterId));
      setFavoriteIds(ids);
    } catch { /* ignore */ }
  }

  function handleSearch() {
    setPage(1);
    const params: any = {};
    if (search) params.search = search;
    if (city) params.city = city;
    if (specialization) params.spec = specialization;
    if (minRating) params.rating = minRating;
    if (sortBy) params.sort = sortBy;
    setSearchParams(params);
    loadMasters();
  }

  async function handleToggleFavorite(masterId: string) {
    if (!isClient) return;
    try {
      if (favoriteIds.has(masterId)) {
        await favoritesApi.remove(masterId);
        setFavoriteIds((prev) => { const s = new Set(prev); s.delete(masterId); return s; });
        toast.success(t('favorites.removed'));
      } else {
        await favoritesApi.add(masterId);
        setFavoriteIds((prev) => new Set(prev).add(masterId));
        toast.success(t('favorites.added'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="page-container pb-20">
      <h1 className="page-title">{t('masters.title')}</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder={t('masters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button onClick={handleSearch} className="btn-primary">
          <Search size={18} />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary ${showFilters ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : ''}`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card mb-4 animate-slideDown">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('masters.city')}</label>
              <select className="input text-sm" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">{t('cities.all')}</option>
                {CITY_KEYS.map((c) => (
                  <option key={c} value={c}>{t(`cities.${c}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('masters.specialization')}</label>
              <select className="input text-sm" value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                <option value="">{t('masters.allSpecializations')}</option>
                {SPECIALIZATIONS.map((s) => (
                  <option key={s} value={s}>{t(`categories.${s}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('masters.minRating')}</label>
              <select className="input text-sm" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="">{t('masters.anyRating')}</option>
                <option value="4.5">4.5+</option>
                <option value="4">4.0+</option>
                <option value="3.5">3.5+</option>
                <option value="3">3.0+</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t('masters.sortBy')}</label>
              <select className="input text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="rating">{t('masters.byRating')}</option>
                <option value="completedOrders">{t('masters.byOrders')}</option>
                <option value="experience">{t('masters.byExperience')}</option>
              </select>
            </div>
          </div>
          <button onClick={handleSearch} className="btn-primary text-sm mt-3 w-full">
            <Filter size={16} className="mr-1" />
            {t('masters.applyFilters')}
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('masters.found')}: <strong>{total}</strong> {t('masters.mastersCount')}
      </p>

      {/* Results */}
      {loading ? (
        <MastersGridSkeleton count={6} />
      ) : masters.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('masters.noResults')}</p>
          <p className="text-sm mt-1">{t('masters.noResultsDesc')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {masters.map((master) => (
              <MasterCard
                key={master.id}
                master={master}
                showFavorite={isClient}
                isFavorite={favoriteIds.has(master.id)}
                onToggleFavorite={() => handleToggleFavorite(master.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
