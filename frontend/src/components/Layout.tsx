// ============================================
// MasterUz — Layout Component (i18n + роли)
// ============================================

import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { ScrollToTop } from './ScrollToTop';
import { InstallPrompt } from './InstallPrompt';
import { CookieConsent } from './CookieConsent';
import { BackToTop } from './BackToTop';
import { OfflineIndicator } from './OfflineIndicator';
import { ThemeToggle } from './ThemeToggle';
import { SearchOverlay } from './SearchOverlay';
import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks';
import {
  Home,
  Search,
  PlusCircle,
  User,
  Settings,
  GraduationCap,
  MapPin,
  LogOut,
  Briefcase,
  LayoutDashboard,
  Heart,
  Users,
  ShoppingCart,
  Store,
  Hammer,
  Menu,
  X,
  Wrench,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { authApi } from '../api/client';
import toast from 'react-hot-toast';
import { useCartStore } from '../store/cartStore';

export function Layout() {
  const location = useLocation();
  const { user, isAuthenticated, logout, setUser, setAuth } = useAuthStore();
  const { t } = useTranslation();
  const isMaster = user?.role === 'MASTER';
  const isClient = user?.role === 'CLIENT';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const totalCartItems = useCartStore((s) => s.getTotalItems());

  // Админ-статус определяется из бэкенда (поле isAdminUser)
  const isAdminUser = user?.isAdminUser === true || isAdmin;

  // Переключение роли обратно в админа
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

  // Detect Telegram Mini App (body has class 'tg-mini-app' set in main.tsx)
  const [isTgApp] = useState(() => document.body.classList.contains('tg-mini-app'));

  // Online status heartbeat for masters
  useOnlineStatus();

  // Ctrl+K / Cmd+K keyboard shortcut for global search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Блокируем скролл body, пока открыто мобильное меню — иначе на Android
  // URL-бар начинает прыгать на изменении высоты документа и экран мигает.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  // Desktop nav items
  const navItems = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/orders', icon: Search, label: t('nav.orders') },
    { path: '/masters', icon: Users, label: t('nav.masters') },
    ...(isAuthenticated
      ? [
          ...(isMaster
            ? [{ path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') }]
            : [{ path: '/new-order', icon: PlusCircle, label: t('nav.create') }]),
          { path: '/my-orders', icon: Briefcase, label: t('nav.myOrders') },
          ...(isClient ? [{ path: '/favorites', icon: Heart, label: t('nav.favorites') }] : []),
          { path: '/map', icon: MapPin, label: t('nav.map') },
          { path: '/profile', icon: User, label: t('nav.profile') },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Telegram spacer — pushes header below TG native buttons */}
      {isTgApp && <div className="tg-header-spacer md:hidden" />}

      {/* Header — not sticky on mobile in TG to avoid overlap with TG buttons */}
      <header className={`${isTgApp ? 'relative' : 'sticky top-0'} z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16 gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Wrench size={24} className="text-primary-600 dark:text-primary-400" />
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">MasterUz</span>
            </Link>

            {/* Desktop nav — hidden on mobile */}
            <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    location.pathname === item.path
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              ))}

              {isMaster && (
                <Link
                  to="/school"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
                >
                  <GraduationCap size={15} />
                  {t('nav.school')}
                </Link>
              )}

              <Link
                to="/stores"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  location.pathname.startsWith('/stores')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Store size={15} />
                {t('stores.title')}
              </Link>

              <Link
                to="/turnkey"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  location.pathname.startsWith('/turnkey')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Hammer size={15} />
                {t('turnkey.title')}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
                >
                  <Settings size={15} />
                  {t('nav.admin')}
                </Link>
              )}

              {/* Кнопка возврата в админку для админ-пользователей */}
              {!isAdmin && isAdminUser && (
                <button
                  onClick={handleSwitchToAdmin}
                  disabled={switchingRole}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 whitespace-nowrap transition-colors"
                >
                  <ShieldCheck size={15} />
                  Админ
                </button>
              )}
            </nav>

            {/* Desktop right side actions — hidden on mobile */}
            <div className="hidden lg:flex items-center gap-1 shrink-0">
              {/* «Стать мастером» — кнопка в правом верхнем углу (видна не-мастерам) */}
              {(!isAuthenticated || isClient) && (
                <Link
                  to="/become-master"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm mr-1"
                >
                  <Wrench size={14} />
                  Стать мастером
                </Link>
              )}

              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t('common.search')}
              >
                <Search size={17} />
              </button>

              <Link
                to="/cart"
                className="relative p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t('cart.title')}
              >
                <ShoppingCart size={17} />
                {totalCartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                    {totalCartItems}
                  </span>
                )}
              </Link>

              <ThemeToggle />
              <LanguageSwitcher />

              {isAuthenticated && <NotificationBell />}

              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={logout}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={t('nav.logout')}
                  >
                    <LogOut size={17} />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="btn-primary text-xs px-3 py-1.5">
                  {t('nav.login')}
                </Link>
              )}
            </div>

            {/* Mobile: ONLY the burger button — big and prominent */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden relative flex items-center justify-center w-11 h-11 rounded-xl bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all shadow-md shadow-primary-500/20"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {/* Cart badge on burger */}
              {totalCartItems > 0 && !mobileMenuOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile fullscreen menu — fixed overlay, не меняет высоту header'а
            (иначе на Android Chrome/Telegram URL-бар анимируется и экран мигает) */}
      </header>

      {mobileMenuOpen && (
        <>
          {/* Backdrop — глушит фон и закрывает меню по клику */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Само меню — белый/тёмный лист поверх фона, 100dvh для корректной высоты на Android */}
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto overscroll-contain"
            style={{ top: isTgApp ? 136 : 56, maxHeight: '100dvh' }}
          >
            <div className="px-4 py-4 space-y-1">

              {/* Quick actions row */}
              <div className="flex items-center justify-around py-3 mb-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <button
                  onClick={() => { setSearchOpen(true); setMobileMenuOpen(false); }}
                  className="flex flex-col items-center gap-1 p-2"
                >
                  <Search size={22} className="text-primary-500" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('common.search')}</span>
                </button>
                <Link
                  to="/cart"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-col items-center gap-1 p-2 relative"
                >
                  <ShoppingCart size={22} className="text-primary-500" />
                  {totalCartItems > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                      {totalCartItems}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('cart.title')}</span>
                </Link>
                <div className="flex flex-col items-center gap-1 p-2">
                  <ThemeToggle />
                </div>
                <div className="flex flex-col items-center gap-1 p-2">
                  <LanguageSwitcher />
                </div>
                {isAuthenticated && (
                  <div className="flex flex-col items-center gap-1 p-2">
                    <NotificationBell />
                  </div>
                )}
              </div>

              {/* Navigation links */}
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon size={22} />
                  {item.label}
                </Link>
              ))}

              {isMaster && (
                <Link
                  to="/forum"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <MessageSquare size={22} />
                  {t('nav.forum')}
                </Link>
              )}

              {isMaster && (
                <Link
                  to="/school"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <GraduationCap size={22} />
                  {t('nav.school')}
                </Link>
              )}

              <Link
                to="/stores"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Store size={22} />
                {t('stores.title')}
              </Link>

              <Link
                to="/turnkey"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Hammer size={22} />
                {t('turnkey.title')}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Settings size={22} />
                  {t('nav.admin')}
                </Link>
              )}

              {/* Вернуться в админку — для админ-пользователей */}
              {!isAdmin && isAdminUser && (
                <button
                  onClick={() => { handleSwitchToAdmin(); setMobileMenuOpen(false); }}
                  disabled={switchingRole}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <ShieldCheck size={22} />
                  Вернуться в Админ-панель
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-3" />

              {/* «Стать мастером» в мобильном меню */}
              {(!isAuthenticated || isClient) && (
                <Link
                  to="/become-master"
                  className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-colors shadow-md mb-2"
                >
                  <Wrench size={20} />
                  Стать мастером
                </Link>
              )}

              {isAuthenticated ? (
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut size={22} />
                  {t('nav.logout')}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-base font-bold bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-md"
                >
                  {t('nav.login')}
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="hidden md:block bg-gray-900 dark:bg-gray-950 text-gray-300 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <Wrench size={24} className="text-primary-400" />
                <span className="text-xl font-bold text-white">MasterUz</span>
              </Link>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t('common.tagline')} — {t('home.heroDesc').slice(0, 80)}...
              </p>
            </div>

            {/* For Clients */}
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">{t('footer.forClients')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/orders" className="hover:text-white transition-colors">{t('nav.orders')}</Link></li>
                <li><Link to="/instant-order" className="hover:text-white transition-colors">{t('newOrder.instant.title')}</Link></li>
                <li><Link to="/orders/create" className="hover:text-white transition-colors">{t('newOrder.detailed.title')}</Link></li>
                <li><Link to="/masters" className="hover:text-white transition-colors">{t('nav.masters')}</Link></li>
                <li><Link to="/map" className="hover:text-white transition-colors">{t('nav.map')}</Link></li>
                <li><Link to="/stores" className="hover:text-white transition-colors">{t('stores.title')}</Link></li>
                <li><Link to="/turnkey" className="hover:text-white transition-colors">{t('turnkey.title')}</Link></li>
              </ul>
            </div>

            {/* For Masters */}
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">{t('footer.forMasters')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/become-master" className="hover:text-white transition-colors">{t('profile.becomeMaster')}</Link></li>
                <li><Link to="/school" className="hover:text-white transition-colors">{t('nav.school')}</Link></li>
                <li><Link to="/stores/partner-request" className="hover:text-white transition-colors">{t('stores.becomePartner')}</Link></li>
                <li><Link to="/about" className="hover:text-white transition-colors">{t('footer.faq')}</Link></li>
              </ul>
            </div>

            {/* Legal & Support */}
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">{t('footer.about')}</Link></li>
                <li><Link to="/support" className="hover:text-white transition-colors">{t('support.title')}</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Вакансии</Link></li>
                <li><Link to="/development" className="hover:text-white transition-colors">Разработка</Link></li>
                <li><Link to="/public-offer" className="hover:text-white transition-colors">{t('home.publicOffer')}</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t('home.privacyPolicy')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Условия использования</Link></li>
                <li><Link to="/complaint" className="hover:text-white transition-colors">Подать жалобу</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs text-gray-500">{t('common.allRights')}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <a href="https://t.me/masteruz_support" className="hover:text-white transition-colors">
                Telegram
              </a>
              <a href="tel:+998957005040" className="hover:text-white transition-colors">
                +998 95 700-50-40
              </a>
              <a href="mailto:vladlabcorp@gmail.com" className="hover:text-white transition-colors">
                vladlabcorp@gmail.com
              </a>
            </div>
          </div>

          {/* Юридические реквизиты */}
          <div className="border-t border-gray-800 mt-4 pt-4 text-[11px] text-gray-500 leading-relaxed text-center md:text-left">
            ООО «Vladlab» · ИНН <span className="text-gray-400">313 020 180</span> ·
            ОКЭД 63.12.0 (деятельность веб-порталов) · г. Ташкент, Республика Узбекистан.
            Платформа является информационным посредником между клиентами и независимыми
            мастерами и не оказывает строительно-ремонтных услуг от своего имени.
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      <ScrollToTop />

      {/* Back to top button */}
      <BackToTop />

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* PWA Install prompt */}
      <InstallPrompt />

      {/* Cookie consent */}
      <CookieConsent />

      {/* Global search overlay */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
