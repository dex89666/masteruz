// ============================================
// MasterUz — Home Page (i18n)
// ============================================

import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, Wrench, Shield, Star, MapPin, Users, GraduationCap, ArrowRight, Zap, HelpCircle, Store, Hammer } from 'lucide-react';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { usersApi, ordersApi, catalogApi } from '../api/client';
import { MasterCard } from '../components/MasterCard';
import { OrderCard } from '../components/OrderCard';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useFormatPrice } from '../hooks';
import type { Order } from '../types';

const FALLBACK_CATEGORIES = [
  { icon: '🔧', slug: 'plumbing', name: 'Сантехника' },
  { icon: '⚡', slug: 'electrical', name: 'Электрика' },
  { icon: '🪑', slug: 'furniture', name: 'Мебель' },
  { icon: '🏗️', slug: 'construction', name: 'Строительство' },
  { icon: '🎨', slug: 'painting', name: 'Покраска и отделка' },
  { icon: '🚪', slug: 'windows-doors', name: 'Окна и двери' },
  { icon: '🔌', slug: 'appliance-install', name: 'Бытовая техника' },
  { icon: '🪵', slug: 'carpentry', name: 'Плотницкие работы' },
  { icon: '🧹', slug: 'cleaning', name: 'Клининг' },
  { icon: '🌿', slug: 'garden-outdoor', name: 'Сад и двор' },
  { icon: '🏠', slug: 'turnkey-renovation', name: 'Ремонт под ключ' },
  { icon: '🎯', slug: 'interior-design', name: 'Дизайн интерьера' },
  { icon: '🪑', slug: 'custom-furniture', name: 'Мебель на заказ' },
  { icon: '🧱', slug: 'building-materials', name: 'Стройматериалы' },
];

const FEATURE_ICONS = [Search, Shield, Star, MapPin] as const;
const FEATURE_KEYS = ['search', 'safety', 'quality', 'nearby'] as const;

const STEP_ICONS = ['📝', '💬', '✅'] as const;
const STEP_KEYS = ['step1', 'step2', 'step3'] as const;

