// ============================================
// MasterUz — NewOrderChoicePage
// Промежуточная страница выбора способа создания заказа:
//   • «За 30 секунд» — фото + AI Vision
//   • «Детализированный заказ» — пошаговый визард с категориями
// ============================================

import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, ListChecks, Sparkles, Clock, Shield, Star } from 'lucide-react';
import { useTranslation } from '../i18n';

export function NewOrderChoicePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-orange-500 mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> {t('common.back')}
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            {t('newOrder.title')}
          </h1>
          <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('newOrder.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ─── Карточка 1: Заказ за 30 секунд ───────────────── */}
          <Link
            to="/instant-order"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-7 shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] transition-all ring-2 ring-orange-400/50"
          >
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold">
              {t('newOrder.instant.badge')}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
              <Camera size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
              {t('newOrder.instant.title')}
            </h2>
            <p className="text-base text-white/90 mb-5">
              {t('newOrder.instant.desc')}
            </p>
            <ul className="space-y-2 mb-6 text-sm">
              <li className="flex items-center gap-2"><Sparkles size={16} /> {t('newOrder.instant.bullet1')}</li>
              <li className="flex items-center gap-2"><Clock size={16} /> {t('newOrder.instant.bullet2')}</li>
              <li className="flex items-center gap-2"><Star size={16} /> {t('newOrder.instant.bullet3')}</li>
            </ul>
            <div className="flex items-center gap-2 font-bold text-base">
              {t('newOrder.instant.cta')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* ─── Карточка 2: Детализированный заказ ────────────── */}
          <Link
            to="/orders/create"
            className="group relative overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 text-gray-900 dark:text-white p-7 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:border-blue-400 transition-all"
          >
            <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1 text-xs font-bold">
              {t('newOrder.detailed.badge')}
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-5 text-white">
              <ListChecks size={32} />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-2 text-blue-700 dark:text-blue-300">
              {t('newOrder.detailed.title')}
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-5">
              {t('newOrder.detailed.desc')}
            </p>
            <ul className="space-y-2 mb-6 text-sm text-gray-700 dark:text-gray-200">
              <li className="flex items-center gap-2"><ListChecks size={16} className="text-blue-500" /> {t('newOrder.detailed.bullet1')}</li>
              <li className="flex items-center gap-2"><Shield size={16} className="text-blue-500" /> {t('newOrder.detailed.bullet2')}</li>
              <li className="flex items-center gap-2"><Star size={16} className="text-blue-500" /> {t('newOrder.detailed.bullet3')}</li>
            </ul>
            <div className="flex items-center gap-2 font-bold text-base text-blue-700 dark:text-blue-300">
              {t('newOrder.detailed.cta')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          {t('newOrder.hint')}
        </p>
      </div>
    </div>
  );
}

export default NewOrderChoicePage;
