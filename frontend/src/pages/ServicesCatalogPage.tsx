// ============================================
// MasterUz — Services Catalog Page (naimi.kz-style)
// Родительская категория → список дочерних категорий
// Premium UX для аудитории 50+: крупные карточки, чёткие иконки
// ============================================

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/client';
import { useTranslation } from '../i18n';
import { ArrowLeft, ChevronRight, Layers } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';

interface ChildCategory {
  id: string;
  slug: string;
  name: string;
  nameUz?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  _count?: { subcategories: number };
  subcategories?: { id: string; name: string; nameUz?: string | null; nameEn?: string | null; slug: string; icon?: string | null; _count?: { tasks: number } }[];
}

interface ParentCategory {
  id: string;
  slug: string;
  name: string;
  nameUz?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  children?: ChildCategory[];
}

export function ServicesCatalogPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [category, setCategory] = useState<ParentCategory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    catalogApi.getCategoryWithSubs(slug)
      .then((res) => {
        const data = res.data.data;
        if (!data) {
          navigate('/');
          return;
        }
        // Если это дочерняя категория (имеет subcategories, нет children) — переход на CatalogPage
        if ((!data.children || data.children.length === 0) && data.subcategories?.length > 0) {
          navigate(`/catalog/${slug}`, { replace: true });
          return;
        }
        setCategory(data);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  function getName(item: { name: string; nameUz?: string | null; nameEn?: string | null }) {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  }

  if (loading) {
    return (
      <div className="page-container pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) return null;

  const children = category.children || [];

  return (
    <div className="page-container pb-24">
      {/* Header — крупный, понятный */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate('/')}
          className="p-3 -ml-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Назад"
        >
          <ArrowLeft size={22} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold dark:text-white flex items-center gap-3">
            {category.icon && <CategoryIcon name={category.icon} size="lg" />}
            {getName(category)}
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
            {t('catalog.chooseSubcategory')} ({children.length})
          </p>
        </div>
      </div>

      {/* Дочерние категории — крупные карточки */}
      <div className="space-y-4">
        {children.map((child) => {
          const subcatCount = child._count?.subcategories || child.subcategories?.length || 0;
          const totalTasks = child.subcategories?.reduce(
            (sum, sub) => sum + (sub._count?.tasks || 0), 0
          ) || 0;

          return (
            <Link
              key={child.id}
              to={`/catalog/${child.slug}`}
              className="group flex items-center gap-4 p-5 md:p-6 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg transition-all"
            >
              {/* Иконка — крупная */}
              <div className="flex-shrink-0">
                <CategoryIcon name={child.icon || 'Folder'} size="xl" />
              </div>

              {/* Текст */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {getName(child)}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  {subcatCount > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Layers size={14} />
                      {subcatCount} {subcatCount === 1 ? 'раздел' : subcatCount < 5 ? 'раздела' : 'разделов'}
                    </span>
                  )}
                  {totalTasks > 0 && (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      {totalTasks} услуг
                    </span>
                  )}
                </div>
              </div>

              {/* Стрелка */}
              <ChevronRight size={24} className="flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
            </Link>
          );
        })}
      </div>

      {/* Если нет дочерних */}
      {children.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Layers size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">Категории скоро появятся</p>
        </div>
      )}
    </div>
  );
}
