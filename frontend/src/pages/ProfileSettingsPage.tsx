// ============================================
// MasterUz — Profile Settings Page
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import { useTranslation } from '../i18n';
import { useLargeText } from '../hooks';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft, Save, User, FileText, Type, Layers, ChevronDown, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CITY_KEYS = ['Tashkent', 'Samarkand', 'Bukhara', 'Namangan', 'Andijan', 'Fergana', 'Nukus', 'Karshi'] as const;

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const { t, language } = useTranslation();
  const { largeText, toggleLargeText } = useLargeText();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    address: '',
    bio: '',
    avatarUrl: '',
  });

  // Master-specific fields
  const isMaster = user?.role === 'MASTER';
  const [masterForm, setMasterForm] = useState({
    specializations: [] as string[],
    experienceYears: 0,
    maxDistanceKm: 30,
    isAvailable: true,
    bio: '',
  });

  // Категории из каталога
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadProfile();
  }, [user]);

  // Загрузка категорий для мастера
  useEffect(() => {
    if (isMaster) {
      loadCategories();
    }
  }, [isMaster]);

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const [catRes, myCatRes] = await Promise.all([
        catalogApi.getCategories(),
        usersApi.getMasterCategories(),
      ]);
      // Только дочерние категории (с parentId)
      setCategories((catRes.data.data || []).filter((c: any) => c.parentId));
      const myIds = (myCatRes.data.data || []).map((mc: any) => mc.categoryId || mc.id);
      setSelectedCategoryIds(myIds);
    } catch {
      // ignore
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

  async function loadProfile() {
    try {
      const res = await usersApi.getProfile();
      const data = res.data.data;
      if (data?.profile) {
        setForm({
          firstName: data.profile.firstName || '',
          lastName: data.profile.lastName || '',
          phone: data.phone || '',
          city: data.profile.city || '',
          address: data.profile.address || '',
          bio: data.profile.bio || '',
          avatarUrl: data.profile.avatarUrl || '',
        });
      }
      if (data?.masterProfile && isMaster) {
        setMasterForm({
          specializations: data.masterProfile.specializations || [],
          experienceYears: data.masterProfile.experienceYears || 0,
          maxDistanceKm: data.masterProfile.maxDistanceKm || 30,
          isAvailable: data.masterProfile.isAvailable ?? true,
          bio: data.masterProfile.bio || '',
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.firstName.trim()) {
      toast.error(t('settings.firstNameRequired'));
      return;
    }
    setSaving(true);
    try {
      await usersApi.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        bio: form.bio || undefined,
        avatarUrl: form.avatarUrl || undefined,
      });

      if (isMaster) {
        await usersApi.updateMasterProfile({
          specializations: masterForm.specializations,
          experienceYears: masterForm.experienceYears,
          maxDistanceKm: masterForm.maxDistanceKm,
          isAvailable: masterForm.isAvailable,
          bio: masterForm.bio || undefined,
        });
        // Сохраняем выбранные категории
        if (selectedCategoryIds.length > 0) {
          await usersApi.updateMasterCategories(selectedCategoryIds);
        }
      }

      // Refresh user data in store
      const meRes = await usersApi.getProfile();
      if (meRes.data.data) {
        setUser(meRes.data.data);
      }

      toast.success(t('settings.saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4">
        <ArrowLeft size={18} className="mr-1" />
        {t('common.back')}
      </button>

      <h1 className="page-title">{t('settings.title')}</h1>

      {/* Аватар */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
        <div className="flex items-center gap-4">
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
          )}
          <div className="flex-1">
            <label className="label">{t('settings.avatarUrl')}</label>
            <input
              type="url"
              className="input text-sm"
              placeholder="https://..."
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Личные данные */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
          <User size={18} className="text-primary-600 dark:text-primary-400" />
          {t('settings.personalInfo')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{t('settings.firstName')} *</label>
            <input
              type="text"
              className="input"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('settings.lastName')}</label>
            <input
              type="text"
              className="input"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('settings.phone')}</label>
            <input
              type="tel"
              className="input"
              placeholder="+998 90 123-45-67"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('settings.city')}</label>
            <select
              className="input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              <option value="">{t('createOrder.selectCity')}</option>
              {CITY_KEYS.map((city) => (
                <option key={city} value={city}>{t(`cities.${city}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">{t('settings.address')}</label>
          <input
            type="text"
            className="input"
            placeholder={t('createOrder.addressPlaceholder')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>

        <div className="mt-4">
          <label className="label">{t('settings.aboutMe')}</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
      </div>

      {/* Настройки мастера */}
      {isMaster && (
        <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
            <FileText size={18} className="text-primary-600 dark:text-primary-400" />
            {t('settings.masterSettings')}
          </h2>

          {/* Категории услуг */}
          <div className="mb-4">
            <label className="label flex items-center gap-2">
              <Layers size={16} className="text-primary-600 dark:text-primary-400" />
              {t('settings.specializations')}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Выберите категории, в которых вы работаете
            </p>

            {loadingCategories ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {categories.map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  const isExpanded = expandedCategories.includes(cat.id);
                  const subcategories = cat.subcategories || [];
                  return (
                    <div key={cat.id}>
                      <div
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-primary-500 text-white'
                            : 'border-2 border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <Check size={14} />}
                        </div>
                        <span className={`flex-1 text-sm font-medium ${
                          isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                          {getCategoryName(cat)}
                        </span>
                        {subcategories.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExpandCategory(cat.id); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {isExpanded && subcategories.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1 mb-1">
                          {subcategories.map((sub: any) => (
                            <div key={sub.id} className="text-xs text-gray-500 dark:text-gray-400 py-1 px-2">
                              {getCategoryName(sub)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">{t('settings.experience')}</label>
              <input
                type="number"
                className="input"
                min="0"
                max="50"
                value={masterForm.experienceYears}
                onChange={(e) => setMasterForm({ ...masterForm, experienceYears: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">{t('settings.maxDistance')}</label>
              <input
                type="number"
                className="input"
                min="1"
                max="100"
                value={masterForm.maxDistanceKm}
                onChange={(e) => setMasterForm({ ...masterForm, maxDistanceKm: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">{t('settings.availability')}</label>
              <label className="flex items-center gap-3 mt-2 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    masterForm.isAvailable ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  onClick={() => setMasterForm({ ...masterForm, isAvailable: !masterForm.isAvailable })}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      masterForm.isAvailable ? 'translate-x-5.5 left-0.5' : 'left-0.5'
                    }`}
                  />
                </div>
                <span className={`text-sm ${masterForm.isAvailable ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {masterForm.isAvailable ? t('masterCard.available') : t('masterCard.busy')}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">{t('settings.masterBio')}</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder={t('becomeMasterPage.aboutPlaceholder')}
              value={masterForm.bio}
              onChange={(e) => setMasterForm({ ...masterForm, bio: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Доступность — Крупный текст */}
      <div className="card dark:bg-gray-800 dark:ring-gray-700 mb-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
          <Type size={18} className="text-primary-600 dark:text-primary-400" />
          Доступность
        </h2>

        <label className="flex items-center justify-between gap-4 cursor-pointer p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <div className="flex-1">
            <span className="text-base font-medium dark:text-white">Крупный текст</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Увеличить шрифт на 20–30% для удобного чтения
            </p>
          </div>
          <div
            className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
              largeText ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={toggleLargeText}
          >
            <div
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                largeText ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Кнопка сохранения */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        <Save size={18} className="mr-2" />
        {saving ? t('common.loading') : t('common.save')}
      </button>
    </div>
  );
}
