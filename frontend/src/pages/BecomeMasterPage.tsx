// ============================================
// MasterUz — Become Master Page (single-step)
// Один экран: личные данные + категории работ.
// Заказы по выбранным категориям будут приходить мастеру алертом.
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import {
  ArrowLeft, Wrench, Star, DollarSign, BookOpen,
  Shield, CheckCircle, ChevronRight, Layers, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';

const CITY_KEYS = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus', 'Karshi'] as const;

// Достаёт читаемое сообщение об ошибке из axios-ответа сервера.
// Бекенд возвращает { success, error: { message, statusCode } }.
const extractErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

export function BecomeMasterPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { t, language } = useTranslation();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    bio: '',
    experience: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Категории и подкатегории
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Если мастер уже зарегистрирован — перенаправляем на dashboard
  const alreadyMaster = user?.role === 'MASTER';

  useEffect(() => {
    if (alreadyMaster) {
      navigate('/dashboard', { replace: true });
    }
  }, [alreadyMaster, navigate]);

  // Подгружаем существующие данные профиля
  useEffect(() => {
    async function loadExistingProfile() {
      try {
        const res = await usersApi.getProfile();
        const data = res.data.data;
        if (data?.profile) {
          setForm((prev) => ({
            ...prev,
            firstName: data.profile.firstName || '',
            lastName: data.profile.lastName || '',
            phone: data.phone || '',
            city: data.profile.city || '',
            bio: data.profile.bio || '',
          }));
        }
      } catch {
        // Профиль может ещё не существовать — нормально
      }
    }
    if (user) loadExistingProfile();
  }, [user]);

  // Загрузка категорий сразу при открытии страницы
  useEffect(() => {
    async function loadCategories() {
      setLoadingCategories(true);
      try {
        const res = await catalogApi.getCategories();
        setCategories((res.data.data || []).filter((c: any) => c.parentId));
      } catch (err) {
        toast.error(extractErrorMessage(err, t('common.error')));
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    const cat = categories.find((c) => c.id === categoryId);
    const subIds = (cat?.subcategories || []).map((s: any) => s.id);
    setSelectedSubcategoryIds((prev) => {
      const alreadyAll = subIds.every((id: string) => prev.includes(id));
      if (alreadyAll) {
        return prev.filter((id) => !subIds.includes(id));
      } else {
        return [...new Set([...prev, ...subIds])];
      }
    });
  }

  function toggleSubcategory(subcategoryId: string, categoryId: string) {
    setSelectedSubcategoryIds((prev) =>
      prev.includes(subcategoryId)
        ? prev.filter((id) => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
    if (!selectedCategoryIds.includes(categoryId)) {
      setSelectedCategoryIds((prev) => [...prev, categoryId]);
    }
  }

  function toggleExpandCategory(categoryId: string) {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function getCategoryName(cat: any) {
    if (language === 'uz' && cat.nameUz) return cat.nameUz;
    if (language === 'en' && cat.nameEn) return cat.nameEn;
    return cat.name;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.firstName.trim()) {
      toast.error(t('settings.firstNameRequired'));
      return;
    }

    if (selectedCategoryIds.length === 0) {
      toast.error(t('becomeMasterPage.selectAtLeastOne'));
      return;
    }

    setSubmitting(true);
    try {
      // 1. Сохраняем личные данные
      await usersApi.updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        city: form.city || undefined,
        bio: form.bio.trim() || undefined,
      });

      // 2. Создаём мастер-профиль сразу с категориями.
      //    Если профиль уже существует (повторная попытка) — просто обновляем категории.
      try {
        await usersApi.createMasterProfile({
          specializations: ['general'],
          experienceYears: form.experience ? Number(form.experience) : undefined,
          categoryIds: selectedCategoryIds,
        });
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          // Профиль уже есть — просто перезаписываем категории
          await usersApi.updateMasterCategories(selectedCategoryIds);
        } else {
          throw err;
        }
      }

      // 3. Обновляем локальную роль
      if (user) {
        const state = useAuthStore.getState();
        setAuth(
          { ...user, role: 'MASTER' as any } as any,
          state.accessToken!,
          state.refreshToken!
        );
      }

      toast.success(t('becomeMasterPage.profileCreated'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(extractErrorMessage(error, t('common.error')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title">{t('becomeMasterPage.title')}</h1>

      {/* Преимущества */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center">
          <DollarSign size={28} className="mx-auto text-green-500 mb-2" />
          <h3 className="font-semibold text-sm dark:text-white">{t('becomeMasterPage.income')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('becomeMasterPage.incomeDesc')}</p>
        </div>
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center">
          <Star size={28} className="mx-auto text-yellow-500 mb-2" />
          <h3 className="font-semibold text-sm dark:text-white">{t('becomeMasterPage.ratingTitle')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('becomeMasterPage.ratingDesc')}</p>
        </div>
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center">
          <Wrench size={28} className="mx-auto text-blue-500 mb-2" />
          <h3 className="font-semibold text-sm dark:text-white">{t('becomeMasterPage.ordersTitle')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('becomeMasterPage.ordersDesc')}</p>
        </div>
        <div className="card dark:bg-gray-800 dark:ring-gray-700 text-center">
          <BookOpen size={28} className="mx-auto text-purple-500 mb-2" />
          <h3 className="font-semibold text-sm dark:text-white">{t('becomeMasterPage.trainingTitle')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('becomeMasterPage.trainingDesc')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Секция: Личные данные */}
        <div className="card dark:bg-gray-800 dark:ring-gray-700">
          <h2 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
            <User size={18} className="text-primary-600 dark:text-primary-400" />
            {t('settings.personalInfo')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('settings.firstName')} *
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('settings.lastName')}
              </label>
              <input
                type="text"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('settings.phone')}
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input"
                placeholder="+998 90 123-45-67"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('settings.city')}
              </label>
              <select
                name="city"
                value={form.city}
                onChange={handleChange}
                className="input"
              >
                <option value="">{t('createOrder.selectCity')}</option>
                {CITY_KEYS.map((city) => (
                  <option key={city} value={city}>{t(`cities.${city}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('becomeMasterPage.aboutYou')}
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              className="input min-h-[80px] resize-y"
              rows={3}
              placeholder={t('becomeMasterPage.aboutPlaceholder')}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('becomeMasterPage.experienceYears')}
            </label>
            <input
              type="number"
              name="experience"
              value={form.experience}
              onChange={handleChange}
              className="input"
              placeholder={t('becomeMasterPage.experiencePlaceholder')}
              min={0}
              max={50}
            />
          </div>
        </div>

        {/* Секция: Категории работ */}
        <div className="card dark:bg-gray-800 dark:ring-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={20} className="text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('becomeMasterPage.chooseCategoriesTitle')}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('becomeMasterPage.chooseCategoriesDesc')}
          </p>

          {loadingCategories ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const isCatSelected = selectedCategoryIds.includes(cat.id);
                const isExpanded = expandedCategories.includes(cat.id);
                const subcategories = cat.subcategories || [];
                const selectedSubsCount = subcategories.filter((s: any) => selectedSubcategoryIds.includes(s.id)).length;
                return (
                  <div key={cat.id} className={`rounded-xl border-2 transition-all ${
                    isCatSelected
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10 dark:border-primary-500'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}>
                    <div className="flex items-center gap-3 p-3.5">
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`w-5 h-5 rounded shrink-0 flex items-center justify-center border-2 transition-colors ${
                          isCatSelected
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isCatSelected && <CheckCircle size={14} className="text-white" />}
                      </button>
                      <span className="text-2xl shrink-0">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${
                          isCatSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {getCategoryName(cat)}
                        </p>
                        {subcategories.length > 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {selectedSubsCount}/{subcategories.length} {t('becomeMasterPage.subcategories')}
                          </p>
                        )}
                      </div>
                      {subcategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandCategory(cat.id)}
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>

                    {isExpanded && subcategories.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-3.5 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {subcategories.map((sub: any) => {
                          const isSubSelected = selectedSubcategoryIds.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleSubcategory(sub.id, cat.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                                isSubSelected
                                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                                isSubSelected
                                  ? 'bg-primary-600 border-primary-600'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSubSelected && <CheckCircle size={10} className="text-white" />}
                              </div>
                              {sub.nameUz && language === 'uz' ? sub.nameUz : sub.nameEn && language === 'en' ? sub.nameEn : sub.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedCategoryIds.length > 0 && (
            <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-sm text-primary-700 dark:text-primary-400 text-center font-medium">
              {t('becomeMasterPage.selectedCount')}: {selectedCategoryIds.length} {t('becomeMasterPage.step2').toLowerCase()}, {selectedSubcategoryIds.length} {t('becomeMasterPage.subcategories')}
            </div>
          )}

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-sm text-blue-800 dark:text-blue-300">
            <Shield size={16} className="inline mr-2" />
            {t('becomeMasterPage.categoriesNote')}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || selectedCategoryIds.length === 0}
          className="btn-primary w-full py-3 text-lg disabled:opacity-50"
        >
          {submitting ? t('becomeMasterPage.submitting') : (
            <>
              <ChevronRight size={20} className="mr-2" />
              {t('becomeMasterPage.submit')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
