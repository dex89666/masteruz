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
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';

export function Layout() {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { t } = useTranslation();
  const isMaster = user?.role === 'MASTER';
  const isClient = user?.role === 'CLIENT';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalCartItems = useCartStore((s) => s.getTotalItems());

  // Detect Telegram Mini App environment
  const isTelegramWebApp = !!(window as any).Telegram?.WebApp?.initData;

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

  // Desktop nav items
  const navItems = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/orders', icon: Search, label: t('nav.orders') },
    { path: '/masters', icon: Users, label: t('nav.masters') },
    ...(isAuthenticated
      ? [
          ...(isMaster
            ? [{ path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') }]
            : [{ path: '/orders/create', icon: PlusCircle, label: t('nav.create') }]),
          { path: '/my-orders', icon: Briefcase, label: t('nav.myOrders') },
          ...(isClient ? [{ path: '/favorites', icon: Heart, label: t('nav.favorites') }] : []),
          { path: '/map', icon: MapPin, label: t('nav.map') },
          { path: '/profile', icon: User, label: t('nav.profile') },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className={`sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 ${isTelegramWebApp ? 'mt-0' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">MasterUz</span>
            </Link>

            {/* Desktop nav — hidden on mobile */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}

              {isMaster && (
                <Link
                  to="/school"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <GraduationCap size={18} />
                  {t('nav.school')}
                </Link>
              )}

              <Link
                to="/stores"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/stores')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Store size={18} />
                {t('stores.title')}
              </Link>

              <Link
                to="/turnkey"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/turnkey')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Hammer size={18} />
                {t('turnkey.title')}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Settings size={18} />
                  {t('nav.admin')}
                </Link>
              )}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Global search button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t('common.search')}
              >
                <Search size={18} />
              </button>

              {/* Cart button */}
              <Link
                to="/cart"
                className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t('cart.title')}
              >
                <ShoppingCart size={18} />
                {totalCartItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalCartItems}
                  </span>
                )}
              </Link>

              <ThemeToggle />
              <LanguageSwitcher />

              {isAuthenticated && <NotificationBell />}

              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.profile?.firstName}
                  </span>
                  <button
                    onClick={logout}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={t('nav.logout')}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="hidden md:inline-flex btn-primary text-sm px-4 py-2">
                  {t('nav.login')}
                </Link>
              )}

              {/* Mobile hamburger menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-[70vh] overflow-y-auto">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              ))}

              {isMaster && (
                <Link
                  to="/school"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <GraduationCap size={20} />
                  {t('nav.school')}
                </Link>
              )}

              <Link
                to="/stores"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Store size={20} />
                {t('stores.title')}
              </Link>

              <Link
                to="/turnkey"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Hammer size={20} />
                {t('turnkey.title')}
              </Link>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Settings size={20} />
                  {t('nav.admin')}
                </Link>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-700 my-2" />

              {isAuthenticated ? (
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut size={20} />
                  {t('nav.logout')}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  {t('nav.login')}
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

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
                <span className="text-2xl">🔧</span>
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
                <li><Link to="/orders/create" className="hover:text-white transition-colors">{t('nav.create')}</Link></li>
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
                <li><a href="#" className="hover:text-white transition-colors">{t('home.publicOffer')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.privacyPolicy')}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs text-gray-500">{t('common.allRights')}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <a href="https://t.me/masteruz_support" className="hover:text-white transition-colors">
                Telegram
              </a>
              <a href="tel:+998901234567" className="hover:text-white transition-colors">
                +998 90 123-45-67
              </a>
              <a href="mailto:info@masteruz.uz" className="hover:text-white transition-colors">
                info@masteruz.uz
              </a>
            </div>
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
