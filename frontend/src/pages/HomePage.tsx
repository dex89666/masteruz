// ============================================
// MasterUz — Home Page (v4.0 — полная переработка)
// Порядок: CTA → Категории → Магазин → Ремонт под ключ → Оценка
// ============================================

import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Search, Shield, Star, MapPin, Users, GraduationCap,
  ArrowRight, Zap, HelpCircle, Store, Hammer, Camera, Handshake, AlertTriangle, ClipboardList,
  FileText, MessageSquare, CheckCircle, ListChecks,
} from 'lucide-react';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { usersApi, ordersApi } from '../api/client';
import { MasterCard } from '../components/MasterCard';
import { OrderCard } from '../components/OrderCard';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useFormatPrice } from '../hooks';
import type { Order } from '../types';
import CategoryIcon from '../components/CategoryIcon';
import { CatalogSearch } from '../components/CatalogSearch';
import { useCatalogFull } from '../hooks/useCatalogData';

// 6 родительских категорий с яркими градиентами (naimi.kz-style)
const PARENT_CATEGORY_STYLES: Record<string, { gradient: string; border: string; iconBg: string }> = {
  'repair-finishing':      { gradient: 'from-blue-500 to-indigo-600',   border: 'border-blue-200 dark:border-blue-800',     iconBg: 'bg-blue-100 dark:bg-blue-900/40' },
  'construction-building': { gradient: 'from-orange-500 to-amber-600',  border: 'border-orange-200 dark:border-orange-800', iconBg: 'bg-orange-100 dark:bg-orange-900/40' },
  'home-help':             { gradient: 'from-green-500 to-emerald-600', border: 'border-green-200 dark:border-green-800',   iconBg: 'bg-green-100 dark:bg-green-900/40' },
  'crafts-manufacturing':  { gradient: 'from-amber-500 to-yellow-600',  border: 'border-amber-200 dark:border-amber-800',   iconBg: 'bg-amber-100 dark:bg-amber-900/40' },
  'tech-equipment':        { gradient: 'from-purple-500 to-violet-600', border: 'border-purple-200 dark:border-purple-800', iconBg: 'bg-purple-100 dark:bg-purple-900/40' },
  'transport-logistics':   { gradient: 'from-red-500 to-rose-600',      border: 'border-red-200 dark:border-red-800',       iconBg: 'bg-red-100 dark:bg-red-900/40' },
};

// Фотографии для родительских категорий (Unsplash, CC0)
const CATEGORY_PHOTOS: Record<string, string> = {
  'repair-finishing':      '/categories/repair-finishing.jpg',
  'construction-building': '/categories/construction-building.jpg',
  'home-help':             '/categories/home-help.jpg',
  'crafts-manufacturing':  '/categories/crafts-manufacturing.jpg',
  'tech-equipment':        '/categories/tech-equipment.jpg',
  'transport-logistics':   '/categories/transport-logistics.jpg',
};

const FALLBACK_PARENT_CATEGORIES = [
  { icon: 'Hammer', slug: 'repair-finishing',      name: 'Ремонт и отделка',         childCount: 6 },
  { icon: 'HardHat', slug: 'construction-building', name: 'Строительство и монтаж',   childCount: 4 },
  { icon: 'Home', slug: 'home-help',             name: 'Помощь по дому',           childCount: 2 },
  { icon: 'Armchair', slug: 'crafts-manufacturing',  name: 'Изготовление и ремесло',   childCount: 2 },
  { icon: 'Zap', slug: 'tech-equipment',        name: 'Техника и оборудование',   childCount: 1 },
  { icon: 'Truck', slug: 'transport-logistics',   name: 'Перевозки и грузчики',     childCount: 1 },
];

const FEATURE_ICONS = [Search, Shield, Star, MapPin] as const;
const FEATURE_KEYS = ['search', 'safety', 'quality', 'nearby'] as const;
const STEP_LUCIDE = [FileText, MessageSquare, CheckCircle] as const;
const STEP_KEYS = ['step1', 'step2', 'step3'] as const;

