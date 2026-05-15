// ============================================
// MasterUz — My Orders Page (i18n)
// Мои заказы: клиент видит свои заказы, мастер — назначенные
// ============================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { ordersApi } from '../api/client';
import { OrderCard } from '../components/OrderCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuthStore } from '../store';
import { useFormatPrice } from '../hooks';
import { useTranslation } from '../i18n';
import { PlusCircle, CreditCard } from 'lucide-react';
import type { Order, OrderStatus } from '../types';

const STATUS_TABS: { key: string; statuses: OrderStatus[] }[] = [
  { key: 'all', statuses: [] },
  { key: 'active', statuses: ['PUBLISHED', 'IN_PROGRESS'] },
  { key: 'completed', statuses: ['COMPLETED'] },
  { key: 'cancelled', statuses: ['CANCELLED'] },
];

export function MyOrdersPage() {
  const { user } = useAuthStore();
  const formatPrice = useFormatPrice();
  const { t } = useTranslation();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const isMaster = user?.role === 'MASTER';

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    try {
      const response = isMaster
        ? await ordersApi.myMasterOrders()
        : await ordersApi.myClientOrders();
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Error loading my orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const tab = STATUS_TABS.find((t) => t.key === activeTab);
    if (!tab || tab.statuses.length === 0) return true;
    return tab.statuses.includes(order.status);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('myOrders.title')}</h1>
        {!isMaster && (
          <Link to="/new-order" className="btn-primary text-sm">
            <PlusCircle size={16} className="mr-1" />
            {t('orders.createOrder')}
          </Link>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t(`myOrders.tab_${tab.key}`)}
            {tab.key !== 'all' && (
              <span className="ml-1.5 opacity-70">
                {orders.filter((o) =>
                  tab.statuses.length === 0 ? true : tab.statuses.includes(o.status)
                ).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Wrench size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('myOrders.noOrders')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {isMaster ? t('myOrders.noOrdersMaster') : t('myOrders.noOrdersClient')}
          </p>
          <Link to={isMaster ? '/orders' : '/new-order'} className="btn-primary">
            {isMaster ? t('masterDashboard.findOrders') : t('orders.createOrder')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="relative">
              <OrderCard order={order} formatPrice={(price) => formatPrice(price)} />
              {/* Commission payment badge for master */}
              {isMaster && order.masterId && !order.commissionPaid && order.status !== 'CANCELLED' && (
                <Link
                  to={`/orders/${order.id}`}
                  className="absolute top-2 right-2 flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg animate-pulse z-10"
                >
                  <CreditCard size={12} />
                  {t('myOrders.payCommission')}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