export function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const [topMasters, setTopMasters] = useState<any[]>([]);
  const [urgentOrders, setUrgentOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<any[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    // Load categories from DB
    catalogApi.getCategories()
      .then((res) => {
        const cats = res.data.data || [];
        if (cats.length > 0) setCategories(cats);
      })
      .catch(() => {});

    usersApi.searchMasters({ limit: 6, sortBy: 'rating', sortOrder: 'desc' })
      .then((res) => setTopMasters(res.data.data || []))
      .catch(() => {});

    ordersApi.list({ status: 'PUBLISHED', isUrgent: 'true', page: 1 })
      .then((res) => setUrgentOrders((res.data.data || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900 text-white py-16 md:py-24 relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
              {t('home.heroTitle')}<br />
              <span className="text-primary-400">{t('home.heroSubtitle')}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              {t('home.heroDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/orders" className="inline-flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40">
                <Search size={20} className="mr-2" />
                {t('home.findMaster')}
              </Link>
              {!isAuthenticated && (
                <Link to="/login" className="inline-flex items-center justify-center border-2 border-white/20 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-xl text-base transition-all">
                  <Wrench size={20} className="mr-2" />
                  {t('home.becomeMaster')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 md:py-16 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 dark:text-white">{t('categories.title')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map((cat: any) => (
              <Link
                key={cat.slug}
                to={`/catalog/${cat.slug}`}
                className="card dark:bg-gray-800 dark:ring-gray-700 text-center hover:shadow-md transition-all hover:-translate-y-1 p-4"
              >
                <span className="text-3xl mb-2 block">{cat.icon || '📁'}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Urgent Orders */}
      {urgentOrders.length > 0 && (
        <section className="py-12 md:py-16 bg-orange-50 dark:bg-orange-950/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                <Zap size={24} className="text-orange-500" />
                {t('home.urgentOrdersHome')}
              </h2>
              <Link
                to="/orders?urgent=true"
                className="text-orange-600 dark:text-orange-400 text-sm font-medium flex items-center gap-1 hover:text-orange-700"
              >
                {t('home.viewAllUrgent')}
                <ArrowRight size={16} />
              </Link>
            </div>
            <p className="text-sm text-orange-600/70 dark:text-orange-400/70 mb-6">
              {t('home.urgentOrdersHomeDesc')}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {urgentOrders.map((order) => (
                <OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Platform Stats */}
      <section className="py-10 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-extrabold">
                <AnimatedCounter end={300} suffix="+" />
              </div>
              <p className="text-primary-400 text-sm mt-1">{t('home.stat_services')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold">
                <AnimatedCounter end={14} />
              </div>
              <p className="text-primary-400 text-sm mt-1">{t('home.stat_categories')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold">
                <AnimatedCounter end={8} />
              </div>
              <p className="text-primary-400 text-sm mt-1">{t('home.stat_cities')}</p>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-extrabold">
                <AnimatedCounter end={30} />
              </div>
              <p className="text-primary-400 text-sm mt-1">{t('home.stat_guarantee')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Top Masters */}
      {topMasters.length > 0 && (
        <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold dark:text-white">{t('home.topMasters')}</h2>
              <Link to="/masters" className="text-primary-600 dark:text-primary-400 text-sm font-medium flex items-center gap-1 hover:text-primary-700">
                {t('home.viewAll')}
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topMasters.map((master) => (
                <MasterCard key={master.id} master={master} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Services Promo — Stores & Turnkey */}
      <section className="py-12 md:py-16 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Partner Stores */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8">
              <div className="relative z-10">
                <Store size={40} className="mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-2">{t('stores.title')}</h3>
                <p className="text-blue-100 mb-6 text-sm leading-relaxed">{t('stores.subtitle')}</p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/stores" className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-sm">
                    {t('stores.title')} <ArrowRight size={16} />
                  </Link>
                  <Link to="/stores/partner-request" className="inline-flex items-center gap-2 border border-white/30 text-white px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm">
                    {t('stores.becomePartner')}
                  </Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            </div>

            {/* Turnkey Renovation */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 text-white p-8">
              <div className="relative z-10">
                <Hammer size={40} className="mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-2">{t('turnkey.title')}</h3>
                <p className="text-amber-100 mb-6 text-sm leading-relaxed">{t('turnkey.subtitle')}</p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/turnkey" className="inline-flex items-center gap-2 bg-white text-amber-700 font-semibold px-5 py-2.5 rounded-lg hover:bg-amber-50 transition-colors text-sm">
                    {t('turnkey.createRequest')} <ArrowRight size={16} />
                  </Link>
                  <Link to="/catalog/interior-design" className="inline-flex items-center gap-2 border border-white/30 text-white px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm">
                    🎯 {t('categories.interior-design')}
                  </Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            </div>

            {/* Estimation — Выезд на оценку */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-700 text-white p-8">
              <div className="relative z-10">
                <Search size={40} className="mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-2">🔍 Выезд на оценку</h3>
                <p className="text-cyan-100 mb-6 text-sm leading-relaxed">Мастер приедет, сделает замеры и составит точную смету. Фиксированная цена 150 000 сум.</p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/estimation/create" className="inline-flex items-center gap-2 bg-white text-cyan-700 font-semibold px-5 py-2.5 rounded-lg hover:bg-cyan-50 transition-colors text-sm">
                    Заказать оценку <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 dark:text-white">{t('home.whyUs')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURE_KEYS.map((key, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={key} className="text-center p-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                    <Icon size={28} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="font-semibold mb-2 dark:text-white">{t(`home.feature_${key}_title`)}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t(`home.feature_${key}_desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 md:py-16 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 dark:text-white">{t('home.howItWorks')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEP_KEYS.map((key, i) => (
              <div key={key} className="text-center">
                <div className="text-4xl mb-4">{STEP_ICONS[i]}</div>
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="font-semibold mb-2 dark:text-white">{t(`home.${key}_title`)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t(`home.${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA for masters */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-green-600 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Users size={48} className="mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('home.ctaMaster')}</h2>
          <p className="text-green-100 mb-6 max-w-2xl mx-auto">
            {t('home.ctaMasterDesc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login" className="btn-primary bg-white text-green-700 hover:bg-gray-100 px-8 py-3">
              {t('home.startEarning')}
              <ArrowRight size={18} className="ml-2" />
            </Link>
            <Link to="/school" className="btn-secondary border-white/30 text-white hover:bg-white/10 px-8 py-3">
              <GraduationCap size={18} className="mr-2" />
              {t('home.mastersSchool')}
            </Link>
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="py-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <HelpCircle size={24} className="text-primary-600 dark:text-primary-400" />
            <p className="text-gray-600 dark:text-gray-400">
              {t('support.needHelp')}
            </p>
            <Link to="/support" className="btn-secondary dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 text-sm px-6 py-2">
              {t('support.title')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
