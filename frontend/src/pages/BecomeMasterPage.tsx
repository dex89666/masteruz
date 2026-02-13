// ============================================
// MasterUz — Become Master Page (3-step)
// Шаг 1: Заполнение профиля
// Шаг 2: Выбор категорий услуг (чекбоксы)
// Шаг 3: Оплата регистрационного взноса 400 000 сум
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import { RegistrationPaymentModal } from '../components/RegistrationPaymentModal';
import {
  ArrowLeft, Wrench, Star, DollarSign, BookOpen,
  Shield, CheckCircle, CreditCard, ChevronRight, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';

export function BecomeMasterPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const { t, language } = useTranslation();
  const [form, setForm] = useState({
    bio: '',
    experience: '',
    hourlyRate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Категории
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);

  // Если у пользователя уже есть masterProfile но нет регистрации — сразу step 3
  const alreadyMaster = user?.role === 'MASTER';
  const registrationPaid = user?.masterProfile?.registrationPaid;

  // Если мастер уже зарегистрирован и оплачен — перенаправляем
  if (alreadyMaster && registrationPaid) {
    navigate('/master/dashboard');
    return null;
  }

  // Если мастер зарегистрирован но не оплачен — показать step 3
  const currentStep = alreadyMaster && !registrationPaid ? 3 : step;

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
    if (!form.bio.trim()) {
      toast.error(t('becomeMasterPage.tellAboutYourself'));
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.createMasterProfile({
        specializations: ['general'],
        bio: form.bio,
        experienceYears: form.experience ? Number(form.experience) : undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
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
    if (selectedCategoryIds.length === 0) {
      toast.error(t('becomeMasterPage.selectAtLeastOne'));
      return;
    }

    setSavingCategories(true);
    try {
      await usersApi.updateMasterCategories(selectedCategoryIds);
      toast.success(t('becomeMasterPage.categoriesSaved'));
      setStep(3);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSavingCategories(false);
    }
  }

  function handlePaymentSuccess() {
    if (user) {
      const state = useAuthStore.getState();
      const updatedUser = {
        ...user,
        masterProfile: user.masterProfile
          ? { ...user.masterProfile, registrationPaid: true }
          : null,
      };
      setAuth(updatedUser as any, state.accessToken!, state.refreshToken!);
    }
    toast.success(t('becomeMasterPage.regFeeSuccess'));
    navigate('/school');
  }

  return (
    <div className="page-container pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title">{t('becomeMasterPage.title')}</h1>

      {/* Step indicator — 3 шага */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[
          { num: 1, label: t('becomeMasterPage.step1') },
          { num: 2, label: t('becomeMasterPage.step2') },
          { num: 3, label: t('becomeMasterPage.step3') },
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
              {t('becomeMasterPage.aboutYou')}
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              className="textarea"
              rows={4}
              placeholder={t('becomeMasterPage.aboutPlaceholder')}
              maxLength={1000}
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('becomeMasterPage.hourlyRate')}
            </label>
            <input
              type="number"
              name="hourlyRate"
              value={form.hourlyRate}
              onChange={handleChange}
              className="input"
              placeholder={t('becomeMasterPage.hourlyRatePlaceholder')}
              min={0}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-800 dark:text-blue-300">
            <BookOpen size={16} className="inline mr-2" />
            {t('becomeMasterPage.schoolNote')}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={18} className="text-amber-600 dark:text-amber-400" />
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                {t('becomeMasterPage.regFeeTitle')}: {t('becomeMasterPage.regFeeAmount')}
              </p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('becomeMasterPage.regFeeDesc')}
            </p>
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

      {/* ── Step 2: Choose Categories ── */}
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

          {/* Category selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
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
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  const subcCount = cat._count?.subcategories || cat.subcategories?.length || 0;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500 ring-1 ring-primary-200 dark:ring-primary-800'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded shrink-0 flex items-center justify-center border-2 transition-colors ${
                        isSelected
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && <CheckCircle size={14} className="text-white" />}
                      </div>

                      {/* Icon */}
                      <span className="text-2xl shrink-0">{cat.icon}</span>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${
                          isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {getCategoryName(cat)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {subcCount} {t('becomeMasterPage.subcategories')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selection counter */}
            {selectedCategoryIds.length > 0 && (
              <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-sm text-primary-700 dark:text-primary-400 text-center font-medium">
                {t('becomeMasterPage.selectedCount')}: {selectedCategoryIds.length} {t('becomeMasterPage.ofCategories')} {categories.length}
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

      {/* ── Step 3: Registration Fee Payment ── */}
      {currentStep === 3 && (
        <div className="space-y-5">
          {/* Success banners for steps 1 & 2 */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle size={24} className="text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
                {t('becomeMasterPage.step1')} ✅ · {t('becomeMasterPage.step2')} ✅
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {t('becomeMasterPage.stepsCompleted')}
              </p>
            </div>
          </div>

          {/* Registration fee card */}
          <div className="card dark:bg-gray-800 dark:ring-gray-700 p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {t('becomeMasterPage.regFeeTitle')}
            </h2>
            <p className="text-3xl font-extrabold text-green-600 dark:text-green-400 mb-3">
              {t('becomeMasterPage.regFeeAmount')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
              {t('becomeMasterPage.regFeeDesc')}
            </p>

            {/* Why needed */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">
                {t('becomeMasterPage.regFeeWhy')}
              </p>
              <ul className="space-y-2 text-xs text-amber-700 dark:text-amber-400">
                <li className="flex items-center gap-2">✅ {t('becomeMasterPage.regFeeReason1')}</li>
                <li className="flex items-center gap-2">🛡️ {t('becomeMasterPage.regFeeReason2')}</li>
                <li className="flex items-center gap-2">⭐ {t('becomeMasterPage.regFeeReason3')}</li>
                <li className="flex items-center gap-2">💰 {t('becomeMasterPage.regFeeReason4')}</li>
              </ul>
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn-primary w-full py-3.5 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200 dark:shadow-green-900/30"
            >
              <CreditCard size={20} className="mr-2" />
              {t('becomeMasterPage.regFeePayBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <RegistrationPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
