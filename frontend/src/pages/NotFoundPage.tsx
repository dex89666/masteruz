// ============================================
// MasterUz — 404 Not Found Page
// ============================================

import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { useTranslation } from '../i18n';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <div className="text-[120px] md:text-[160px] font-extrabold text-gray-100 dark:text-gray-800 select-none leading-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl animate-bounce">🔧</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {t('common.pageNotFound')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('common.pageNotFoundDesc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary">
            <Home size={18} className="mr-2" />
            {t('nav.home')}
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
          >
            <ArrowLeft size={18} className="mr-2" />
            {t('common.back')}
          </button>
          <Link to="/orders" className="btn-secondary dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
            <Search size={18} className="mr-2" />
            {t('nav.orders')}
          </Link>
        </div>
      </div>
    </div>
  );
}
