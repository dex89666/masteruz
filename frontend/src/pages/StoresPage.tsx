// ============================================
// MasterUz — Страница партнёрских магазинов
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storesApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function StoresPage() {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categoriesData } = useQuery({
    queryKey: ['store-categories'],
    queryFn: () => storesApi.getCategories().then(r => r.data.data),
  });

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['stores', selectedCategory, searchQuery],
    queryFn: () => storesApi.getAll({
      category: selectedCategory || undefined,
      search: searchQuery || undefined,
    }).then(r => r.data),
  });

  const stores = storesData?.data || [];
  const categories = categoriesData || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('stores.title')}
          </h1>
          <p className="text-lg opacity-90 mb-6">{t('stores.subtitle')}</p>

          {/* Поиск */}
          <div className="max-w-xl mx-auto">
            <input
              type="text"
              placeholder={t('stores.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-gray-900 bg-white shadow-lg focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Категории */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !selectedCategory
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
            }`}
          >
            {t('stores.allCategories')}
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat.slug
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Баннер партнёрства */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1">{t('stores.partnerBanner')}</h3>
              <p className="opacity-90 text-sm">{t('stores.partnerBannerDesc')}</p>
            </div>
            <Link
              to="/stores/partner-request"
              className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition whitespace-nowrap"
            >
              {t('stores.becomePartner')}
            </Link>
          </div>
        </div>

        {/* Список магазинов */}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : stores.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🏪</div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('stores.noStores')}</h3>
            <p className="text-gray-500 mt-1">{t('stores.noStoresDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store: any) => (
              <Link
                key={store.id}
                to={`/stores/${store.slug}`}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
              >
                {/* Cover */}
                <div className="h-40 bg-gradient-to-br from-orange-100 to-amber-50 dark:from-gray-700 dark:to-gray-600 relative">
                  {store.coverUrl ? (
                    <img src={store.coverUrl} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">🏪</div>
                  )}
                  {store.isVerified && (
                    <span className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      ✓ {t('common.verified')}
                    </span>
                  )}
                  {store.discountForMasters && (
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      -{store.discountForMasters}% {t('stores.forMasters')}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-orange-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-xl">🧱</div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-orange-500 transition">
                        {store.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{store.address || store.city}</p>
                    </div>
                  </div>

                  {store.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{store.description}</p>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-amber-500">
                      ⭐ {store.rating.toFixed(1)}
                      <span className="text-gray-400">({store._count?.reviews || 0})</span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      📦 {store._count?.products || 0} {t('stores.products')}
                    </div>
                  </div>

                  {store.deliveryAvailable && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      🚚 {t('stores.deliveryAvailable')}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
