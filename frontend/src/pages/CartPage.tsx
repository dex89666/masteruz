// ============================================
// MasterUz — Cart Page (Корзина с итогами)
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store';
import { useFormatPrice } from '../hooks';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, ChevronRight, MapPin, FileText, AlertCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CartItem } from '../store/cartStore';

const COMMISSION_RATE = 15; // 15% platform commission
const VISIT_FEE = 100000;  // 100,000 UZS

export function CartPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const formatPrice = useFormatPrice();
  const { isAuthenticated } = useAuthStore();
  
  const items = useCartStore((s) => s.items);
  const incrementQuantity = useCartStore((s) => s.incrementQuantity);
  const decrementQuantity = useCartStore((s) => s.decrementQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  const [isUrgent, setIsUrgent] = useState(false);
  const [comment, setComment] = useState('');

  function getName(item: { name: string; nameUz?: string | null; nameEn?: string | null }) {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  }

  function getCatName(item: CartItem) {
    if (language === 'uz' && item.categoryNameUz) return item.categoryNameUz;
    if (language === 'en' && item.categoryNameEn) return item.categoryNameEn;
    return item.categoryName;
  }

  function getSubName(item: CartItem) {
    if (language === 'uz' && item.subcategoryNameUz) return item.subcategoryNameUz;
    if (language === 'en' && item.subcategoryNameEn) return item.subcategoryNameEn;
    return item.subcategoryName;
  }

  // Group items by category
  const groupedItems = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    const key = item.categoryName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const subtotal = getSubtotal();
  const urgentExtra = isUrgent ? Math.round(subtotal * 0.4) : 0;
  const totalBeforeCommission = subtotal + urgentExtra + VISIT_FEE;
  const commission = Math.round(totalBeforeCommission * (COMMISSION_RATE / 100));
  const total = totalBeforeCommission + commission;
  const totalItemCount = getTotalItems();

  function handleCheckout() {
    if (!isAuthenticated) {
      toast.error(t('cart.loginRequired'));
      navigate('/login');
      return;
    }
    // Navigate to order creation with cart data
    navigate('/orders/create', {
      state: {
        cartItems: items,
        isUrgent,
        comment,
        subtotal,
        urgentExtra,
        visitFee: VISIT_FEE,
        commission,
        total,
      },
    });
  }

  if (items.length === 0) {
    return (
      <div className="page-container pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-bold dark:text-white">{t('cart.title')}</h1>
        </div>

        <div className="text-center py-16">
          <ShoppingCart size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('cart.empty')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('cart.emptyDesc')}
          </p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            {t('cart.browseCatalog')}
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold dark:text-white">{t('cart.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalItemCount} {t('cart.services')}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm(t('cart.clearConfirm'))) clearCart();
          }}
          className="text-red-500 hover:text-red-600 text-sm font-medium flex items-center gap-1"
        >
          <Trash2 size={14} />
          {t('cart.clear')}
        </button>
      </div>

      {/* Grouped Items */}
      <div className="space-y-6 mb-6">
        {Object.entries(groupedItems).map(([catName, catItems]) => (
          <div key={catName}>
            <div className="flex items-center gap-2 mb-3">
              {catItems[0]?.categoryIcon && (
                <span className="text-lg">{catItems[0].categoryIcon}</span>
              )}
              <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                {getCatName(catItems[0])}
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {getSubName(catItems[0])}
              </span>
            </div>

            <div className="space-y-2">
              {catItems.map((item) => (
                <div
                  key={item.task.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {getName(item.task)}
                      </h4>
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                        {formatPrice(Number(item.task.minPrice) || 0)} / {t('cart.perUnit')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Quantity */}
                      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700 rounded-lg p-0.5">
                        <button
                          onClick={() => decrementQuantity(item.task.id)}
                          className="w-7 h-7 rounded-md bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95"
                        >
                          <Minus size={12} className="text-gray-500 dark:text-gray-300" />
                        </button>
                        <span className="w-7 text-center font-bold text-sm text-gray-700 dark:text-gray-200">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => incrementQuantity(item.task.id)}
                          className="w-7 h-7 rounded-md bg-white dark:bg-gray-600 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95"
                        >
                          <Plus size={12} className="text-primary-600 dark:text-primary-400" />
                        </button>
                      </div>

                      {/* Line total */}
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 min-w-[80px] text-right">
                        {formatPrice((Number(item.task.minPrice) || 0) * item.quantity)}
                      </span>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item.task.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add More Services */}
      <Link
        to="/"
        className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-700 dark:hover:text-primary-400 transition-all mb-6"
      >
        <Plus size={16} />
        {t('cart.addMore')}
      </Link>

      {/* Urgent Toggle */}
      <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-4 mb-4 border border-orange-100 dark:border-orange-900/30">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-orange-500" />
            <div>
              <span className="font-medium text-gray-900 dark:text-white text-sm">{t('cart.urgentOrder')}</span>
              <p className="text-xs text-orange-600/70 dark:text-orange-400/60 mt-0.5">{t('cart.urgentDesc')}</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${isUrgent ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${isUrgent ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
          </div>
        </label>
      </div>

      {/* Comment */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <FileText size={14} />
          {t('cart.comment')}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('cart.commentPlaceholder')}
          className="input text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Price Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{t('cart.priceBreakdown')}</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{t('cart.servicesTotal')} ({totalItemCount})</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {t('cart.visitFee')}
            </span>
            <span>{formatPrice(VISIT_FEE)}</span>
          </div>

          {isUrgent && (
            <div className="flex justify-between text-orange-600 dark:text-orange-400">
              <span className="flex items-center gap-1">
                <Zap size={12} />
                {t('cart.urgentSurcharge')} (+40%)
              </span>
              <span>+{formatPrice(urgentExtra)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
            <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white">
              <span>{t('cart.total')}</span>
              <span className="text-primary-600 dark:text-primary-400">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center mb-4 px-4">
        <AlertCircle size={12} className="inline mr-1" />
        {t('cart.priceNote')}
      </div>

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-2xl p-4 font-bold text-lg shadow-lg shadow-primary-600/25 transition-all active:scale-[0.98]"
      >
        {t('cart.checkout')} · {formatPrice(total)}
      </button>
    </div>
  );
}
