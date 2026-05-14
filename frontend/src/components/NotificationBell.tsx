// ============================================
// MasterUz — Notification Bell (колокольчик уведомлений)
// ============================================

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, MessageSquare, ShieldCheck, Camera, X, Briefcase } from 'lucide-react';
import { notificationsApi } from '../api/client';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store';
import type { Notification } from '../types';
import toast from 'react-hot-toast';

const ICON_MAP: Record<string, any> = {
  CHAT_MESSAGE: MessageSquare,
  ORDER_PHOTO: Camera,
  GUARANTEE_CREATED: ShieldCheck,
  GUARANTEE_CLAIMED: ShieldCheck,
  new_order: Briefcase,
  default: Bell,
};

export function NotificationBell() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastSeenCountRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Показать всплывающее окно для новых заказов
  const showNewOrderPopup = useCallback((n: Notification) => {
    const data = n.data as any;
    toast(
      (toastInstance) => (
        <div
          className="flex items-start gap-3 cursor-pointer max-w-sm"
          onClick={() => {
            toast.dismiss(toastInstance.id);
            if (data?.orderId) navigate(`/orders/${data.orderId}`);
          }}
        >
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full shrink-0">
            <Briefcase size={20} className="text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{n.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1">
              Нажмите, чтобы откликнуться →
            </p>
          </div>
        </div>
      ),
      {
        duration: 10000,
        position: 'top-center',
        style: {
          padding: '12px 16px',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          border: '2px solid #f97316',
          maxWidth: '400px',
        },
      }
    );
  }, [navigate]);

  // Загрузка непрочитанных — при маунте и каждые 30 сек
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Polling для новых уведомлений — каждые 15 сек для мастеров
  useEffect(() => {
    if (user?.role !== 'MASTER') return;
    const interval = setInterval(async () => {
      try {
        const res = await notificationsApi.getAll(1);
        const items: Notification[] = res.data.data?.notifications || res.data.data || [];
        if (!Array.isArray(items) || items.length === 0) return;
        // Находим новые уведомления типа "new_order"
        const newOrders = items.filter(
          (n) => n.type === 'new_order' && !n.isRead
        );
        if (initializedRef.current && newOrders.length > lastSeenCountRef.current) {
          // Показываем popup для самого нового заказа
          const newest = newOrders[0];
          if (newest) showNewOrderPopup(newest);
        }
        lastSeenCountRef.current = newOrders.length;
        initializedRef.current = true;
      } catch {}
    }, 15_000);
    return () => clearInterval(interval);
  }, [user?.role, showNewOrderPopup]);

  // Клик вне — закрываем
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchUnread() {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnread(res.data.data?.count || 0);
    } catch {}
  }

  async function handleOpen() {
    setOpen(!open);
    if (!open) {
      setLoading(true);
      try {
        const res = await notificationsApi.getAll(1);
        setNotifications(res.data.data?.notifications || []);
      } catch {}
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  }

  async function handleClickNotification(n: Notification) {
    // Помечаем прочитанным
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id);
        setUnread((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      } catch {}
    }

    // Навигация по типу
    const data = n.data as any;
    if (data?.orderId) {
      const isChatMessage = n.type === 'CHAT_MESSAGE' || n.type === 'NEW_MESSAGE';
      navigate(`/orders/${data.orderId}${isChatMessage ? '?openChat=1' : ''}`);
    }
    setOpen(false);
  }

  async function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await notificationsApi.remove(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
        title={t('notifications.title')}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 z-50 max-h-[70vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('notifications.title')}</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  {t('notifications.markAllRead')}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                {t('notifications.empty')}
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = ICON_MAP[n.type] || ICON_MAP.default;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      !n.isRead ? 'bg-primary-50/40' : ''
                    }`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-full ${!n.isRead ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, n.id)}
                      className="text-gray-300 hover:text-red-400 p-1 shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: View all link */}
          {notifications.length > 0 && (
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center py-3 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-gray-50 border-t border-gray-100"
            >
              {t('notifications.viewAll')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
