// ============================================
// MasterUz — Create Estimation Order Page
// Выезд мастера на оценку и составление сметы
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { estimationApi, catalogApi } from '../api/client';
import { useAuthStore } from '../store';
import { useGeolocation } from '../hooks';
import {
  ArrowLeft, MapPin, Send, Image as ImageIcon, X,
  Clock, DollarSign, Shield, FileText, Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UZBEKISTAN_REGIONS, getDistrictsForCity, getLocalizedRegionName } from '../data/regions';
import { useTranslation, useLocalizedName } from '../i18n';

const ESTIMATION_FEE = 150000; // 150 000 сум

interface PrefillState {
  categoryId?: string;
  description?: string;
  images?: string[];
  title?: string;
}

export function CreateEstimationPage() {
  const { t, language } = useTranslation();
  const ln = useLocalizedName();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const prefill = (routerLocation.state as PrefillState | null) || {};
  const { user } = useAuthStore();
  const { location, requestLocation } = useGeolocation();

  const [categories, setCategories] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Форма — предзаполняется из InstantOrder, если пришли по кнопке «Вызвать мастера на замер»
  const [categoryId, setCategoryId] = useState(prefill.categoryId || '');
  const [title, setTitle] = useState(prefill.title || '');
  const [description, setDescription] = useState(prefill.description || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Ташкент');
  const [district, setDistrict] = useState('');
  const [images, setImages] = useState<string[]>(prefill.images || []);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    loadCategories();
    requestLocation();
  }, []);

  async function loadCategories() {
    try {
      const res = await catalogApi.getCategories();
      // Только дочерние категории (с parentId)
      setCategories((res.data.data || []).filter((c: any) => c.parentId));
    } catch { }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!categoryId) return toast.error(t('estimationForm.chooseCategory'));
    if (!title.trim()) return toast.error(t('estimationForm.enterTitle'));
    if (description.trim().length < 10) return toast.error(t('estimationForm.describeMore'));
    if (!address.trim()) return toast.error(t('estimationForm.enterAddress'));
    if (images.length === 0) return toast.error(t('estimationForm.attachPhoto'));

    setSubmitting(true);
    try {
      await estimationApi.createEstimationOrder({
        categoryId,
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        city,
        district,
        latitude: location?.latitude,
        longitude: location?.longitude,
        images,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
      });

      toast.success(t('estimationForm.created'));
      navigate('/my-orders');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || t('createOrder.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  const districts = getDistrictsForCity(city);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{t('estimation.title')}</h1>
          <p className="text-sm text-gray-500">{t('estimation.subtitle')}</p>
        </div>
      </div>

      {/* Информация о стоимости */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-2xl p-4 mb-6 border border-primary-200 dark:border-primary-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-800 rounded-xl flex items-center justify-center">
            <DollarSign size={20} className="text-primary-600" />
          </div>
          <div>
            <div className="font-bold text-lg">{ESTIMATION_FEE.toLocaleString('ru')} {t('common.currency')}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t('estimation.fixedPrice')}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Shield size={14} className="text-green-500" />
            {t('estimationForm.fundsHeld')}
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <FileText size={14} className="text-blue-500" />
            {t('estimationForm.estimateOnSite')}
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Clock size={14} className="text-orange-500" />
            {t('estimationForm.within2h')}
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <DollarSign size={14} className="text-green-500" />
            {t('estimationForm.masterGets')}
          </div>
        </div>
      </div>

      {/* Форма */}
      <div className="space-y-4">
        {/* Категория */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t('estimationForm.workCategory')} *</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="">{t('estimationForm.chooseCategory')}</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{ln(cat)}</option>
            ))}
          </select>
        </div>

        {/* Название */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t('estimationForm.whatToEstimate')} *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('estimationForm.titlePlaceholder')}
            className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
            maxLength={200}
          />
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t('estimationForm.detailedDesc')} *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('estimationForm.descPlaceholder')}
            className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 h-28 resize-none"
            maxLength={2000}
          />
          <div className="text-xs text-gray-400 text-right mt-1">{description.length}/2000</div>
        </div>

        {/* Фото */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            <Camera size={16} className="inline mr-1" />
            {t('estimationForm.objectPhotos')}
          </label>
          <p className="text-xs text-gray-500 mb-2">{t('estimationForm.attachHint')}</p>

          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 transition-colors">
              <ImageIcon size={20} className="text-gray-400" />
              <span className="text-xs text-gray-400 mt-1">{t('estimationForm.photo')}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Адрес */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            <MapPin size={16} className="inline mr-1" />
            {t('estimationForm.address')} *
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={t('estimationForm.addressPlaceholder')}
            className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
          />
        </div>

        {/* Город + Район */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t('createOrder.city')}</label>
            <select
              value={city}
              onChange={e => { setCity(e.target.value); setDistrict(''); }}
              className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              {UZBEKISTAN_REGIONS.map(r => (
                <option key={r.key} value={r.nameRu}>{getLocalizedRegionName(r, language)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t('createOrder.district')}</label>
            <select
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">{t('estimationForm.notSpecified')}</option>
              {districts.map(d => (
                <option key={d.key} value={d.nameRu}>{getLocalizedRegionName(d, language)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Дата и время */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5">
              <Clock size={16} className="inline mr-1" />
              {t('estimationForm.dateOptional')}
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t('estimationForm.time')}</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              className="w-full p-3 border rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Баланс клиента */}
        {user && (
          <div className={`p-3 rounded-xl text-sm ${
            (user.balance || 0) >= ESTIMATION_FEE
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {t('estimationForm.yourBalance')}: {(user.balance || 0).toLocaleString('ru')} {t('common.currency')}
            {(user.balance || 0) < ESTIMATION_FEE && (
              <span className="block mt-1 font-semibold">
                {t('estimationForm.topUpBy')} {(ESTIMATION_FEE - (user.balance || 0)).toLocaleString('ru')} {t('common.currency')}
              </span>
            )}
          </div>
        )}

        {/* Кнопка отправки */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={20} />
              {t('estimation.createOrder')} — {ESTIMATION_FEE.toLocaleString('ru')} {t('common.currency')}
            </>
          )}
        </button>

        {/* Как это работает */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mt-4">
          <h3 className="font-bold text-sm mb-3">{t('estimationForm.howItWorks')}</h3>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>{t('estimationForm.how1')}</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>{t('estimationForm.how2')}</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span>{t('estimationForm.how3')}</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <span>{t('estimationForm.how4')}</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0">5</span>
              <span>{t('estimationForm.how5')}</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
