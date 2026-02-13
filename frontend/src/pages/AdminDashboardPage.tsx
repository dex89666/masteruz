// ============================================
// MasterUz — Admin Dashboard Page (Full)
// 5 табов: Обзор, Пользователи, Заказы, Платежи, Настройки
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, storesApi, turnkeyApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import {
  BarChart3, Users, ShoppingBag, DollarSign,
  Shield, Search, ChevronLeft, ChevronRight, Ban, CheckCircle,
  Settings, Save, CreditCard, UserCheck, UserX, Clock,
  AlertTriangle, Zap, Package, Star, Activity,
  ArrowUpRight, ArrowDownRight,
  XCircle, RefreshCw, Database, Store, Hammer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Dashboard } from '../types';

type AdminTab = 'overview' | 'users' | 'orders' | 'payments' | 'config' | 'stores' | 'turnkey';

// ─── Stat Card Component ────────────────────
function StatCard({ icon: Icon, label, value, subValue, color, trend }: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: { value: number; up: boolean };
}) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={22} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend.up
              ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        {subValue && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// ─── Status Distribution Bar ────────────────
function StatusBar({ items }: { items: { label: string; count: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {items.map((item, i) => (
          <div
            key={i}
            className={`${item.color} transition-all`}
            style={{ width: `${(item.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            <span className="font-semibold dark:text-white">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  // Users tab state
  const [users, setUsers] = useState<any[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRole, setUsersRole] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Orders tab state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Payments tab state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsStatus, setPaymentsStatus] = useState('');
  const [paymentsProvider, setPaymentsProvider] = useState('');
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Config tab state
  const [config, setConfig] = useState<any[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Stores tab state
  const [partnerRequests, setPartnerRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsStatus, setRequestsStatus] = useState('');

  // Turnkey tab state
  const [turnkeyProjects, setTurnkeyProjects] = useState<any[]>([]);
  const [turnkeyLoading, setTurnkeyLoading] = useState(false);
  const [turnkeyStatus, setTurnkeyStatus] = useState('');

  // Guard: only ADMIN / MANAGER
  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      navigate('/');
      return;
    }
    loadDashboard();
  }, [user]);

  // Tab change handlers
  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'orders') loadOrders();
    if (tab === 'payments') loadPayments();
    if (tab === 'config') loadConfig();
    if (tab === 'stores') loadPartnerRequests();
    if (tab === 'turnkey') loadTurnkeyProjects();
  }, [tab]);

  useEffect(() => { if (tab === 'stores') loadPartnerRequests(); }, [requestsStatus]);
  useEffect(() => { if (tab === 'turnkey') loadTurnkeyProjects(); }, [turnkeyStatus]);

  useEffect(() => { if (tab === 'users') loadUsers(); }, [usersPage, usersRole]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [ordersPage, ordersStatus]);
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [paymentsPage, paymentsStatus, paymentsProvider]);

  // Debounced user search
  useEffect(() => {
    if (tab !== 'users') return;
    const timer = setTimeout(() => {
      setUsersPage(1);
      loadUsers();
    }, 400);
    return () => clearTimeout(timer);
  }, [usersSearch]);

  async function loadDashboard() {
    try {
      const res = await adminApi.getDashboard();
      setDashboard(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await adminApi.getUsers({
        page: usersPage,
        limit: 15,
        role: usersRole || undefined,
        search: usersSearch || undefined,
      });
      setUsers(res.data.data || []);
      if (res.data.pagination) setUsersTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const res = await adminApi.getOrders({
        page: ordersPage,
        limit: 15,
        status: ordersStatus || undefined,
      });
      setOrders(res.data.data || []);
      if (res.data.pagination) setOrdersTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadPayments() {
    setPaymentsLoading(true);
    try {
      const res = await adminApi.getPayments({
        page: paymentsPage,
        limit: 15,
        status: paymentsStatus || undefined,
        provider: paymentsProvider || undefined,
      });
      setPayments(res.data.data || []);
      if (res.data.pagination) setPaymentsTotalPages(res.data.pagination.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function loadConfig() {
    setConfigLoading(true);
    try {
      const res = await adminApi.getConfig();
      setConfig(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleVerify(userId: string) {
    try {
      await adminApi.verifyUser(userId);
      toast.success(t('admin.userVerified'));
      loadUsers();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleBlock(userId: string) {
    try {
      await adminApi.blockUser(userId);
      toast.success(t('admin.userStatusUpdated'));
      loadUsers();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleSaveConfig(key: string) {
    try {
      await adminApi.updateConfig(key, editValue);
      toast.success(t('admin.configUpdated'));
      setEditingConfig(null);
      loadConfig();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  // ─── Stores: load partner requests ──────
  async function loadPartnerRequests() {
    setRequestsLoading(true);
    try {
      const params: any = { page: 1, limit: 50 };
      if (requestsStatus) params.status = requestsStatus;
      const res = await storesApi.getPartnerRequests(params);
      setPartnerRequests(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function handleApproveRequest(id: string) {
    try {
      await storesApi.approveRequest(id);
      toast.success('Заявка одобрена, магазин создан');
      loadPartnerRequests();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  async function handleRejectRequest(id: string) {
    try {
      await storesApi.rejectRequest(id, 'Не соответствует требованиям');
      toast.success('Заявка отклонена');
      loadPartnerRequests();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  // ─── Turnkey: load projects ──────
  async function loadTurnkeyProjects() {
    setTurnkeyLoading(true);
    try {
      const params: any = { page: 1, limit: 50 };
      if (turnkeyStatus) params.status = turnkeyStatus;
      const res = await turnkeyApi.getAllProjects(params);
      setTurnkeyProjects(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setTurnkeyLoading(false);
    }
  }

  async function handleUpdateProjectStatus(projectId: string, status: string) {
    try {
      await turnkeyApi.updateProjectStatus(projectId, { status });
      toast.success(`Статус обновлён: ${status}`);
      loadTurnkeyProjects();
    } catch (e) {
      toast.error(t('common.error'));
    }
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) return null;

  const tabs: { key: AdminTab; label: string; icon: any }[] = [
    { key: 'overview', label: t('admin.tabOverview'), icon: BarChart3 },
    { key: 'users', label: t('admin.tabUsers'), icon: Users },
    { key: 'orders', label: t('admin.tabOrders'), icon: ShoppingBag },
    { key: 'payments', label: t('admin.tabPayments'), icon: CreditCard },
    { key: 'stores', label: t('stores.title'), icon: Store },
    { key: 'turnkey', label: t('turnkey.title'), icon: Hammer },
    { key: 'config', label: t('admin.tabConfig'), icon: Settings },
  ];

  const stats = dashboard?.stats;

  // Order status distribution for chart
  const orderStatusItems = useMemo(() => {
    if (!dashboard?.ordersByStatus) return [];
    const statusColors: Record<string, string> = {
      PUBLISHED: 'bg-blue-500',
      IN_PROGRESS: 'bg-yellow-500',
      COMPLETED: 'bg-green-500',
      CANCELLED: 'bg-red-500',
      DRAFT: 'bg-gray-400',
      DISPUTED: 'bg-purple-500',
    };
    return dashboard.ordersByStatus.map((s) => ({
      label: s.status,
      count: s.count,
      color: statusColors[s.status] || 'bg-gray-400',
    }));
  }, [dashboard]);

  return (
    <div className="page-container pb-20">
      <h1 className="page-title flex items-center gap-2 mb-2">
        <Shield size={24} className="text-red-500" />
        {t('admin.title')}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB: OVERVIEW                          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {loading ? (
            <LoadingSpinner />
          ) : stats ? (
            <div className="space-y-6">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label={t('admin.statUsers')}
                  value={stats.totalUsers}
                  subValue={`${t('admin.masters')}: ${stats.totalMasters} · ${t('admin.clients')}: ${stats.totalClients}`}
                  color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                />
                <StatCard
                  icon={ShoppingBag}
                  label={t('admin.statOrders')}
                  value={stats.totalOrders}
                  subValue={`${t('admin.activeOrders')}: ${stats.activeOrders}`}
                  color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                />
                <StatCard
                  icon={DollarSign}
                  label={t('admin.statRevenue')}
                  value={formatPrice(stats.totalRevenue, t('common.currency'))}
                  subValue={`${t('admin.today')}: ${formatPrice(stats.todayRevenue, t('common.currency'))}`}
                  color="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                />
                <StatCard
                  icon={Activity}
                  label={t('admin.completedToday')}
                  value={stats.todayOrders}
                  subValue={`${t('admin.newOrders')}`}
                  color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                />
              </div>

              {/* Secondary Stats: Registration Fees & Urgent */}
              <div className="grid grid-cols-3 gap-2">
                <div className="card !p-3 text-center">
                  <Shield size={16} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.registrationFeesPaid || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.regFeesPaid')}</p>
                </div>
                <div className="card !p-3 text-center">
                  <AlertTriangle size={16} className="mx-auto text-red-500 dark:text-red-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.unpaidMasters || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.unpaidMasters')}</p>
                </div>
                <div className="card !p-3 text-center">
                  <Zap size={16} className="mx-auto text-orange-500 dark:text-orange-400 mb-1" />
                  <p className="text-lg font-bold dark:text-white">{stats.urgentOrders || 0}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('admin.urgentOrders')}</p>
                </div>
              </div>

              {/* Order Status Distribution */}
              {orderStatusItems.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Package size={18} className="text-primary-600 dark:text-primary-400" />
                    {t('admin.statOrders')} — {t('admin.statistics')}
                  </h3>
                  <StatusBar items={orderStatusItems} />
                </div>
              )}

              {/* Top Masters */}
              {dashboard?.topMasters && dashboard.topMasters.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Star size={18} className="text-yellow-500" />
                    {t('admin.topMasters')}
                  </h3>
                  <div className="space-y-3">
                    {dashboard.topMasters.slice(0, 5).map((m: any, i: number) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          i === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                          i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {m.user?.profile?.firstName || t('admin.noName')} {m.user?.profile?.lastName || ''}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ⭐ {m.rating?.toFixed(1) || '0.0'} · {m.completedOrders || 0} {t('admin.statOrders').toLowerCase()}
                          </p>
                        </div>
                        {m.user?.isVerified && (
                          <Shield size={14} className="text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              {dashboard?.recentOrders && dashboard.recentOrders.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-4 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-primary-600 dark:text-primary-400" />
                    {t('admin.recentOrdersTitle')}
                  </h3>
                  <div className="space-y-2">
                    {dashboard.recentOrders.slice(0, 5).map((o: any) => (
                      <div
                        key={o.id}
                        onClick={() => navigate(`/orders/${o.id}`)}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {o.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {o.client?.profile?.firstName || '?'} · {o.category?.name || ''}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <StatusBadge status={o.status} />
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                            {formatPrice(o.price, t('common.currency'))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title={t('common.noData')}
              description={t('common.error')}
            />
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: USERS                             */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9 text-sm"
                placeholder={t('admin.searchPlaceholder')}
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-auto text-sm"
              value={usersRole}
              onChange={(e) => { setUsersRole(e.target.value); setUsersPage(1); }}
            >
              <option value="">{t('admin.allRoles')}</option>
              <option value="CLIENT">{t('admin.clients')}</option>
              <option value="MASTER">{t('admin.masters')}</option>
              <option value="ADMIN">{t('admin.admins')}</option>
            </select>
          </div>

          {/* Users List */}
          {usersLoading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="card">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {u.profile?.avatarUrl ? (
                        <img src={u.profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Users size={18} className="text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate dark:text-white">
                          {u.profile?.firstName || t('admin.noName')} {u.profile?.lastName || ''}
                        </p>
                        {u.isVerified && <Shield size={12} className="text-green-500 flex-shrink-0" />}
                        {!u.isActive && <Ban size={12} className="text-red-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          u.role === 'MASTER' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          u.role === 'ADMIN' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {u.role}
                        </span>
                        {u.username && <span>@{u.username}</span>}
                        {u.phone && <span>{u.phone}</span>}
                      </div>
                      <div className="flex gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        <span>📦 {u._count?.clientOrders || 0} / {u._count?.masterOrders || 0}</span>
                        <span>⭐ {u._count?.reviewsReceived || 0}</span>
                        <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {!u.isVerified && u.role === 'MASTER' && (
                        <button
                          onClick={() => handleVerify(u.id)}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                          title={t('admin.verify')}
                        >
                          <UserCheck size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleBlock(u.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.isActive
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                            : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                        }`}
                        title={u.isActive ? t('admin.block') : t('admin.unblock')}
                      >
                        {u.isActive ? <UserX size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {usersTotalPages > 1 && (
            <Pagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: ORDERS                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              className="input text-sm flex-1"
              value={ordersStatus}
              onChange={(e) => { setOrdersStatus(e.target.value); setOrdersPage(1); }}
            >
              <option value="">Все статусы</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="DISPUTED">DISPUTED</option>
            </select>
            <button
              onClick={() => loadOrders()}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <LoadingSpinner />
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="card cursor-pointer hover:shadow-md dark:hover:shadow-black/20 transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {o.isUrgent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            ⚡ URGENT
                          </span>
                        )}
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="font-medium text-sm truncate dark:text-white">{o.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>👤 {o.client?.profile?.firstName || '?'}</span>
                        {o.master && <span>🔧 {o.master?.profile?.firstName || '?'}</span>}
                        <span>📁 {o.category?.name || ''}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        <span>💬 {o._count?.responses || 0}</span>
                        <span>⭐ {o._count?.reviews || 0}</span>
                        <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm dark:text-white">
                        {formatPrice(o.price, t('common.currency'))}
                      </p>
                      {o.commissionPaid && (
                        <span className="text-[10px] text-green-600 dark:text-green-400">✅ комиссия</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {ordersTotalPages > 1 && (
            <Pagination page={ordersPage} totalPages={ordersTotalPages} onPageChange={setOrdersPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: PAYMENTS                          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            <select
              className="input text-sm flex-1"
              value={paymentsStatus}
              onChange={(e) => { setPaymentsStatus(e.target.value); setPaymentsPage(1); }}
            >
              <option value="">Все статусы</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
            <select
              className="input text-sm w-auto"
              value={paymentsProvider}
              onChange={(e) => { setPaymentsProvider(e.target.value); setPaymentsPage(1); }}
            >
              <option value="">Все провайдеры</option>
              <option value="CLICK">Click</option>
              <option value="PAYME">Payme</option>
              <option value="TELEGRAM_STARS">Telegram Stars</option>
            </select>
          </div>

          {/* Payments List */}
          {paymentsLoading ? (
            <LoadingSpinner />
          ) : payments.length === 0 ? (
            <EmptyState icon={CreditCard} title={t('common.noData')} />
          ) : (
            <div className="space-y-2">
              {payments.map((p) => {
                const statusColorMap: Record<string, string> = {
                  COMPLETED: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  PENDING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  PROCESSING: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  FAILED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  REFUNDED: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                };
                const typeColorMap: Record<string, string> = {
                  ORDER_COMMISSION: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
                  REGISTRATION_FEE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                  ORDER_PAYMENT: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
                  REFERRAL_BONUS: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                  SUBSCRIPTION: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
                };

                return (
                  <div key={p.id} className="card">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        statusColorMap[p.status] || 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'COMPLETED' ? <CheckCircle size={18} /> :
                         p.status === 'FAILED' ? <XCircle size={18} /> :
                         <Clock size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm truncate dark:text-white">
                            {p.user?.profile?.firstName || '?'} {p.user?.profile?.lastName || ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            typeColorMap[p.type] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {p.type}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            statusColorMap[p.status] || 'bg-gray-100 text-gray-600'
                          }`}>
                            {p.status}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {p.provider}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {p.order?.title ? `📦 ${p.order.title}` : ''} · {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm dark:text-white">
                          {formatPrice(p.amount, t('common.currency'))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {paymentsTotalPages > 1 && (
            <Pagination page={paymentsPage} totalPages={paymentsTotalPages} onPageChange={setPaymentsPage} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: STORES                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Store size={18} className="text-blue-600 dark:text-blue-400" />
              Заявки на партнёрство
            </h2>
            <select
              value={requestsStatus}
              onChange={(e) => setRequestsStatus(e.target.value)}
              className="input text-sm w-40"
            >
              <option value="">Все статусы</option>
              <option value="PENDING">Ожидают</option>
              <option value="APPROVED">Одобрены</option>
              <option value="REJECTED">Отклонены</option>
            </select>
          </div>

          {requestsLoading ? (
            <LoadingSpinner />
          ) : partnerRequests.length === 0 ? (
            <EmptyState icon={Store} title="Нет заявок" description="Пока нет заявок на партнёрство" />
          ) : (
            <div className="space-y-3">
              {partnerRequests.map((req: any) => (
                <div key={req.id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold dark:text-white">{req.storeName}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        👤 {req.contactPerson} • 📞 {req.phone} • 📂 {req.storeCategory}
                      </p>
                      {req.city && <p className="text-xs text-gray-400 dark:text-gray-500">📍 {req.city} {req.address || ''}</p>}
                      {req.message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">"{req.message}"</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(req.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          className="px-4 py-2 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition"
                        >
                          <CheckCircle size={14} className="inline mr-1" /> Одобрить
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="px-4 py-2 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                        >
                          <Ban size={14} className="inline mr-1" /> Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: TURNKEY                           */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'turnkey' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Hammer size={18} className="text-amber-600 dark:text-amber-400" />
              Проекты «Ремонт под ключ»
            </h2>
            <select
              value={turnkeyStatus}
              onChange={(e) => setTurnkeyStatus(e.target.value)}
              className="input text-sm w-44"
            >
              <option value="">Все статусы</option>
              <option value="INQUIRY">Заявка</option>
              <option value="CONSULTATION">Консультация</option>
              <option value="DESIGNING">Проектирование</option>
              <option value="APPROVED">Утверждён</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="COMPLETED">Завершён</option>
              <option value="CANCELLED">Отменён</option>
            </select>
          </div>

          {turnkeyLoading ? (
            <LoadingSpinner />
          ) : turnkeyProjects.length === 0 ? (
            <EmptyState icon={Hammer} title="Нет проектов" description="Проекты ремонта под ключ не найдены" />
          ) : (
            <div className="space-y-3">
              {turnkeyProjects.map((proj: any) => {
                const completedStages = proj.stages?.filter((s: any) => s.status === 'completed').length || 0;
                const totalStages = proj.stages?.length || 0;
                const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

                const statusColors: Record<string, string> = {
                  INQUIRY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  CONSULTATION: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
                  DESIGNING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  IN_PROGRESS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                };

                return (
                  <div key={proj.id} className="card">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold dark:text-white">{proj.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[proj.status] || statusColors.INQUIRY}`}>
                            {proj.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {proj.propertyType === 'apartment' ? '🏢' : proj.propertyType === 'house' ? '🏠' : proj.propertyType === 'office' ? '🏬' : '🏪'}
                          {' '}{proj.propertyType}
                          {proj.area ? ` • ${proj.area} м²` : ''}
                          {proj.rooms ? ` • ${proj.rooms} ком.` : ''}
                        </p>
                        {proj.address && <p className="text-xs text-gray-400 dark:text-gray-500">📍 {proj.address}{proj.city ? `, ${proj.city}` : ''}</p>}
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {proj.totalPrice && <span>💰 {proj.totalPrice.toLocaleString()} UZS</span>}
                          {proj.designIncluded && <span>🎨 Дизайн</span>}
                          {proj.furnitureIncluded && <span>🪑 Мебель</span>}
                          <span>📅 {new Date(proj.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Mini progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{completedStages}/{totalStages}</span>
                        </div>
                      </div>

                      {/* Status quick-actions */}
                      <div className="flex flex-wrap gap-1 flex-shrink-0">
                        {proj.status === 'INQUIRY' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'CONSULTATION')}
                            className="px-3 py-1.5 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-100 transition"
                          >
                            → Консультация
                          </button>
                        )}
                        {proj.status === 'CONSULTATION' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'DESIGNING')}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 transition"
                          >
                            → Проектирование
                          </button>
                        )}
                        {proj.status === 'DESIGNING' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 transition"
                          >
                            → Утвердить
                          </button>
                        )}
                        {proj.status === 'APPROVED' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'IN_PROGRESS')}
                            className="px-3 py-1.5 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-100 transition"
                          >
                            → В работу
                          </button>
                        )}
                        {proj.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'COMPLETED')}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-100 transition"
                          >
                            → Завершить
                          </button>
                        )}
                        {!['COMPLETED', 'CANCELLED'].includes(proj.status) && (
                          <button
                            onClick={() => handleUpdateProjectStatus(proj.id, 'CANCELLED')}
                            className="px-3 py-1.5 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                          >
                            Отменить
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB: CONFIG                            */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <Database size={18} className="text-primary-600 dark:text-primary-400" />
              {t('admin.platformConfig')}
            </h2>
            <button
              onClick={loadConfig}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {configLoading ? (
            <LoadingSpinner />
          ) : config.length === 0 ? (
            <EmptyState icon={Settings} title={t('common.noData')} description="Нет настроек платформы" />
          ) : (
            <div className="space-y-2">
              {config.map((c) => (
                <div key={c.id} className="card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium dark:text-white truncate">{c.key}</p>
                      {c.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {editingConfig === c.key ? (
                        <>
                          <input
                            type="text"
                            className="input text-sm w-32"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveConfig(c.key)}
                          />
                          <button
                            onClick={() => handleSaveConfig(c.key)}
                            className="p-2 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingConfig(null)}
                            className="p-2 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                            {c.value}
                          </span>
                          {user?.role === 'ADMIN' && (
                            <button
                              onClick={() => { setEditingConfig(c.key); setEditValue(c.value); }}
                              className="p-2 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              <Settings size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pagination Component ───────────────────
function Pagination({ page, totalPages, onPageChange }: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={20} className="dark:text-gray-400" />
      </button>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={20} className="dark:text-gray-400" />
      </button>
    </div>
  );
}
