// ============================================
// MasterUz — Master Dashboard Page (i18n)
// Панель мастера: статистика, мои заказы, быстрые действия
// ============================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi, paymentsApi, portfolioApi, authApi } from '../api/client';
import { OrderCard } from '../components/OrderCard';
import { DashboardSkeleton } from '../components/PageSkeletons';
import { useAuthStore } from '../store';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';
import {
  Briefcase,
  Clock,
  CheckCircle,
  DollarSign,
  Star,
  ArrowRight,
  GraduationCap,
  Search,
  TrendingUp,
  CreditCard,
  Bell,
  Settings,
  Zap,
  Wifi,
  WifiOff,
  Image,
  ShieldCheck,
} from 'lucide-react';
import type { Order } from '../types';

export function MasterDashboardPage() {
  const { user, setUser, setAuth } = useAuthStore();
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [urgentOrders, setUrgentOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, thisMonth: 0, lastMonth: 0 });
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [switchingRole, setSwitchingRole] = useState(false);

  const mp = user?.masterProfile;
  const profile = user?.profile;

  // Админ-статус определяется из бэкенда (поле isAdminUser)
  const isAdminUser = user?.isAdminUser === true;

  async function handleSwitchToAdmin() {
    setSwitchingRole(true);
    try {
      const res = await authApi.switchRole('ADMIN');
      const resData = res.data as any;
      if (resData.success) {
        if (resData.accessToken && resData.refreshToken) {
          setAuth(resData.data, resData.accessToken, resData.refreshToken);
        } else {
          setUser(resData.data);
        }
        toast.success('Роль изменена на Админ');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка смены роли');
    } finally {
      setSwitchingRole(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [activeRes, newRes] = await Promise.all([
        ordersApi.myMasterOrders('IN_PROGRESS'),
        ordersApi.list({ status: 'PUBLISHED', limit: 6 }),
      ]);
      setActiveOrders(activeRes.data.data || []);
      const allNew = (newRes.data.data || []).slice(0, 10);
      setUrgentOrders(allNew.filter((o: Order) => o.isUrgent));
      setNewOrders(allNew.filter((o: Order) => !o.isUrgent).slice(0, 6));

      // Try to load earnings
      try {
        const paymentsRes = await paymentsApi.history(1, 100);
        const payments = paymentsRes.data.data || [];
        const now = new Date();
        let total = 0;
        let thisMonth = 0;
        let lastMonth = 0;
        payments.forEach((p: any) => {
          if (p.status === 'COMPLETED' && p.type === 'EARNING') {
            total += p.amount || 0;
            const pDate = new Date(p.createdAt);
            if (pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear()) {
              thisMonth += p.amount || 0;
            }
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            if (pDate.getMonth() === lastMonthDate.getMonth() && pDate.getFullYear() === lastMonthDate.getFullYear()) {
              lastMonth += p.amount || 0;
            }
          }
        });
        setEarnings({ total, thisMonth, lastMonth });
      } catch { /* earnings optional */ }

      // Try to load portfolio stats
      try {
        const portfolioRes = await portfolioApi.getStats();
        setPortfolioCount(portfolioRes.data.data?.totalItems || 0);
      } catch { /* portfolio optional */ }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <DashboardSkeleton />;

  // Если регистрационный взнос не оплачен — показать блокирующий баннер
  if (mp && !mp.registrationPaid) {
    return (
      <div className="page-container pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('masterDashboard.hello')}, {profile?.firstName || t('masterDashboard.master')}! 👋
          </h1>
        </div>

        <div className="card dark:bg-gray-800 dark:ring-gray-700 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t('becomeMasterPage.regFeePending')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('becomeMasterPage.regFeePendingDesc')}
          </p>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 text-left">
            <ul className="space-y-2 text-xs text-amber-700 dark:text-amber-400">
              <li className="flex items-center gap-2">✅ {t('becomeMasterPage.regFeeReason1')}</li>
              <li className="flex items-center gap-2">🛡️ {t('becomeMasterPage.regFeeReason2')}</li>
              <li className="flex items-center gap-2">⭐ {t('becomeMasterPage.regFeeReason3')}</li>
              <li className="flex items-center gap-2">💰 {t('becomeMasterPage.regFeeReason4')}</li>
            </ul>
          </div>

          <Link
            to="/become-master"
            className="btn-primary w-full py-3.5 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            <CreditCard size={20} className="mr-2" />
            {t('becomeMasterPage.regFeePayBtn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      {/* Баннер возврата в Админ-панель */}
      {isAdminUser && (
        <button
          onClick={handleSwitchToAdmin}
          disabled={switchingRole}
          className="w-full mb-4 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <ShieldCheck size={22} />
          <div className="flex-1 text-left">
            <p className="font-semibold text-sm">⚡ Вернуться в Админ-панель</p>
            <p className="text-[11px] text-purple-200">Переключиться обратно на роль Админа</p>
          </div>
          <ArrowRight size={18} className="text-purple-200" />
        </button>
      )}

      {/* Приветствие */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('masterDashboard.hello')}, {profile?.firstName || t('masterDashboard.master')}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('masterDashboard.subtitle')}</p>
      </div>

      {/* Онлайн-статус виджет */}
      <div className={`card mb-4 flex items-center gap-3 ${
        mp?.isOnline
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/10 dark:border-green-800'
          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 dark:from-gray-800/50 dark:to-gray-700/30 dark:border-gray-600'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          mp?.isOnline
            ? 'bg-green-100 dark:bg-green-900/40'
            : 'bg-gray-200 dark:bg-gray-700'
        }`}>
          {mp?.isOnline ? (
            <Wifi size={20} className="text-green-600 dark:text-green-400" />
          ) : (
            <WifiOff size={20} className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${
            mp?.isOnline ? 'text-green-800 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'
          }`}>
            {mp?.isOnline ? t('masterCard.online') : t('masterCard.offline')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {mp?.isOnline
              ? t('masterDashboard.onlineDesc')
              : t('masterDashboard.offlineDesc')
            }
          </p>
        </div>
        <span className={`w-3 h-3 rounded-full ${
          mp?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`} />
      </div>

      {/* Срочные заказы */}
      {urgentOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Zap size={20} className="text-orange-500" />
              {t('masterDashboard.urgentOrders')}
              <span className="text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 px-2 py-0.5 rounded-full animate-pulse">
                {urgentOrders.length}
              </span>
            </h2>
            <Link to="/orders" className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 flex items-center gap-1">
              {t('masterDashboard.viewAll')}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-3">
            {urgentOrders.slice(0, 3).map((order) => (
              <OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} showNetEarnings />
            ))}
          </div>
        </div>
      )}

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <Star size={18} className="text-yellow-500" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('masterDashboard.rating')}</span>
          </div>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {mp?.rating?.toFixed(1) || '—'}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200 dark:from-green-900/30 dark:to-green-800/20 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={18} className="text-green-500" />
            <span className="text-xs font-medium text-green-600 dark:text-green-400">{t('masterDashboard.completed')}</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            {mp?.completedOrders || 0}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-900/30 dark:to-purple-800/20 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase size={18} className="text-purple-500" />
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{t('masterDashboard.active')}</span>
          </div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
            {activeOrders.length}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 dark:from-orange-900/30 dark:to-orange-800/20 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-orange-500" />
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">{t('masterDashboard.hourlyRate')}</span>
          </div>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">
            {mp?.hourlyRate ? formatPrice(mp.hourlyRate) : '—'}
          </p>
        </div>
      </div>

      {/* Доходы */}
      {(earnings.total > 0 || earnings.thisMonth > 0) && (
        <Link to="/payments" className="card mb-6 block hover:shadow-md dark:hover:shadow-black/20 transition-shadow bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-900/30 dark:to-teal-900/20 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">{t('masterDashboard.earningsThisMonth')}</p>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{formatPrice(earnings.thisMonth)}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-emerald-500 dark:text-emerald-400">
                  {t('masterDashboard.totalEarnings')}: {formatPrice(earnings.total)}
                </p>
                {earnings.lastMonth > 0 && (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                    earnings.thisMonth >= earnings.lastMonth
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  }`}>
                    {earnings.thisMonth >= earnings.lastMonth ? '↑' : '↓'}
                    {earnings.lastMonth > 0
                      ? ` ${Math.abs(Math.round(((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth) * 100))}%`
                      : ''
                    }
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
              <DollarSign size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </Link>
      )}

      {/* Портфолио виджет */}
      {portfolioCount === 0 && (
        <Link
          to="/portfolio"
          className="card mb-6 block hover:shadow-md dark:hover:shadow-black/20 transition-shadow bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 dark:from-pink-900/20 dark:to-rose-900/10 dark:border-pink-800"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/40 rounded-full flex items-center justify-center">
              <Image size={20} className="text-pink-600 dark:text-pink-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-pink-800 dark:text-pink-300">{t('portfolio.empty')}</p>
              <p className="text-xs text-pink-600 dark:text-pink-400 mt-0.5">{t('portfolio.emptyDesc')}</p>
            </div>
            <span className="text-pink-400 dark:text-pink-500">→</span>
          </div>
        </Link>
      )}

      {/* Быстрые действия */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link
          to="/orders"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <Search size={24} className="text-primary-600 dark:text-primary-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('masterDashboard.findOrders')}</span>
        </Link>
        <Link
          to="/my-orders"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <Briefcase size={24} className="text-primary-600 dark:text-primary-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('masterDashboard.myOrders')}</span>
        </Link>
        <Link
          to="/portfolio"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <Image size={24} className="text-pink-600 dark:text-pink-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('portfolio.title')}</span>
        </Link>
        <Link
          to="/school"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <GraduationCap size={24} className="text-primary-600 dark:text-primary-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('masterDashboard.school')}</span>
        </Link>
        <Link
          to="/payments"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <CreditCard size={24} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('payments.title')}</span>
        </Link>
        <Link
          to="/notifications"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <Bell size={24} className="text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('notifications.title')}</span>
        </Link>
        <Link
          to="/settings"
          className="card flex flex-col items-center gap-2 p-3 hover:shadow-md dark:hover:shadow-black/20 transition-shadow text-center"
        >
          <Settings size={24} className="text-gray-600 dark:text-gray-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('settings.title')}</span>
        </Link>
      </div>

      {/* Верификация */}
      {!user?.isVerified && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-2">
            ⚠️ {t('masterDashboard.notVerified')}
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">
            {t('masterDashboard.notVerifiedDesc')}
          </p>
          <Link to="/school" className="text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200 flex items-center gap-1">
            {t('masterDashboard.goToSchool')}
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Мои активные заказы */}
      {activeOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              <Clock size={18} className="inline mr-2 text-primary-500 dark:text-primary-400" />
              {t('masterDashboard.activeOrders')}
            </h2>
            <Link to="/my-orders" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
              {t('common.more')}
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {activeOrders.slice(0, 3).map((order) => (
              <OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} showNetEarnings />
            ))}
          </div>
        </div>
      )}

      {/* Новые заказы для откликов */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            🔥 {t('masterDashboard.newOrders')}
          </h2>
          <Link to="/orders" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
            {t('masterDashboard.viewAll')}
            <ArrowRight size={14} />
          </Link>
        </div>
        {newOrders.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {newOrders.map((order) => (
              <OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} showNetEarnings />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <Search size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('masterDashboard.noNewOrders')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