export function HomePage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const [topMasters, setTopMasters] = useState<any[]>([]);
  const [urgentOrders, setUrgentOrders] = useState<Order[]>([]);
  const { data: catalogParents } = useCatalogFull();
  const parentCategories = catalogParents && catalogParents.length > 0 ? catalogParents : FALLBACK_PARENT_CATEGORIES;

  // Реальная статистика из каталога с маркетинговым округлением вниз до
  // «весомого» числа (никогда не завышаем — клиент получит даже больше).
  const stats = useMemo(() => {
    const roundDown = (n: number, step: number) => Math.max(step, Math.floor(n / step) * step);
    if (!catalogParents || catalogParents.length === 0) {
      return { services: 350, categories: 30, cities: 8, guarantee: 30 };
    }
    let childCategories = 0;
    let services = 0;
    for (const parent of catalogParents) {
      const children = parent.children?.length ? parent.children : [parent];
      childCategories += children.length;
      for (const cat of children) {
        for (const sub of cat.subcategories || []) {
          services += sub.tasks?.length ?? sub._count?.tasks ?? 0;
        }
      }
    }
    return {
      services: roundDown(services, 10),        // 374 → 370+
      categories: roundDown(childCategories, 5), // 30 → 30
      cities: 8,
      guarantee: 30,
    };
  }, [catalogParents]);

  useEffect(() => {
    usersApi.searchMasters({ limit: 6, sortBy: 'rating', sortOrder: 'desc', verifiedOnly: true })
      .then((res) => setTopMasters(res.data.data || []))
      .catch(() => {});

    ordersApi.list({ status: 'PUBLISHED', isUrgent: 'true', page: 1 })
      .then((res) => setUrgentOrders((res.data.data || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">

      {/* ═══ БЛОК 1: Hero — Создать заказ + Стать мастером ═══ */}
      <section className="text-white py-12 md:py-20 relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Full-screen background photo */}
        <div className="absolute inset-0 z-0">
          <img src="/hero-master.jpg" alt="" className="w-full h-full object-cover object-center" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/40 via-gray-900/25 to-gray-900/60" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          {/* ★ «Стать мастером» — зелёная кнопка в правом верхнем углу */}
          <div className="flex justify-end mb-4">
            <Link
              to="/become-master"
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-5 py-3 rounded-xl text-sm md:text-base transition-all shadow-lg shadow-green-500/30 hover:scale-105 min-h-[44px]"
            >
              <Users size={18} />
              Стать мастером
            </Link>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              {t('home.heroTitle')}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">{t('home.heroSubtitle')}</span>
            </h1>
            <p className="text-base md:text-lg text-gray-300 max-w-xl mx-auto">{t('home.heroDesc')}</p>
          </div>

          {/* ★ Две равноценные кнопки: быстрый вариант + детальный */}
          <div className="flex flex-col items-center gap-4 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <Link
                to="/instant-order"
                className="flex flex-col items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-6 rounded-2xl transition-all shadow-xl shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-[1.02] ring-2 ring-orange-400/50 min-h-[112px]"
              >
                <span className="flex items-center gap-2 text-lg md:text-xl"><Camera size={26} /> {t('newOrder.instant.title')}</span>
                <span className="text-xs md:text-sm font-normal text-white/85 mt-1.5 text-center">{t('newOrder.instant.desc')}</span>
              </Link>
              <Link
                to="/orders/create"
                className="flex flex-col items-center justify-center bg-white/95 hover:bg-white text-blue-700 font-bold px-6 py-6 rounded-2xl transition-all shadow-xl hover:scale-[1.02] ring-2 ring-blue-300/70 min-h-[112px] border-2 border-blue-300"
              >
                <span className="flex items-center gap-2 text-lg md:text-xl"><ListChecks size={26} /> {t('newOrder.detailed.title')}</span>
                <span className="text-xs md:text-sm font-normal text-blue-700/80 mt-1.5 text-center">{t('newOrder.detailed.desc')}</span>
              </Link>
            </div>

            {/* ★ Кнопка «Срочный вызов» — красная, заметная */}
            <Link
              to="/instant-order?urgent=true"
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold px-8 py-5 rounded-2xl text-lg md:text-xl transition-all shadow-lg shadow-red-600/40 hover:shadow-red-600/60 hover:scale-[1.02] ring-2 ring-red-500/50 min-h-[64px] animate-pulse-subtle"
            >
              <AlertTriangle size={26} className="shrink-0" />
              <span>Авария? Срочный вызов</span>
              <span className="ml-1 text-sm font-normal bg-white/20 px-2 py-0.5 rounded-full">+40%</span>
            </Link>

            {/* ★ Кнопка «Доступные заказы» — для мастеров */}
            {(user?.role === 'MASTER' || user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
              <Link
                to="/orders"
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-5 rounded-2xl text-lg md:text-xl transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.02] ring-2 ring-green-400/50 min-h-[64px]"
              >
                <ClipboardList size={26} className="shrink-0" />
                <span>Доступные заказы</span>
              </Link>
            )}
          </div>

          <div className="flex justify-center gap-6 mt-8 text-sm text-gray-400">
            <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400" /> 4.9 рейтинг</span>
            <span className="flex items-center gap-1"><Users size={14} className="text-green-400" /> {stats.services}+ услуг</span>
            <span className="flex items-center gap-1"><Shield size={14} className="text-blue-400" /> Гарантия 30 дней</span>
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 2: 6 родительских категорий (naimi.kz-style) ═══ */}
      <section className="py-10 md:py-14 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold dark:text-white mb-2">{t('categories.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-base">Выберите направление — найдём лучшего мастера</p>
          </div>
          {/* Поиск по каталогу */}
          <div className="mb-8">
            <CatalogSearch />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {parentCategories.map((cat: any) => {
              const styles = PARENT_CATEGORY_STYLES[cat.slug] || { gradient: 'from-gray-500 to-gray-600', border: 'border-gray-200 dark:border-gray-700', iconBg: 'bg-gray-100 dark:bg-gray-800' };
              const childCount = cat.children?.length || cat.childCount || 0;
              const photoUrl = CATEGORY_PHOTOS[cat.slug];
              return (
                <Link key={cat.slug} to={`/services/${cat.slug}`}
                  className="group relative overflow-hidden rounded-2xl min-h-[160px] transition-all hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01]">
                  {/* Photo background */}
                  {photoUrl ? (
                    <>
                      <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                      <div className={`absolute inset-0 bg-gradient-to-t ${styles.gradient} opacity-70`} />
                    </>
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient}`} />
                  )}
                  {/* Content over photo */}
                  <div className="relative z-10 p-6 md:p-7 flex flex-col justify-end h-full text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-xl p-2 group-hover:scale-110 transition-transform">
                        <CategoryIcon name={cat.icon || 'Folder'} size="lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg md:text-xl font-bold leading-tight drop-shadow-md">
                          {cat.name}
                        </h3>
                        {childCount > 0 && (
                          <p className="text-sm text-white/80 mt-0.5">
                            {childCount} {childCount === 1 ? 'категория' : childCount < 5 ? 'категории' : 'категорий'}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={20} className="flex-shrink-0 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 3: Магазин + Ремонт под ключ + Оценка ═══ */}
      <section className="py-10 md:py-14 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-7 flex flex-col">
              <div className="relative z-10 flex-1">
                <Store size={36} className="mb-3 opacity-80" />
                <h3 className="text-xl font-bold mb-2">{t('stores.title')}</h3>
                <p className="text-blue-100 mb-5 text-sm leading-relaxed">{t('stores.subtitle')}</p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/stores" className="inline-flex items-center gap-1.5 bg-white text-blue-700 font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 text-sm transition">Каталог <ArrowRight size={14} /></Link>
                  <Link to="/stores/partner-request" className="inline-flex items-center gap-1.5 border border-white/30 text-white px-4 py-2 rounded-lg hover:bg-white/10 text-sm transition"><Handshake size={14} /> Стать партнёром</Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 text-white p-7 flex flex-col">
              <div className="relative z-10 flex-1">
                <Hammer size={36} className="mb-3 opacity-80" />
                <h3 className="text-xl font-bold mb-2">{t('turnkey.title')}</h3>
                <p className="text-amber-100 mb-5 text-sm leading-relaxed">{t('turnkey.subtitle')}</p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/turnkey" className="inline-flex items-center gap-1.5 bg-white text-amber-700 font-semibold px-4 py-2 rounded-lg hover:bg-amber-50 text-sm transition">Оставить заявку <ArrowRight size={14} /></Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-700 text-white p-7 flex flex-col">
              <div className="relative z-10 flex-1">
                <Search size={36} className="mb-3 opacity-80" />
                <h3 className="text-xl font-bold mb-2">Выезд на оценку</h3>
                <p className="text-cyan-100 mb-5 text-sm leading-relaxed">Мастер приедет, сделает замеры и составит точную смету.</p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/estimation/create" className="inline-flex items-center gap-1.5 bg-white text-cyan-700 font-semibold px-4 py-2 rounded-lg hover:bg-cyan-50 text-sm transition">Заказать <ArrowRight size={14} /></Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-6 translate-x-6" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 4: Срочные заказы ═══ */}
      {urgentOrders.length > 0 && (
        <section className="py-10 md:py-14 bg-orange-50 dark:bg-orange-950/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2"><Zap size={24} className="text-orange-500" /> {t('home.urgentOrdersHome')}</h2>
              <Link to="/orders?urgent=true" className="text-orange-600 dark:text-orange-400 text-sm font-medium flex items-center gap-1 hover:text-orange-700">{t('home.viewAllUrgent')} <ArrowRight size={16} /></Link>
            </div>
            <p className="text-sm text-orange-600/70 dark:text-orange-400/70 mb-6">{t('home.urgentOrdersHomeDesc')}</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {urgentOrders.map((order) => (<OrderCard key={order.id} order={order} formatPrice={(price) => formatPrice(price)} />))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ БЛОК 5: Статистика ═══ */}
      <section className="py-10 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div><div className="text-3xl md:text-4xl font-extrabold"><AnimatedCounter end={stats.services} suffix="+" /></div><p className="text-primary-400 text-sm mt-1">{t('home.stat_services')}</p></div>
            <div><div className="text-3xl md:text-4xl font-extrabold"><AnimatedCounter end={stats.categories} suffix="+" /></div><p className="text-primary-400 text-sm mt-1">{t('home.stat_categories')}</p></div>
            <div><div className="text-3xl md:text-4xl font-extrabold"><AnimatedCounter end={stats.cities} /></div><p className="text-primary-400 text-sm mt-1">{t('home.stat_cities')}</p></div>
            <div><div className="text-3xl md:text-4xl font-extrabold"><AnimatedCounter end={stats.guarantee} /></div><p className="text-primary-400 text-sm mt-1">{t('home.stat_guarantee')}</p></div>
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 6: Топ-мастера ═══ */}
      {topMasters.length > 0 && (
        <section className="py-10 md:py-14 bg-gray-50 dark:bg-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold dark:text-white">{t('home.topMasters')}</h2>
              <Link to="/masters" className="text-primary-600 dark:text-primary-400 text-sm font-medium flex items-center gap-1 hover:text-primary-700">{t('home.viewAll')} <ArrowRight size={16} /></Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topMasters.map((master) => (<MasterCard key={master.id} master={master} />))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ БЛОК 7: Почему мы ═══ */}
      <section className="py-10 md:py-14 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 dark:text-white">{t('home.whyUs')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURE_KEYS.map((key, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={key} className="text-center p-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4"><Icon size={28} className="text-primary-600 dark:text-primary-400" /></div>
                  <h3 className="font-semibold mb-2 dark:text-white">{t(`home.feature_${key}_title`)}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t(`home.feature_${key}_desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 8: Как это работает ═══ */}
      <section className="py-10 md:py-14 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 dark:text-white">{t('home.howItWorks')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEP_KEYS.map((key, i) => (
              <div key={key} className="text-center">
                {(() => { const StepIcon = STEP_LUCIDE[i]; return <StepIcon size={36} className="mx-auto text-primary-500" />; })()}
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold mb-3">{i + 1}</div>
                <h3 className="font-semibold mb-2 dark:text-white">{t(`home.${key}_title`)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t(`home.${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ БЛОК 9: CTA для мастеров ═══ */}
      <section className="py-10 md:py-14 bg-gradient-to-r from-green-600 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Users size={48} className="mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('home.ctaMaster')}</h2>
          <p className="text-green-100 mb-6 max-w-2xl mx-auto">{t('home.ctaMasterDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/become-master" className="btn-primary bg-white text-green-700 hover:bg-gray-100 px-8 py-3">{t('home.startEarning')} <ArrowRight size={18} className="ml-2" /></Link>
            <Link to="/school" className="btn-secondary border-white/30 text-white hover:bg-white/10 px-8 py-3"><GraduationCap size={18} className="mr-2" /> {t('home.mastersSchool')}</Link>
          </div>
        </div>
      </section>

      {/* Помощь */}
      <section className="py-8 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <HelpCircle size={24} className="text-primary-600 dark:text-primary-400" />
            <p className="text-gray-600 dark:text-gray-400">{t('support.needHelp')}</p>
            <Link to="/support" className="btn-secondary dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 text-sm px-6 py-2">{t('support.title')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
