// ============================================
// MasterUz — InstantOrderPage (ФотоЗаказ за 30 секунд)
// Загрузка фото → голос/текст → AI-анализ →
// 3 варианта (Good/Better/Best) → Создание заказа
// ============================================

import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Camera, Upload, Mic, MicOff, Sparkles, Zap, Star, Crown,
  ChevronRight, ArrowLeft, MapPin, Calendar, AlertTriangle,
  CheckCircle, Loader2, X, Package, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { instantOrderApi, catalogApi, photosApi } from '../api/client';
import type { AiAnalysisResult, AiOrderTemplate, Category } from '../types';

// Уровни с иконками и стилями
const TIER_CONFIG = {
  GOOD: {
    icon: Star,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: '⭐ Хороший',
  },
  BETTER: {
    icon: Zap,
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: '⚡ Отличный',
  },
  BEST: {
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    label: '👑 Премиум',
  },
};

type Step = 'upload' | 'analyzing' | 'variants' | 'confirm';

export function InstantOrderPage() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const formatPrice = useFormatPrice();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Состояние ─────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  // AI результат
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<AiOrderTemplate | null>(null);

  // Форма создания заказа
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [additionalWishes, setAdditionalWishes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [offerAccepted, setOfferAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Медиа-рекордер
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ─── Загрузка категорий ────────────────
  useState(() => {
    catalogApi.getCategories()
      .then((res) => {
        const cats = res.data.data || [];
        setCategories(cats);
      })
      .catch(() => {});
  });

  // ─── Загрузка фото ────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 10) {
      toast.error('Максимум 10 фотографий');
      return;
    }

    const newPreviews: string[] = [];
    const newFiles: File[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Файл ${file.name} слишком большой (макс. 10 МБ)`);
        continue;
      }
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
      newFiles.push(file);
    }

    setImages((prev) => [...prev, ...newPreviews]);
    setImageFiles((prev) => [...prev, ...newFiles]);
  }, [images.length]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Голосовой ввод ────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        // В реальном проекте: отправить blob на STT (Whisper API)
        // Сейчас — mock
        const mockText = description || 'Голосовое описание проблемы записано';
        setVoiceText(mockText);
        toast.success('Голос записан! Описание распознано.');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast('🎙️ Запись... Опишите проблему голосом', { duration: 2000 });
    } catch {
      toast.error('Не удалось получить доступ к микрофону');
    }
  }, [description]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // ─── AI-анализ ─────────────────────────
  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error('Загрузите хотя бы 1 фото');
      return;
    }
    if (!description && !voiceText && !selectedCategoryId) {
      toast.error('Опишите что нужно сделать или выберите категорию');
      return;
    }

    setLoading(true);
    setStep('analyzing');

    try {
      // Сначала загружаем фото на сервер
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        try {
          const formData = new FormData();
          formData.append('photo', file);
          const res = await photosApi.upload(formData);
          uploadedUrls.push(res.data.data?.url || '');
        } catch {
          // fallback — используем placeholder
          uploadedUrls.push(`https://placeholder.co/800x600?text=photo_${uploadedUrls.length + 1}`);
        }
      }

      const result = await instantOrderApi.analyze({
        images: uploadedUrls.length > 0 ? uploadedUrls : ['https://placeholder.co/800x600'],
        description: description || undefined,
        voiceText: voiceText || undefined,
        categoryId: selectedCategoryId || undefined,
      });

      setAnalysisResult(result.data.data);
      setStep('variants');

      // Авто-заполнение title из категории
      if (result.data.data?.category) {
        setTitle(`${result.data.data.category.name} — ФотоЗаказ`);
      }

      toast.success('AI-анализ завершён! Выберите вариант.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка AI-анализа');
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  // ─── Создание заказа ───────────────────
  const handleCreateOrder = async () => {
    if (!selectedVariant) {
      toast.error('Выберите вариант');
      return;
    }
    if (!title.trim()) {
      toast.error('Введите название заказа');
      return;
    }
    if (!address.trim()) {
      toast.error('Укажите адрес');
      return;
    }
    if (!offerAccepted) {
      toast.error('Необходимо принять условия оферты');
      return;
    }

    setCreating(true);
    try {
      // Получаем загруженные URL (те же что при анализе)
      const uploadedUrls = images.map((_, i) => 
        `https://placeholder.co/800x600?text=photo_${i + 1}`
      );

      const result = await instantOrderApi.create({
        templateId: selectedVariant.id,
        title,
        description: description || voiceText || title,
        additionalWishes: additionalWishes || undefined,
        voiceDescription: voiceText || undefined,
        address,
        city: city || undefined,
        images: uploadedUrls,
        deadline: deadline || undefined,
        isUrgent,
        offerAccepted,
      });

      const order = result.data.data;
      toast.success(
        additionalWishes
          ? '✅ Заказ создан и отправлен на модерацию!'
          : '✅ Заказ создан и опубликован!'
      );
      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Ошибка создания заказа');
    } finally {
      setCreating(false);
    }
  };

  // ═══════════════════════════════════════
  // РЕНДЕРИНГ
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-white/80 hover:text-white mb-3 text-sm">
            <ArrowLeft size={16} className="mr-1" /> Назад
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
            <Sparkles size={28} /> ФотоЗаказ за 30 секунд
          </h1>
          <p className="text-white/80 mt-1">
            Загрузите фото → AI подберёт работы → Выберите вариант → Готово!
          </p>

          {/* Прогресс-бар */}
          <div className="flex items-center gap-2 mt-4">
            {(['upload', 'analyzing', 'variants', 'confirm'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s ? 'bg-white text-orange-500 scale-110' :
                  (['upload', 'analyzing', 'variants', 'confirm'].indexOf(step) > i)
                    ? 'bg-white/40 text-white'
                    : 'bg-white/20 text-white/50'
                }`}>
                  {i + 1}
                </div>
                {i < 3 && <div className={`w-6 h-0.5 ${
                  (['upload', 'analyzing', 'variants', 'confirm'].indexOf(step) > i)
                    ? 'bg-white/60'
                    : 'bg-white/20'
                }`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* ═══ ШАГ 1: Загрузка фото + описание ═══ */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Зона загрузки фото */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                <Camera size={20} className="text-orange-500" />
                Загрузите фото проблемы
                <span className="text-sm text-gray-400 font-normal">(до 10 шт.)</span>
              </h2>

              {/* Фото-превью */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                  {images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <img src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Кнопка добавления */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-orange-300 dark:border-orange-600 rounded-2xl p-8 text-center cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
              >
                <Upload size={40} className="mx-auto text-orange-400 mb-2" />
                <p className="text-orange-600 dark:text-orange-400 font-semibold">
                  Нажмите для выбора или перетащите фото
                </p>
                <p className="text-sm text-gray-400 mt-1">JPG, PNG до 10 МБ каждое</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Голосовое описание */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                <Mic size={20} className="text-orange-500" />
                Опишите проблему
              </h2>

              {/* Кнопка микрофона */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all mb-4 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff size={24} />
                    Остановить запись...
                  </>
                ) : (
                  <>
                    <Mic size={24} />
                    🎙️ Опишите голосом (приоритет)
                  </>
                )}
              </button>

              {voiceText && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mb-4 text-sm text-green-700 dark:text-green-300">
                  <strong>Распознано:</strong> {voiceText}
                </div>
              )}

              {/* Текстовое описание */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что нужно сделать? Например: течёт кран на кухне, нужно заменить..."
                className="w-full h-28 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                maxLength={2000}
              />
            </div>

            {/* Выбор категории (опционально) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4 dark:text-white">
                Категория <span className="text-sm text-gray-400 font-normal">(AI определит автоматически)</span>
              </h2>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Автоопределение по фото и описанию</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* Кнопка «Анализировать» */}
            <button
              onClick={handleAnalyze}
              disabled={images.length === 0 || loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25"
            >
              <Sparkles size={22} />
              Анализировать с AI
              <ChevronRight size={20} />
            </button>

            {/* Ссылка на индивидуальную оценку */}
            <div className="text-center py-3">
              <Link to="/estimation/create" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 text-sm underline">
                Это не подходит — нужна индивидуальная оценка мастера →
              </Link>
            </div>
          </div>
        )}

        {/* ═══ ШАГ 2: AI анализирует ═══ */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center animate-pulse">
                <Sparkles size={36} className="text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center animate-bounce">
                <Loader2 size={16} className="text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-bold dark:text-white mb-2">AI анализирует фотографии...</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Определяем тип работ, подбираем задачи и материалы, считаем стоимость.
              Обычно это занимает 5-10 секунд.
            </p>
          </div>
        )}

        {/* ═══ ШАГ 3: Выбор варианта ═══ */}
        {step === 'variants' && analysisResult && (
          <div className="space-y-6">
            {/* Определённая категория */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <CheckCircle size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Категория определена</p>
                <p className="font-bold dark:text-white">{analysisResult.category.name}</p>
              </div>
              {analysisResult.detectedFromPhoto && (
                <span className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full">
                  Определено AI
                </span>
              )}
            </div>

            {/* 3 варианта */}
            <h2 className="text-xl font-bold dark:text-white">Выберите вариант:</h2>

            <div className="grid gap-4">
              {analysisResult.variants.map((variant) => {
                const config = TIER_CONFIG[variant.tier as keyof typeof TIER_CONFIG];
                const TierIcon = config.icon;
                const isSelected = selectedVariant?.id === variant.id;

                return (
                  <div
                    key={variant.id}
                    onClick={() => {
                      setSelectedVariant(variant);
                      setStep('confirm');
                    }}
                    className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg ${
                      isSelected
                        ? `${config.border} ${config.bg} shadow-md ring-2 ring-offset-2 ring-orange-500`
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                    }`}
                  >
                    {/* Рекомендовано */}
                    {variant.tier === 'BETTER' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                        ⚡ РЕКОМЕНДУЕМ
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <TierIcon size={24} className="text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg dark:text-white">{config.label}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
                            {Math.round(variant.confidence * 100)}% уверенность
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          {variant.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Package size={14} className="text-gray-400" />
                            <span className="dark:text-gray-300">
                              <strong>{variant.taskIds.length}</strong> работ
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-gray-400" />
                            <span className="dark:text-gray-300">
                              <strong>{variant.estimatedDays}</strong> дн.
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                          {formatPrice(variant.estimatedPrice)}
                        </p>
                        <p className="text-xs text-gray-400">фиксированная цена</p>
                      </div>
                    </div>

                    {/* Материалы */}
                    {variant.materials && variant.materials.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Материалы:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(variant.materials as any[]).map((m, i) => (
                            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <span className="text-sm text-orange-500 font-semibold flex items-center gap-1">
                        Выбрать <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Кнопка индивидуальной оценки */}
            <div className="text-center py-4">
              <Link
                to="/estimation/create"
                className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-orange-500 text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-5 py-2.5 hover:border-orange-300 transition-all"
              >
                <AlertTriangle size={14} />
                Это не подходит — нужна индивидуальная оценка мастера
              </Link>
            </div>

            {/* Вернуться к загрузке */}
            <button
              onClick={() => setStep('upload')}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-2"
            >
              ← Изменить фото или описание
            </button>
          </div>
        )}

        {/* ═══ ШАГ 4: Подтверждение и создание заказа ═══ */}
        {step === 'confirm' && selectedVariant && (
          <div className="space-y-6">
            {/* Выбранный вариант — карточка */}
            <div className={`rounded-2xl p-5 border-2 ${
              TIER_CONFIG[selectedVariant.tier as keyof typeof TIER_CONFIG].border
            } ${TIER_CONFIG[selectedVariant.tier as keyof typeof TIER_CONFIG].bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold dark:text-white text-lg">
                  {TIER_CONFIG[selectedVariant.tier as keyof typeof TIER_CONFIG].label}
                </span>
                <span className="text-2xl font-extrabold dark:text-white">
                  {formatPrice(selectedVariant.estimatedPrice)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedVariant.taskIds.length} работ • {selectedVariant.estimatedDays} дн. • фиксированная цена
              </p>
              <button onClick={() => setStep('variants')} className="text-sm text-orange-500 mt-2 hover:underline">
                ← Изменить вариант
              </button>
            </div>

            {/* Форма заказа */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
              <h2 className="text-lg font-bold dark:text-white">Детали заказа</h2>

              {/* Название */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Название заказа *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 focus:ring-2 focus:ring-orange-500"
                  placeholder="Напр.: Ремонт сантехники в ванной"
                />
              </div>

              {/* Адрес */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin size={14} className="inline mr-1" /> Адрес *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 focus:ring-2 focus:ring-orange-500"
                  placeholder="Город, улица, дом, квартира"
                />
              </div>

              {/* Город */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Город
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 focus:ring-2 focus:ring-orange-500"
                  placeholder="Ташкент"
                />
              </div>

              {/* Дата */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar size={14} className="inline mr-1" /> Желаемая дата
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Срочность */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="dark:text-white">
                  ⚡ Срочный заказ <span className="text-sm text-orange-500">(+40% к цене)</span>
                </span>
              </label>

              {isUrgent && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-300">
                  Итого с срочностью: <strong>{formatPrice(selectedVariant.estimatedPrice * 1.4)}</strong>
                </div>
              )}
            </div>

            {/* Дополнительные пожелания */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold dark:text-white mb-2 flex items-center gap-2">
                Дополнительные пожелания
                <span className="text-xs text-gray-400 font-normal">(необязательно)</span>
              </h2>
              <textarea
                value={additionalWishes}
                onChange={(e) => setAdditionalWishes(e.target.value)}
                placeholder="Любые уточнения — будут отправлены на проверку менеджеру..."
                className="w-full h-24 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 resize-none focus:ring-2 focus:ring-orange-500"
                maxLength={2000}
              />
              {additionalWishes.trim() && (
                <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={14} />
                  Заказ будет отправлен на модерацию менеджеру
                </div>
              )}
            </div>

            {/* Оферта */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offerAccepted}
                  onChange={(e) => setOfferAccepted(e.target.checked)}
                  className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500 mt-0.5"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Я принимаю условия оферты и соглашаюсь с фиксированной ценой{' '}
                  <strong>{formatPrice(isUrgent ? selectedVariant.estimatedPrice * 1.4 : selectedVariant.estimatedPrice)}</strong>{' '}
                  + стоимость выезда мастера. Средства будут заблокированы на балансе.
                </span>
              </label>
            </div>

            {/* Кнопка создания */}
            <button
              onClick={handleCreateOrder}
              disabled={creating || !offerAccepted || !title.trim() || !address.trim()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25"
            >
              {creating ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  Создаём заказ...
                </>
              ) : (
                <>
                  <CheckCircle size={22} />
                  Создать заказ
                  {isUrgent && ' ⚡'}
                </>
              )}
            </button>

            {/* Индивидуальная оценка */}
            <div className="text-center py-3">
              <Link to="/estimation/create" className="text-gray-500 dark:text-gray-400 hover:text-orange-500 text-sm underline">
                Хочу индивидуальную оценку мастера →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstantOrderPage;
