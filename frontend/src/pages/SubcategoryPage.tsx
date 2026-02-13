// ============================================
// MasterUz — Subcategory Page (Задачи с количеством)
// ============================================

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { catalogApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useCartStore } from '../store/cartStore';
import { ArrowLeft, ShoppingCart, Plus, Minus, Clock, Check } from 'lucide-react';
import type { Subcategory, Task } from '../types';

export function SubcategoryPage() {
  const { categorySlug, subcategorySlug } = useParams<{ categorySlug: string; subcategorySlug: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [categoryMeta, setCategoryMeta] = useState<{ name: string; nameUz: string | null; nameEn: string | null; icon: string | null } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const incrementQuantity = useCartStore((s) => s.incrementQuantity);
  const decrementQuantity = useCartStore((s) => s.decrementQuantity);
  const totalItems = useCartStore((s) => s.getTotalItems());
  const getSubtotal = useCartStore((s) => s.getSubtotal);

  useEffect(() => {
    if (!subcategorySlug || !categorySlug) return;
    setLoading(true);

    // Load category for meta info
    catalogApi.getCategoryWithSubs(categorySlug).then((res) => {
      const cat = res.data.data;
      setCategoryMeta({ name: cat.name, nameUz: cat.nameUz, nameEn: cat.nameEn, icon: cat.icon });
      const sub = (cat.subcategories || []).find((s: Subcategory) => s.slug === subcategorySlug);
      if (sub) {
        setSubcategory(sub);
        setTasks(sub.tasks || []);
      }
    }).catch(() => navigate(-1)).finally(() => setLoading(false));
  }, [categorySlug, subcategorySlug]);

  function getName(item: { name: string; nameUz?: string | null; nameEn?: string | null }) {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  }

  function getDesc(item: { description?: string | null; descriptionUz?: string | null; descriptionEn?: string | null }) {
    if (language === 'uz' && item.descriptionUz) return item.descriptionUz;
    if (language === 'en' && item.descriptionEn) return item.descriptionEn;
    return item.description || '';
  }

  function getTime(item: { estimatedTime?: string | null; estimatedTimeUz?: string | null; estimatedTimeEn?: string | null }) {
    if (language === 'uz' && item.estimatedTimeUz) return item.estimatedTimeUz;
    if (language === 'en' && item.estimatedTimeEn) return item.estimatedTimeEn;
    return item.estimatedTime || '';
  }

  function getCartQuantity(taskId: string): number {
    return cartItems.find((i) => i.task.id === taskId)?.quantity || 0;
  }

  function handleAdd(task: Task) {
    if (!subcategory || !categoryMeta) return;
    addItem({
      task,
      categoryName: categoryMeta.name,
      categoryNameUz: categoryMeta.nameUz,
      categoryNameEn: categoryMeta.nameEn,
      categoryIcon: categoryMeta.icon,
      subcategoryName: subcategory.name,
      subcategoryNameUz: subcategory.nameUz,
      subcategoryNameEn: subcategory.nameEn,
    });
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('ru-RU').format(price);
  }

  if (loading) {
    return (
      <div className="page-container pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!subcategory) return null;

  return (
    <div className="page-container pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
            {subcategory.icon && <span className="text-2xl">{subcategory.icon}</span>}
            {getName(subcategory)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('catalog.selectServices')}
          </p>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const qty = getCartQuantity(task.id);
          const isExpanded = expandedTask === task.id;

          return (
            <div
              key={task.id}
              className={`bg-white dark:bg-gray-800 rounded-xl border transition-all overflow-hidden ${
                qty > 0
                  ? 'border-primary-300 dark:border-primary-700 ring-1 ring-primary-100 dark:ring-primary-900/30'
                  : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              {/* Main row */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-snug">
                      {getName(task)}
                    </h3>
                    {task.estimatedTime && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <Clock size={12} />
                        <span>{getTime(task)}</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="text-primary-600 dark:text-primary-400 font-bold text-sm">
                        {t('catalog.from')} {formatPrice(task.minPrice || 0)} {t('common.currency')}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex-shrink-0">
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(task)}
                        className="bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-600 dark:text-primary-400 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95"
                      >
                        <Plus size={16} className="inline mr-1" />
                        {t('catalog.add')}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-primary-50 dark:bg-primary-900/30 rounded-xl p-1">
                        <button
                          onClick={() => decrementQuantity(task.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors active:scale-95"
                        >
                          <Minus size={14} className="text-gray-600 dark:text-gray-300" />
                        </button>
                        <span className="w-8 text-center font-bold text-primary-700 dark:text-primary-300 text-sm">
                          {qty}
                        </span>
                        <button
                          onClick={() => incrementQuantity(task.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors active:scale-95"
                        >
                          <Plus size={14} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded description */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-50 dark:border-gray-700/50 pt-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {getDesc(task)}
                  </p>
                </div>
              )}

              {/* Quantity added indicator */}
              {qty > 0 && (
                <div className="bg-primary-50 dark:bg-primary-900/20 px-4 py-2 flex items-center justify-between text-xs">
                  <span className="text-primary-600 dark:text-primary-400 flex items-center gap-1">
                    <Check size={12} />
                    {qty} x {formatPrice(task.minPrice || 0)} {t('common.currency')}
                  </span>
                  <span className="font-bold text-primary-700 dark:text-primary-300">
                    = {formatPrice((task.minPrice || 0) * qty)} {t('common.currency')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <Link
          to="/cart"
          className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-primary-600 hover:bg-primary-700 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-primary-600/25 transition-all z-40 active:scale-[0.98]"
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
            {formatPrice(getSubtotal())} {t('common.currency')}
          </span>
        </Link>
      )}
    </div>
  );
}
