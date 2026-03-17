// ============================================
// MasterUz — Orders List Page (i18n + категории)
// ============================================

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ordersApi, catalogApi } from '../api/client';
import { OrderCard } from '../components/OrderCard';
import { OrdersListSkeleton } from '../components/PageSkeletons';
import { useFormatPrice, useGeolocation } from '../hooks';
import { useTranslation } from '../i18n';
import { PlusCircle, MapPin, X, Zap } from 'lucide-react';
import { useAuthStore } from '../store';
import { getDistrictsForCity, getLocalizedRegionName } from '../data/regions';
import type { Order, Category, Subcategory } from '../types';

const CITY_KEYS = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus', 'Karshi'] as const;

export function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const formatPrice = useFormatPrice();
  const { location, requestLocation } = useGeolocation();
  const { t, language } = useTranslation();

  const [filters, setFilters] = useState({
    status: 'PUBLISHED',
    categoryId: searchParams.get('category') || '',
    subcategoryId: '',
    city: '',
    district: '',
    isUrgent: searchParams.get('urgent') === 'true' ? 'true' : '',
    sortBy: 'created_at',
    page: 1,
  });

  // Districts for selected city
  const cityDistricts = filters.city ? getDistrictsForCity(filters.city) : [];

  // Load categories for filter chips
  useEffect(() => {
    catalogApi.getCategories().then((res) => {
      const cats = res.data.data || [];
      setCategories(cats);

      // Resolve slug from URL to real category ID
      const urlCat = searchParams.get('category');
      if (urlCat && cats.length > 0) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(urlCat);
        if (!isUuid) {
          const matched = cats.find((c: Category) => c.slug === urlCat);
          if (matched) {
            setFilters((prev) => ({ ...prev, categoryId: matched.id, page: 1 }));
          }
        }
      }
    }).catch(() => {});
  }, []);

  // Load subcategories when category is selected
  useEffect(() => {
    if (!filters.categoryId) {
      setSubcategories([]);
      return;
    }
    // Find slug for the selected category
    const selectedCat = categories.find((c) => c.id === filters.categoryId);
    if (!selectedCat) return;

    setSubcategoriesLoading(true);
    catalogApi.getCategoryWithSubs(selectedCat.slug).then((res) => {
      setSubcategories(res.data.data?.subcategories || []);
    }).catch(() => {
      setSubcategories([]);
    }).finally(() => {
      setSubcategoriesLoading(false);
    });
  }, [filters.categoryId, categories]);

  useEffect(() => {
    loadOrders();
  }, [filters, location]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params: any = { ...filters };
      if (location) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      // Remove empty params
      Object.keys(params).forEach((k) => {
        if (!params[k]) delete params[k];
      });

      const response = await ordersApi.list(params);
      if (response.data.success !== false) {
        setOrders(response.data.data || []);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function getCatName(cat: Category) {
    if (language === 'uz' && cat.nameUz) return cat.nameUz;
    if (language === 'en' && cat.nameEn) return cat.nameEn;
    return cat.name;
  }

  function getSubName(sub: Subcategory) {
    if (language === 'uz' && sub.nameUz) return sub.nameUz;
    if (language === 'en' && sub.nameEn) return sub.nameEn;
    return sub.name;
  }

  function selectCategory(catId: string) {
    const newId = filters.categoryId === catId ? '' : catId;
    setFilters({ ...filters, categoryId: newId, subcategoryId: '', page: 1 });
    if (newId) {
      const cat = categories.find((c) => c.id === newId);
      setSearchParams({ category: cat?.slug || newId });
    } else {
      setSearchParams({});
    }
  }

  function selectSubcategory(subId: string) {
    const newId = filters.subcategoryId === subId ? '' : subId;
    setFilters({ ...filters, subcategoryId: newId, page: 1 });
  }

  return (
    <div className="page-container pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('orders.title')}</h1>
        {isAuthenticated && (
          <Link to="/orders/create" className="btn-primary">
            <PlusCircle size={18} className="mr-2" />
            {t('orders.createOrder')}
          </Link>
        )}
      </div>

      {/* Category Chips */}
      {categories.length > 0 && (
        <div className="flex overflow-x-auto gap-2 mb-4 pb-2 -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => selectCategory('')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              !filters.categoryId
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t('orders.allCategories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filters.categoryId === cat.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <span>{cat.icon}</span>
              {getCatName(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Subcategories Section — appears when a category is selected */}
      {filters.categoryId && subcategories.length > 0 && (
        <div className="mb-4">
          <div className="flex overflow-x-auto gap-2 pb-2 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => selectSubcategory('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                !filters.subcategoryId
                  ? 'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
              }`}
            >
              {t('orders.allSubcategories')}
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                onClick={() => selectSubcategory(sub.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filters.subcategoryId === sub.id
                    ? 'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                }`}
              >
                {sub.icon && <span>{sub.icon}</span>}
                {getSubName(sub)}
              </button>
            ))}
          </div>
        </div>
      )}

      {subcategoriesLoading && (
        <div className="flex justify-center mb-4">
          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Urgent toggle */}
        <button
          onClick={() => setFilters({ ...filters, isUrgent: filters.isUrgent === 'true' ? '' : 'true', page: 1 })}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
            filters.isUrgent === 'true'
              ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-200 dark:shadow-orange-900/30'
              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:border-orange-500'
          }`}
        >
          <Zap size={14} />
          {t('orders.urgentOnly')}
        </button>

        <select
          className="input w-auto text-sm"
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
        >
          <option value="created_at">{t('orders.sortByDate')}</option>
          <option value="price">{t('orders.sortByPrice')}</option>
          <option value="distance">{t('orders.sortByDistance')}</option>
        </select>

        <select
          className="input w-auto text-sm"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value, district: '', page: 1 })}
        >
          <option value="">{t('cities.all')}</option>
          {CITY_KEYS.map((key) => (
            <option key={key} value={key}>{t(`cities.${key}`)}</option>
          ))}
        </select>

        {/* District cascading dropdown */}
        {cityDistricts.length > 0 && (
          <select
            className="input w-auto text-sm"
            value={filters.district}
            onChange={(e) => setFilters({ ...filters, district: e.target.value, page: 1 })}
          >
            <option value="">{t('orders.allDistricts')}</option>
            {cityDistricts.map((d) => (
              <option key={d.key} value={d.key}>{getLocalizedRegionName(d, language)}</option>
            ))}
          </select>
        )}

        <button
          onClick={requestLocation}
          className="btn-secondary text-sm"
          title={t('orders.updateLocation')}
        >
          <MapPin size={14} className="mr-1" />
          {location ? t('orders.updateLocation') : t('orders.myLocation')}
        </button>

        {/* Active filter count */}
        {(filters.categoryId || filters.city || filters.isUrgent || filters.district || filters.subcategoryId) && (
          <button
            onClick={() => {
              setFilters({ ...filters, categoryId: '', subcategoryId: '', city: '', district: '', isUrgent: '', page: 1 });
              setSearchParams({});
            }}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 px-2"
          >
            <X size={14} />
            {t('orders.resetFilters')}
          </button>
        )}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <OrdersListSkeleton count={6} />
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📋</span>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('orders.noOrders')}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('orders.noOrdersDesc')}</p>
          {isAuthenticated && (
            <Link to="/orders/create" className="btn-primary">
              {t('orders.createOrder')}
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            {t('orders.found')}: {orders.length}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
