// ============================================
// MasterUz — Notifications Page (полная)
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, ChevronRight,
  ShoppingBag, Star, MessageSquare, AlertTriangle, Gift, Shield, Info
} from 'lucide-react';
import type { Notification } from '../types';
import toast from 'react-hot-toast';

const NOTIFICATION_ICONS: Record<string, any> = {
  ORDER_RESPONSE: ShoppingBag,
  ORDER_ACCEPTED: Check,
  ORDER_COMPLETED: Star,
  ORDER_CANCELLED: AlertTriangle,
  NEW_MESSAGE: MessageSquare,
  NEW_REVIEW: Star,
  PROMO_CODE: Gift,
  GUARANTEE: Shield,
  SYSTEM: Info,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  ORDER_RESPONSE: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  ORDER_ACCEPTED: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  ORDER_COMPLETED: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  ORDER_CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  NEW_MESSAGE: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  NEW_REVIEW: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  PROMO_CODE: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  GUARANTEE: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  SYSTEM: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadNotifications();
  }, [page]);

  async function loadNotifications() {
    try {
      setLoading(true);
      const res = await notificationsApi.getAll(page);
      const data = res.data.data;
      if (Array.isArray(data)) {
        setNotifications(prev => page === 1 ? data : [...prev, ...data]);
        setHasMore(data.length >= 20);
      } else if (data?.items) {
        setNotifications(prev => page === 1 ? data.items : [...prev, ...data.items]);
        setHasMore(data.pagination?.hasNext || false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      toast.error(t('common.error'));
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success(t('notifications.allMarkedRead'));
    } catch (error) {
      toast.error(t('common.error'));
    }
  }

  async function handleDelete(id: string) {
    try {
      await notificationsApi.remove(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(t('notifications.deleted'));
    } catch (error) {
      toast.error(t('common.error'));
    }
  }

  function handleClick(notification: Notification) {
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }
    // Navigate based on notification type
    if (notification.data?.orderId) {
      navigate(`/orders/${notification.data.orderId}`);
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('notifications.justNow');
    if (minutes < 60) return `${minutes} ${t('notifications.minutesAgo')}`;
    if (hours < 24) return `${hours} ${t('notifications.hoursAgo')}`;
    if (days < 7) return `${days} ${t('notifications.daysAgo')}`;
    return date.toLocaleDateString();
  }

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading && page === 1) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('notifications.title')}</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
          >
            <CheckCheck size={16} />
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {t('notifications.all')} ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {t('notifications.unread')} ({unreadCount})
        </button>
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={t('notifications.empty')}
          description={t('notifications.emptyDesc')}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => {
            const IconComponent = NOTIFICATION_ICONS[notification.type] || Bell;
            const colorClass = NOTIFICATION_COLORS[notification.type] || 'bg-gray-100 text-gray-600';

            return (
              <div
                key={notification.id}
                className={`card flex items-start gap-3 cursor-pointer hover:shadow-md dark:hover:shadow-black/20 transition-shadow ${
                  !notification.isRead ? 'border-l-4 border-l-primary-500 bg-primary-50/30 dark:bg-primary-900/10' : ''
                }`}
                onClick={() => handleClick(notification)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <IconComponent size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-white`}>
                      {notification.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(notification.createdAt)}</span>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 mt-3 flex-shrink-0" />
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
              disabled={loading}
            >
              {loading ? t('common.loading') : t('notifications.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
