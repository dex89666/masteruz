// ============================================
// MasterUz — Notification Bell (колокольчик уведомлений)
// ============================================

import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, MessageSquare, ShieldCheck, Camera, X } from 'lucide-react';
import { notificationsApi } from '../api/client';
import { useTranslation } from '../i18n';
import type { Notification } from '../types';

const ICON_MAP: Record<string, any> = {
  CHAT_MESSAGE: MessageSquare,
  ORDER_PHOTO: Camera,
  GUARANTEE_CREATED: ShieldCheck,
  GUARANTEE_CLAIMED: ShieldCheck,
  default: Bell,
};

export function NotificationBell() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Загрузка непрочитанных — при маунте и каждые 30 сек
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, []);

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
      navigate(`/orders/${data.orderId}`);
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
