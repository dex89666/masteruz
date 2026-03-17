// ============================================
// MasterUz — Become Master Page (2-step)
// Шаг 1: Заполнение профиля
// Шаг 2: Выбор категорий услуг (чекбоксы)
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import {
  ArrowLeft, Wrench, Star, DollarSign, BookOpen,
  Shield, CheckCircle, ChevronRight, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';

export function BecomeMasterPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { t, language } = useTranslation();
  const [form, setForm] = useState({
    experience: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Категории и подкатегории
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);

  // Если мастер уже зарегистрирован — перенаправляем
  const alreadyMaster = user?.role === 'MASTER';

  useEffect(() => {
    if (alreadyMaster) {
      navigate('/dashboard', { replace: true });
    }
  }, [alreadyMaster, navigate]);

  const currentStep = step;

  // Загрузка категорий при переходе на шаг 2
  useEffect(() => {
    if (currentStep === 2 && categories.length === 0) {
      loadCategories();
    }
  }, [currentStep]);

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const res = await catalogApi.getCategories();
      setCategories(res.data.data || []);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoadingCategories(false);
    }
  }

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    // Также выбираем/убираем все подкатегории этой категории
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
    // Автоматически добавляем родительскую категорию
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    try {
      await usersApi.createMasterProfile({
        specializations: ['general'],
        bio: '',
        experienceYears: form.experience ? Number(form.experience) : undefined,
      });

      // Update local user state
      if (user) {
        const state = useAuthStore.getState();
        setAuth(
          { ...user, role: 'MASTER' as any } as any,
          state.accessToken!,
          state.refreshToken!
        );
      }

      toast.success(t('becomeMasterPage.profileCreated'));
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitCategories() {
    if (selectedCategoryIds.length === 0 && selectedSubcategoryIds.length === 0) {
      toast.error(t('becomeMasterPage.selectAtLeastOne'));
      return;
    }

    setSavingCategories(true);
    try {
      await usersApi.updateMasterCategories(selectedCategoryIds);
      toast.success(t('becomeMasterPage.categoriesSaved'));
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSavingCategories(false);
    }
  }

  return (
    <div className="page-container pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title">{t('becomeMasterPage.title')}</h1>

      {/* Step indicator — 2 шага */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[
          { num: 1, label: t('becomeMasterPage.step1') },
          { num: 2, label: t('becomeMasterPage.step2') },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 shrink-0">
            {i > 0 && <div className="w-6 h-0.5 bg-gray-200 dark:bg-gray-700" />}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              currentStep > s.num
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : currentStep === s.num
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
            }`}>
              {currentStep > s.num ? (
                <CheckCircle size={14} />
              ) : (
                <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center ${
                  currentStep === s.num ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}>{s.num}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Benefits */}
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

      {/* ── Step 1: Profile Form ── */}
      {currentStep === 1 && (
        <form onSubmit={handleSubmitProfile} className="space-y-4">
          <div>
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

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-lg"
          >
            {submitting ? t('becomeMasterPage.submitting') : (
              <>
                <ChevronRight size={20} className="mr-2" />
                {t('becomeMasterPage.nextStep')}
              </>
            )}
          </button>
        </form>
      )}

      {/* ── Step 2: Choose Categories & Subcategories ── */}
      {currentStep === 2 && (
        <div className="space-y-5">
          {/* Success banner for step 1 */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={24} className="text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                {t('becomeMasterPage.step1')} ✅
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {t('becomeMasterPage.profileCreated')}
              </p>
            </div>
          </div>

          {/* Category + subcategory selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={20} className="text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('becomeMasterPage.chooseCategoriesTitle')}
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Выберите категории и конкретные подкатегории, в которых вы работаете
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
                      {/* Category header */}
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
                              {selectedSubsCount}/{subcategories.length} подкатегорий
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

                      {/* Subcategories (expandable) */}
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

            {/* Selection counter */}
            {(selectedCategoryIds.length > 0 || selectedSubcategoryIds.length > 0) && (
              <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-sm text-primary-700 dark:text-primary-400 text-center font-medium">
                Выбрано: {selectedCategoryIds.length} категорий, {selectedSubcategoryIds.length} подкатегорий
              </div>
            )}

            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300">
              <Shield size={16} className="inline mr-2" />
              {t('becomeMasterPage.categoriesNote')}
            </div>
          </div>

          <button
            onClick={handleSubmitCategories}
            disabled={savingCategories || selectedCategoryIds.length === 0}
            className="btn-primary w-full py-3 text-lg disabled:opacity-50"
          >
            {savingCategories ? t('common.saving') : (
              <>
                <ChevronRight size={20} className="mr-2" />
                {t('becomeMasterPage.nextStep')} ({selectedCategoryIds.length})
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
