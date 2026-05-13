// ============================================
// MasterUz — Create Order Page (Wizard i18n)
// 4 шага: Категория → Подкатегория → Задачи → Детали
// ============================================

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ordersApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import { useGeolocation, useTelegram } from '../hooks';
import { useTranslation } from '../i18n';
import { PromoCodeInput } from '../components/PromoCodeInput';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Send,
  Image as ImageIcon,
  X,
  Clock,
  CheckSquare,
  ChevronRight,
  Zap,
  Shield,
  Check,
  Sparkles,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Task } from '../types';
import { UZBEKISTAN_REGIONS, getDistrictsForCity, getRegionByCity, getLocalizedRegionName } from '../data/regions';
import { CameraCapture } from '../components/CameraCapture';

type WizardStep = 1 | 2 | 3 | 4;

/** Возвращает локализованное имя объекта */
function useLocalizedName() {
  const { language } = useTranslation();
  return (item: { name: string; nameUz?: string | null; nameEn?: string | null }) => {
    if (language === 'uz' && item.nameUz) return item.nameUz;
    if (language === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  };
}

function useLocalizedDesc() {
  const { language } = useTranslation();
  return (item: { description?: string | null; descriptionUz?: string | null; descriptionEn?: string | null }) => {
    if (language === 'uz' && item.descriptionUz) return item.descriptionUz;
    if (language === 'en' && item.descriptionEn) return item.descriptionEn;
    return item.description ?? '';
  };
}

function useLocalizedTime() {
  const { language } = useTranslation();
  return (item: { estimatedTime?: string | null; estimatedTimeUz?: string | null; estimatedTimeEn?: string | null }) => {
    if (language === 'uz' && item.estimatedTimeUz) return item.estimatedTimeUz;
    if (language === 'en' && item.estimatedTimeEn) return item.estimatedTimeEn;
    return item.estimatedTime ?? '';
  };
}

// ─── Stepper Component ─────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step === current
                ? 'bg-primary-600 text-white scale-110'
                : step < current
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {step < current ? <Check size={14} /> : step}
          </div>
          {step < total && (
            <div
              className={`w-8 h-0.5 mx-1 ${step < current ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { location, requestLocation } = useGeolocation();
  const { t, language } = useTranslation();
  const getLocalName = useLocalizedName();
  const getLocalDesc = useLocalizedDesc();
  const getLocalTime = useLocalizedTime();
  const { hapticImpact, hapticNotification } = useTelegram();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Selected state
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Form state (step 4)
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    priceMax: '',
    city: '',
    district: '',
    street: '',
    address: '',
    deadline: '',
  });
  const [isUrgent, setIsUrgent] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [_appliedPromo, setAppliedPromo] = useState<any>(null);

  // Redirect unauthenticated
  useEffect(() => {
    if (!user) {
      toast.error(t('createOrder.loginRequired'));
      navigate('/login');
    }
  }, [user]);

  // Load full catalog
  useEffect(() => {
    catalogApi
      .getFullCatalog()
      .then((res) => setCatalog(res.data.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoadingCatalog(false));
  }, []);

  // Available tasks for selected subcategory
  const availableTasks = useMemo<Task[]>(() => {
    if (!selectedSubcategory) return [];
    return selectedSubcategory.tasks ?? [];
  }, [selectedSubcategory]);

  // Selected tasks details
  const selectedTasksList = useMemo(() => {
    return availableTasks.filter((t: Task) => selectedTaskIds.has(t.id));
  }, [availableTasks, selectedTaskIds]);

  // ─── Price calculation ────────────────────
  const VISIT_FEE = 100000; // 100 000 сум — стоимость выезда

  const totalMinPrice = useMemo(() => {
    return selectedTasksList.reduce(
      (sum: number, t: Task) => sum + (t.minPrice ?? 0),
      0
    );
  }, [selectedTasksList]);

  const minimumOrderPrice = totalMinPrice + VISIT_FEE;

  /** Форматирование цены */
  const fmtPrice = (n: number) => n.toLocaleString('ru-RU');

  // Auto-generate title & description from selected tasks
  useEffect(() => {
    if (selectedTasksList.length > 0 && step === 4) {
      const taskNames = selectedTasksList.map((t: Task) => getLocalName(t));
      if (!form.title) {
        setForm((f) => ({
          ...f,
          title: taskNames.slice(0, 3).join(', '),
        }));
      }
      if (!form.description) {
        const descs = selectedTasksList
          .map((t: Task) => `• ${getLocalName(t)}: ${getLocalDesc(t)}`)
          .join('\n');
        setForm((f) => ({ ...f, description: descs }));
      }
    }
  }, [step]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) {
      toast.error(t('createOrder.maxPhotos'));
      return;
    }
    setImages([...images, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  }

  function toggleTask(taskId: string) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function selectCategory(cat: any) {
    hapticImpact?.('light');
    setSelectedCategory(cat);
    setSelectedSubcategory(null);
    setSelectedTaskIds(new Set());
    setStep(2);
  }

  function selectSubcategory(sub: any) {
    hapticImpact?.('light');
    setSelectedSubcategory(sub);
    setSelectedTaskIds(new Set());
    setStep(3);
  }

  function goToDetails() {
    hapticImpact?.('medium');
    setForm({ title: '', description: '', price: '', priceMax: '', city: '', district: '', street: '', address: '', deadline: '' });
    setIsUrgent(false);
    setStep(4);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.description.trim()) {
      toast.error(t('createOrder.enterDesc'));
      return;
    }
    if (!form.price) {
      toast.error(t('createOrder.enterBudget'));
      return;
    }

    if (selectedTaskIds.size > 0 && Number(form.price) < minimumOrderPrice) {
      toast.error(`${t('pricing.priceTooLow')} ${fmtPrice(minimumOrderPrice)} ${t('pricing.currency')}`);
      return;
    }

    if (!offerAccepted) {
      toast.error(t('antiFraud.offerAcceptRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title || selectedTasksList.map((t: Task) => getLocalName(t)).join(', '),
        description: form.description,
        categoryId: selectedCategory.id,
        price: Number(form.price),
        taskIds: Array.from(selectedTaskIds),
        isUrgent,
        offerAccepted,
        city: form.city || undefined,
        district: form.district || undefined,
        street: form.street || undefined,
        address: form.address || undefined,
        region: form.city ? getRegionByCity(form.city)?.nameRu : undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
      };

      if (form.priceMax) {
        payload.priceMax = Number(form.priceMax);
      }

      if (location) {
        payload.latitude = location.latitude;
        payload.longitude = location.longitude;
      }

      const response = await ordersApi.create(payload);
      hapticNotification?.('success');
      toast.success(t('createOrder.orderCreated'));
      navigate(`/orders/${response.data.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('createOrder.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCatalog) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="page-container pb-20">
      {/* Header */}
      <button
        onClick={() => {
          if (step === 1) navigate(-1);
          else setStep((s) => (s - 1) as WizardStep);
        }}
        className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4"
      >
        <ArrowLeft size={18} className="mr-1" />
        {step === 1 ? t('common.back') : t('createOrder.prevStep')}
      </button>

      <h1 className="page-title">{t('createOrder.title')}</h1>

      {/* ─── Перекрёстная ссылка на AI-режим ─── */}
      <Link
        to="/instant-order"
        className="inline-flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-medium transition-colors min-h-[36px]"
      >
        <Sparkles size={16} /> Не уверены? Сделайте фото — AI подберёт варианты
      </Link>

      <StepIndicator current={step} total={4} />

      {/* ═══ STEP 1: Category Selection ═══ */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t('createOrder.step1Category')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {catalog.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat)}
                className="card dark:bg-gray-800 dark:ring-gray-700 text-center hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:-translate-y-0.5 p-4 border-2 border-transparent"
              >
                <span className="text-3xl mb-2 block">{cat.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                  {getLocalName(cat)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
                  {cat.subcategories?.length ?? cat._count?.subcategories ?? 0} →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Subcategory Selection ═══ */}
      {step === 2 && selectedCategory && (
        <div>
          <div className="mb-4 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-sm">
            <span className="font-medium text-primary-700 dark:text-primary-300">
              {t('createOrder.selectedCategory')}: {selectedCategory.icon} {getLocalName(selectedCategory)}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t('createOrder.step2Subcategory')}
          </h2>
          {selectedCategory.subcategories?.length > 0 ? (
            <div className="space-y-2">
              {selectedCategory.subcategories.map((sub: any) => (
                <button
                  key={sub.id}
                  onClick={() => selectSubcategory(sub)}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{sub.icon}</span>
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-200 block">
                        {getLocalName(sub)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {sub.tasks?.length ?? sub._count?.tasks ?? 0} {t('createOrder.selectedTasks').toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('createOrder.noSubcategories')}</p>
          )}
        </div>
      )}

      {/* ═══ STEP 3: Task Selection (checkboxes) ═══ */}
      {step === 3 && selectedSubcategory && (
        <div>
          <div className="mb-4 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-sm space-y-1">
            <p className="font-medium text-primary-700 dark:text-primary-300">
              {selectedCategory.icon} {getLocalName(selectedCategory)} → {selectedSubcategory.icon} {getLocalName(selectedSubcategory)}
            </p>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {t('createOrder.step3Tasks')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('createOrder.selectTasks')} ({t('createOrder.selectedTasks')}: {selectedTaskIds.size})
          </p>

          {availableTasks.length > 0 ? (
            <div className="space-y-2">
              {availableTasks.map((task: Task) => {
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-200 dark:hover:border-primary-600'
                    }`}
                  >
                    <CheckSquare
                      size={22}
                      className={`mt-0.5 flex-shrink-0 ${
                        isSelected ? 'text-primary-600' : 'text-gray-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-200 leading-snug">
                        {getLocalName(task)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {getLocalDesc(task)}
                      </p>
                      {task.estimatedTime && (
                        <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
                          <Clock size={12} />
                          {t('createOrder.estimatedTime')}: {getLocalTime(task)}
                        </p>
                      )}
                    </div>
                    {task.minPrice != null && task.minPrice > 0 && (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-lg whitespace-nowrap self-center">
                        {t('pricing.from')} {fmtPrice(task.minPrice)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('createOrder.noTasks')}</p>
          )}

          {/* Price summary + Next button */}
          <div className="sticky bottom-4 mt-6 space-y-2">
            {selectedTaskIds.size > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-xl p-3 shadow-sm text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t('pricing.workTotal')}:</span>
                  <span className="font-medium">{fmtPrice(totalMinPrice)} {t('pricing.currency')}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 mt-1">
                  <span>{t('pricing.visitFee')}:</span>
                  <span className="font-medium">{fmtPrice(VISIT_FEE)} {t('pricing.currency')}</span>
                </div>
                <div className="border-t dark:border-gray-700 mt-2 pt-2 flex justify-between text-primary-700 dark:text-primary-400 font-bold">
                  <span>{t('pricing.minOrderPrice')}:</span>
                  <span>{fmtPrice(minimumOrderPrice)} {t('pricing.currency')}</span>
                </div>
              </div>
            )}
            <button
              onClick={goToDetails}
              disabled={selectedTaskIds.size === 0}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('createOrder.nextStep')}
              <ArrowRight size={18} className="ml-2" />
              {selectedTaskIds.size > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {selectedTaskIds.size}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Details Form ═══ */}
      {step === 4 && (
        <div>
          {/* Summary badges */}
          <div className="mb-4 px-3 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-sm space-y-1">
            <p className="font-medium text-primary-700 dark:text-primary-300">
              {selectedCategory?.icon} {getLocalName(selectedCategory!)} → {selectedSubcategory?.icon} {getLocalName(selectedSubcategory!)}
            </p>
            <p className="text-primary-600 dark:text-primary-400">
              {t('createOrder.selectedTasks')}: {selectedTaskIds.size}
            </p>
          </div>

          {/* Selected tasks summary with prices */}
          {selectedTasksList.length > 0 && (
            <div className="mb-4 space-y-1">
              {selectedTasksList.map((task: Task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg"
                >
                  <span className="text-green-600"><Check size={14} className="inline" /></span>
                  <span className="flex-1">{getLocalName(task)}</span>
                  {task.minPrice != null && task.minPrice > 0 && (
                    <span className="text-xs font-medium text-green-700">
                      {fmtPrice(task.minPrice)} {t('pricing.currency')}
                    </span>
                  )}
                </div>
              ))}
              {/* Price breakdown */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm mt-2">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t('pricing.workTotal')}:</span>
                  <span className="font-medium">{fmtPrice(totalMinPrice)} {t('pricing.currency')}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400 mt-1">
                  <span>{t('pricing.visitFee')}:</span>
                  <span className="font-medium">{fmtPrice(VISIT_FEE)} {t('pricing.currency')}</span>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-800 mt-2 pt-2 flex justify-between text-blue-800 dark:text-blue-300 font-bold">
                  <span>{t('pricing.minOrderPrice')}:</span>
                  <span>{fmtPrice(minimumOrderPrice)} {t('pricing.currency')}</span>
                </div>
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t('createOrder.step4Details')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Срочный заказ */}
            <div className={`rounded-xl border-2 p-4 transition-all ${
              isUrgent
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setIsUrgent(!isUrgent);
                  hapticImpact?.('medium');
                }}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isUrgent ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                  }`}>
                    <Zap size={20} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${isUrgent ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t('createOrder.urgentOrder')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('createOrder.urgentDesc')}
                    </p>
                  </div>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors relative ${
                  isUrgent ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                    isUrgent ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </div>
              </button>
              {isUrgent && (
                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
                  <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">
                    {t('createOrder.urgentPriceNote')}
                  </p>
                </div>
              )}
            </div>

            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.orderTitle')}
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="input"
                placeholder={t('createOrder.titlePlaceholder')}
                maxLength={200}
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.description')}
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="textarea"
                rows={5}
                placeholder={t('createOrder.descPlaceholder')}
                maxLength={2000}
              />
              <p className="text-xs text-gray-400 mt-1">{form.description.length}/2000</p>
            </div>

            {/* Бюджет */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('createOrder.budgetFrom')}
                </label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  className="input"
                  placeholder={fmtPrice(minimumOrderPrice)}
                  min={minimumOrderPrice}
                />
                {form.price && Number(form.price) < minimumOrderPrice && (
                  <p className="text-xs text-red-500 mt-1">
                    {t('pricing.priceTooLow')} {fmtPrice(minimumOrderPrice)} {t('pricing.currency')}
                  </p>
                )}
                {selectedTaskIds.size > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {t('pricing.minimum')}: {fmtPrice(minimumOrderPrice)} {t('pricing.currency')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('createOrder.budgetTo')}
                </label>
                <input
                  type="number"
                  name="priceMax"
                  value={form.priceMax}
                  onChange={handleChange}
                  className="input"
                  placeholder="200 000"
                  min={0}
                />
              </div>
            </div>

            {/* Город и район */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.city')}
              </label>
              <select
                name="city"
                value={form.city}
                onChange={(e) => {
                  const city = e.target.value;
                  setForm((f) => ({ ...f, city, district: '' }));
                }}
                className="input"
              >
                <option value="">{t('createOrder.selectCity')}</option>
                {UZBEKISTAN_REGIONS.map((region) =>
                  region.cities.map((city) => (
                    <option key={city.key} value={city.key}>
                      {getLocalizedRegionName(city, language)} ({getLocalizedRegionName(region, language)})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Район (динамический по городу) */}
            {form.city && getDistrictsForCity(form.city).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('createOrder.district')}
                </label>
                <select
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">{t('createOrder.selectDistrict')}</option>
                  {getDistrictsForCity(form.city).map((d) => (
                    <option key={d.key} value={d.nameRu}>
                      {getLocalizedRegionName(d, language)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Улица */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.street')}
              </label>
              <input
                type="text"
                name="street"
                value={form.street}
                onChange={handleChange}
                className="input"
                placeholder={t('createOrder.streetPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.address')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className="input flex-1"
                  placeholder={t('createOrder.addressPlaceholder')}
                />
                <button
                  type="button"
                  onClick={requestLocation}
                  className="btn-secondary whitespace-nowrap"
                >
                  <MapPin size={16} className="mr-1" />
                  GPS
                </button>
              </div>
              {location && (
                <p className="text-xs text-green-600 mt-1">
                  {t('createOrder.coordsDetermined')} {location.latitude.toFixed(4)},{' '}
                  {location.longitude.toFixed(4)}
                </p>
              )}
            </div>

            {/* Дедлайн */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.deadline')}
              </label>
              <input
                type="date"
                name="deadline"
                value={form.deadline}
                onChange={handleChange}
                className="input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Фотографии */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('createOrder.photos')}
              </label>
              <div className="flex flex-wrap gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <>
                    <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors gap-0.5">
                      <ImageIcon size={20} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400">Галерея</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImages}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors gap-0.5"
                    >
                      <Camera size={20} className="text-orange-500" />
                      <span className="text-[10px] text-orange-500">Камера</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Промокод */}
            <PromoCodeInput
              orderPrice={Number(form.price) || 0}
              onApplied={(promo) => setAppliedPromo(promo)}
            />

            {/* Эскроу информация */}
            {Number(form.price) > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={16} className="text-blue-500 dark:text-blue-400" />
                  <span className="font-semibold text-blue-800 dark:text-blue-300">{t('antiFraud.escrowHeld')}</span>
                </div>
                <p className="text-blue-600 dark:text-blue-400 text-xs">{t('antiFraud.escrowInfo')}</p>
              </div>
            )}

            {/* Принятие оферты */}
            <label className="flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer select-none
              ${offerAccepted
                ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }">
              <input
                type="checkbox"
                checked={offerAccepted}
                onChange={(e) => setOfferAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className={`text-sm font-medium ${
                  offerAccepted ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {t('antiFraud.offerAcceptLabel')}
                </p>
                <a href="/about#offer" target="_blank" className="text-xs text-primary-500 hover:underline">
                  {t('antiFraud.offerLink')} →
                </a>
              </div>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 text-lg rounded-xl font-bold transition-all ${
                isUrgent
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/30'
                  : 'btn-primary'
              }`}
            >
              {submitting ? (
                t('createOrder.creating')
              ) : (
                <>
                  {isUrgent ? <Zap size={20} className="mr-2 inline" /> : <Send size={20} className="mr-2 inline" />}
                  {isUrgent ? t('createOrder.publishUrgent') : t('createOrder.publish')}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            if (images.length >= 5) {
              toast.error(t('createOrder.maxPhotos'));
              return;
            }
            setImages((prev) => [...prev, file]);
            const reader = new FileReader();
            reader.onload = (e) => setPreviews((prev) => [...prev, e.target?.result as string]);
            reader.readAsDataURL(file);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
