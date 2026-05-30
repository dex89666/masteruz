// ============================================
// MasterUz — Order Card Component (i18n)
// ============================================

import { Link } from 'react-router-dom';
import { MapPin, Clock, MessageSquare, Wallet, Zap } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import AutoCancelCountdown from './AutoCancelCountdown';
import { useTranslation } from '../i18n';
import type { Order } from '../types';

interface OrderCardProps {
  order: Order;
  formatPrice: (price: number, currency?: string) => string;
  showNetEarnings?: boolean;
}

const statusClasses: Record<string, string> = {
  DRAFT: 'badge-info',
  PUBLISHED: 'badge-success',
  IN_PROGRESS: 'badge-warning',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  DISPUTED: 'badge-danger',
};

export function OrderCard({ order, formatPrice, showNetEarnings }: OrderCardProps) {
  const { t, locale } = useTranslation();
  const statusClass = statusClasses[order.status] || 'badge-info';
  const statusLabel = t(`orderStatus.${order.status}`) || order.status;

  // Чистый доход мастера: цена - комиссия - выезд - сервисный сбор с выезда
  const VISIT_FEE = 100000;
  const VISIT_FEE_COMMISSION_RATE = 10; // Процент комиссии с выезда (редактируемый через конфиг)
  const commission = order.price * (order.commissionRate / 100);
  const visitFeeCommission = VISIT_FEE * (VISIT_FEE_COMMISSION_RATE / 100);
  const netEarnings = order.price - commission - VISIT_FEE - visitFeeCommission;

  // Подсветка «горящих» заказов (≤12 ч до авто-отмены) — кричащая рамка
  const hoursLeft = order.autoCancelAt
    ? (new Date(order.autoCancelAt).getTime() - Date.now()) / 3_600_000
    : Infinity;
  const isBurning = order.status === 'PUBLISHED' && hoursLeft > 0 && hoursLeft <= 12;

  return (
    <Link to={`/orders/${order.id}`} className="block">
      <div className={`card hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-shadow animate-fade-in ${
        isBurning ? 'ring-2 ring-red-500 dark:ring-red-500 shadow-red-500/30 shadow-lg' :
        order.isUrgent ? 'ring-2 ring-orange-400 dark:ring-orange-600' : ''
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <CategoryIcon name={order.category?.icon || 'Wrench'} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {order.category?.name}
            </span>
            {order.isUrgent && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 px-2 py-0.5 rounded-full animate-pulse">
                <Zap size={10} />
                {t('orders.urgent')}
              </span>
            )}
          </div>
          <span className={statusClass}>{statusLabel}</span>
        </div>

        {order.status === 'PUBLISHED' && order.autoCancelAt && (
          <div className="mb-2">
            <AutoCancelCountdown autoCancelAt={order.autoCancelAt} compact />
          </div>
        )}

        {/* Превью фото — мастер должен видеть, что за работа, ещё в списке */}
        {(() => {
          const photos = (order.images || []).filter(
            (u: string) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:')),
          );
          if (photos.length === 0) return null;
          return (
            <div data-testid="order-card-photos" className="flex gap-1.5 mb-3 overflow-hidden">
              {photos.slice(0, 3).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative h-20 flex-1 min-w-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
                >
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {i === 2 && photos.length > 3 && (
                    <div className="absolute inset-0 bg-black/55 text-white text-xs font-semibold flex items-center justify-center">
                      +{photos.length - 3}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
          {order.title}
        </h3>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
          {order.description}
        </p>

        {/* Задачи */}
        {order.orderTasks && order.orderTasks.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {order.orderTasks.slice(0, 3).map((ot) => (
              <span
                key={ot.id}
                className="text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full"
              >
                {ot.task?.name}
              </span>
            ))}
            {order.orderTasks.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">+{order.orderTasks.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {formatPrice(order.price, t('common.currency'))}
            </span>
            {showNetEarnings && netEarnings > 0 && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-0.5">
                <Wallet size={11} />
                {t('pricing.netEarnings')}: {formatPrice(netEarnings, t('common.currency'))}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
            {(order.city || order.district || order.street || order.address) && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {[order.city && t(`cities.${order.city}`), order.district, order.street].filter(Boolean).join(', ') || order.address || t('orders.onMap')}
              </span>
            )}

            {order.deadline && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(order.deadline).toLocaleDateString(locale)}
              </span>
            )}

            {order._count?.responses !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} />
                {order._count.responses}
              </span>
            )}

            {order.distance !== undefined && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {order.distance} {t('common.km')}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
