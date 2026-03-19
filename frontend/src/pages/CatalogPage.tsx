// ============================================
// MasterUz — Catalog Page (Категория → Подкатегории)
// ============================================

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useCartStore } from '../store/cartStore';
import { ArrowLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import type { Category, Subcategory } from '../types';

export function CatalogPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const cartItems = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.getTotalItems());

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    catalogApi.getCategoryWithSubs(slug)
      .then((res) => {
        const data = res.data.data;
        setCategory(data);
        setSubcategories(data?.subcategories || []);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [slug]);

  function getName(item: { name: string; nameUz?: string | null; nameEn?: string | null }) {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  }

  if (loading) {
    return (
      <div className="page-container pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) return null;

  return (
    <div className="page-container pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
            {category.icon && <CategoryIcon name={category.icon} size="md" />}
            {getName(category)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('catalog.chooseSubcategory')}
          </p>
        </div>
      </div>

      {/* Subcategories List */}
      <div className="space-y-3">
        {subcategories.map((sub) => {
          const taskCount = sub.tasks?.length || 0;
          // Count items in cart from this subcategory
          const cartCount = cartItems.filter(
            (ci) => sub.tasks?.some((st) => st.id === ci.task.id)
          ).length;

          return (
            <Link
              key={sub.id}
              to={`/catalog/${slug}/${sub.slug}`}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {sub.icon && <div className="flex-shrink-0"><CategoryIcon name={sub.icon} size="sm" /></div>}
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                    {getName(sub)}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {taskCount} {t('catalog.services')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cartCount > 0 && (
                  <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 text-xs font-bold px-2 py-0.5 rounded-full">
                    {cartCount} {t('catalog.inCart')}
                  </span>
                )}
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <Link
          to="/cart"
          className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-primary-600 hover:bg-primary-700 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-primary-600/25 transition-all z-40"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 bg-white text-primary-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            </div>
            <span className="font-semibold">{t('catalog.viewCart')}</span>
          </div>
          <span className="font-bold">
            {new Intl.NumberFormat('ru-RU').format(useCartStore.getState().getSubtotal())} {t('common.currency')}
          </span>
        </Link>
      )}
    </div>
  );
}
