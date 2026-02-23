// ============================================
// MasterUz — InstantOrderPage (v5.0 — Фаза 3)
// Единая форма заказа: Фото → Голос/Текст → AI →
// Варианты (Good/Better/Best) → Подтверждение
// Адаптация под возраст 45–70+
// ============================================

import { useState, useRef, useCallback, useEffect, type DragEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Camera, Upload, Mic, MicOff, Sparkles, Zap, Star, Crown,
  ChevronRight, ArrowLeft, MapPin, Calendar, AlertTriangle,
  CheckCircle, Loader2, X, Package, Clock, Wallet, Image,
  Plus, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { instantOrderApi, catalogApi, photosApi } from '../api/client';
import type { AiAnalysisResult, AiOrderTemplate, Category } from '../types';

// ─── Tier configuration ──────────────────────
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
const STEPS: Step[] = ['upload', 'analyzing', 'variants', 'confirm'];
const STEP_LABELS = ['Фото и описание', 'AI-анализ', 'Выбор варианта', 'Подтверждение'];

export function InstantOrderPage() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const formatPrice = useFormatPrice();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ─── State ─────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Timing / scheduling
  const [timing, setTiming] = useState<'asap' | 'date'>('asap');
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  // AI result
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<AiOrderTemplate | null>(null);

  // Order form
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [additionalWishes, setAdditionalWishes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  // Refs for speech
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // ─── Load categories ────────────────
  useEffect(() => {
    catalogApi.getCategories()
      .then((res) => {
        const cats = res.data.data || [];
        if (cats.length > 0) setCategories(cats);
      })
      .catch(() => {});
  }, []);

  // ─── Photo upload ────────────────────
  const addFiles = useCallback((files: File[]) => {
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
      if (!file.type.startsWith('image/')) continue;
      newPreviews.push(URL.createObjectURL(file));
      newFiles.push(file);
    }
    setImages((prev) => [...prev, ...newPreviews]);
    setImageFiles((prev) => [...prev, ...newFiles]);
  }, [images.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (e.target) e.target.value = '';
  }, [addFiles]);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Drag & Drop ─────────────────────
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  // ─── Voice input (Web Speech API) ────
  const startRecording = useCallback(async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error('Ваш браузер не поддерживает распознавание речи. Попробуйте Chrome.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current = recorder;
      recorder.start();

      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      let interimTranscript = '';

      recognition.onresult = (event: any) => {
        interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript = transcript;
          }
        }
        const currentText = (finalTranscript + interimTranscript).trim();
        if (currentText) {
          setVoiceText(currentText);
          setDescription(currentText);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') toast.error('Речь не обнаружена.');
        else if (event.error === 'not-allowed') toast.error('Доступ к микрофону запрещён.');
      };

      recognition.onend = () => {
        const result = finalTranscript.trim();
        if (result) {
          setVoiceText(result);
          setDescription(result);
          toast.success('🎤 Голос распознан! Отредактируйте текст при необходимости.');
        } else {
          toast.error('Не удалось распознать речь.');
        }
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      toast('🎙️ Говорите... Текст появится в реальном времени', { duration: 2000 });
    } catch {
      toast.error('Не удалось получить доступ к микрофону');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, [isRecording]);

  // ─── AI analysis ────────────────────
  const handleAnalyze = async () => {
    if (images.length === 0) { toast.error('Загрузите хотя бы 1 фото'); return; }
    if (!description && !voiceText && !selectedCategoryId) {
      toast.error('Опишите что нужно или выберите категорию'); return;
    }

    setLoading(true);
    setStep('analyzing');

    try {
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        try {
          const formData = new FormData();
          formData.append('photo', file);
          const res = await photosApi.upload(formData);
          uploadedUrls.push(res.data.data?.url || '');
        } catch {
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

  // ─── Create order ────────────────────
  const handleCreateOrder = async () => {
    if (!selectedVariant) { toast.error('Выберите вариант'); return; }
    if (!title.trim()) { toast.error('Введите название заказа'); return; }
    if (!address.trim()) { toast.error('Укажите адрес'); return; }
    if (!offerAccepted) { toast.error('Необходимо принять условия оферты'); return; }

    setCreating(true);
    try {
      const uploadedUrls = images.map((_, i) => `https://placeholder.co/800x600?text=photo_${i + 1}`);
      const deadlineStr = timing === 'date' && deadline ? `${deadline}${deadlineTime ? 'T' + deadlineTime : ''}` : undefined;

      const result = await instantOrderApi.create({
        templateId: selectedVariant.id,
        title,
        description: description || voiceText || title,
        additionalWishes: additionalWishes || undefined,
        voiceDescription: voiceText || undefined,
        address,
        city: city || undefined,
        images: uploadedUrls,
        deadline: deadlineStr,
        isUrgent,
        offerAccepted,
      });

      const order = result.data.data;
      toast.success(additionalWishes ? '✅ Заказ создан и отправлен на модерацию!' : '✅ Заказ создан и опубликован!');
      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Ошибка создания заказа';
      if (msg.includes('средств')) {
        setBalanceError(msg);
        setShowBalanceModal(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const currentStepIndex = STEPS.indexOf(step);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-6 md:py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-white/80 hover:text-white mb-3 text-sm min-h-[44px] min-w-[44px]">
            <ArrowLeft size={18} className="mr-1" /> Назад
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
            <Sparkles size={28} /> Создать заказ за 30 секунд
          </h1>
          <p className="text-white/80 mt-1 text-sm md:text-base">
            📸 Загрузите фото → 🎤 опишите голосом → 🤖 AI подберёт варианты
          </p>

          {/* ─── Step indicator ─── */}
          <div className="flex items-center gap-1 mt-5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === s ? 'bg-white text-orange-500 scale-110 shadow-lg' :
                    currentStepIndex > i ? 'bg-white/40 text-white' : 'bg-white/20 text-white/50'
                  }`}>
                    {currentStepIndex > i ? <CheckCircle size={20} /> : i + 1}
                  </div>
                  <span className={`text-[10px] md:text-xs mt-1 text-center leading-tight ${
                    step === s ? 'text-white font-bold' : 'text-white/60'
                  }`}>
                    {STEP_LABELS[i]}
                  </span>
                </div>
                {i < 3 && (
                  <div className={`h-0.5 flex-1 mt-[-18px] ${
                    currentStepIndex > i ? 'bg-white/60' : 'bg-white/20'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ═══ STEP 1: Upload photos + description ═══ */}
        {step === 'upload' && (
          <div className="space-y-6 animate-fade-in">

            {/* Step label */}
            <div className="text-center">
              <span className="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm font-semibold px-4 py-2 rounded-full">
                Шаг 1 из 4: Загрузите фото и опишите проблему
              </span>
            </div>

            {/* ─── Photo zone ─── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg md:text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
                <Camera size={22} className="text-orange-500" />
                Загрузите фото проблемы
                <span className="text-sm text-gray-400 font-normal">(до 10 шт.)</span>
              </h2>

              {/* Photo previews grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                  {images.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 group">
                      <img src={url} alt={`Фото ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1.5 right-1.5 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg opacity-80 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  {/* Add more button */}
                  {images.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors min-h-[88px]"
                    >
                      <Plus size={24} className="text-gray-400" />
                      <span className="text-xs text-gray-400">Ещё</span>
                    </button>
                  )}
                </div>
              )}

              {/* Big drop zone */}
              {images.length === 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-3 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 scale-[1.02]'
                      : 'border-orange-300 dark:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
                      <Image size={40} className="text-orange-500" />
                    </div>
                    <p className="text-orange-600 dark:text-orange-400 font-bold text-base md:text-lg mb-1">
                      Нажмите или перетащите фотографии
                    </p>
                    <p className="text-sm text-gray-400">JPG, PNG до 10 МБ каждое • до 10 штук</p>
                  </div>
                </div>
              )}

              {/* Camera / Gallery buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl border-2 border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-sm md:text-base"
                >
                  <Camera size={20} /> Камера
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 min-h-[48px] rounded-xl border-2 border-orange-200 dark:border-orange-700 text-orange-600 dark:text-orange-400 font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-sm md:text-base"
                >
                  <Upload size={20} /> Галерея
                </button>
              </div>

              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            </div>

            {/* ─── Voice description ─── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg md:text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
                <Mic size={22} className="text-orange-500" />
                Опишите проблему
              </h2>

              {/* BIG mic button — accessible for older users */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full min-h-[64px] md:min-h-[72px] rounded-2xl font-bold text-lg md:text-xl flex items-center justify-center gap-3 transition-all mb-4 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30'
                }`}
              >
                {isRecording ? (
                  <>
                    <div className="relative">
                      <MicOff size={28} />
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
                    </div>
                    <span>Остановить запись...</span>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <Mic size={28} />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full animate-pulse" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>🎤 Нажмите и говорите</span>
                      <span className="text-sm font-normal text-white/70">Голос автоматически станет текстом</span>
                    </div>
                  </>
                )}
              </button>

              {/* Voice recognized banner */}
              {voiceText && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mb-4 flex items-center gap-2 border border-green-200 dark:border-green-800">
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    <strong>Голос распознан!</strong> Отредактируйте текст ниже.
                  </span>
                </div>
              )}

              {/* Editable description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что нужно сделать? Например: течёт кран на кухне, нужно заменить..."
                className={`w-full min-h-[120px] rounded-xl border-2 ${
                  voiceText && description
                    ? 'border-green-400 ring-2 ring-green-200 dark:ring-green-800'
                    : 'border-gray-200 dark:border-gray-600'
                } dark:bg-gray-700 dark:text-white px-4 py-3 resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base`}
                maxLength={2000}
              />
              {voiceText && (
                <p className="text-xs text-gray-400 mt-1">✏️ Вы можете свободно редактировать распознанный текст</p>
              )}
            </div>

            {/* ─── Timing ─── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                <Calendar size={20} className="text-orange-500" />
                Когда нужно выполнить?
              </h2>
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setTiming('asap')}
                  className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm md:text-base transition-all ${
                    timing === 'asap'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  ⚡ Как можно скорее
                </button>
                <button
                  onClick={() => setTiming('date')}
                  className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm md:text-base transition-all ${
                    timing === 'date'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  📅 Выбрать дату
                </button>
              </div>
              {timing === 'date' && (
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="flex-1 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base"
                  />
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-32 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base"
                  />
                </div>
              )}
            </div>

            {/* ─── Category (optional) ─── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold mb-3 dark:text-white">
                Категория <span className="text-sm text-gray-400 font-normal">(AI определит автоматически)</span>
              </h2>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Автоопределение по фото и описанию</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            {/* ─── Analyze button ─── */}
            <button
              onClick={handleAnalyze}
              disabled={images.length === 0 || loading}
              className="w-full min-h-[60px] md:min-h-[64px] bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg md:text-xl flex items-center justify-center gap-3 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-orange-500/25"
            >
              <Sparkles size={24} />
              Проанализировать с ИИ
              <ChevronRight size={22} />
            </button>

            {/* ─── Divider ─── */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-sm text-gray-400">или</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* ─── Individual evaluation — big orange ─── */}
            <Link
              to="/estimation/create"
              className="w-full min-h-[60px] md:min-h-[64px] bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-400/25 border-2 border-orange-300"
            >
              <AlertTriangle size={22} />
              🔍 Нужна индивидуальная оценка мастера
            </Link>
          </div>
        )}

        {/* ═══ STEP 2: AI analyzing ═══ */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center animate-pulse">
                <Sparkles size={40} className="text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center animate-bounce">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-xl md:text-2xl font-bold dark:text-white mb-2">AI анализирует фотографии...</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md text-base">
              Определяем тип работ, подбираем задачи и материалы, считаем стоимость.
              Обычно это 5–10 секунд.
            </p>
          </div>
        )}

        {/* ═══ STEP 3: Choose variant ═══ */}
        {step === 'variants' && analysisResult && (
          <div className="space-y-6 animate-fade-in">

            {/* Step label */}
            <div className="text-center">
              <span className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold px-4 py-2 rounded-full">
                Шаг 3 из 4: Выберите подходящий вариант
              </span>
            </div>

            {/* Detected category */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <CheckCircle size={22} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Категория определена</p>
                <p className="font-bold dark:text-white text-base">{analysisResult.category.name}</p>
              </div>
              {analysisResult.detectedFromPhoto && (
                <span className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full font-medium">
                  Определено AI
                </span>
              )}
            </div>

            {/* 3 variant cards */}
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
                    className={`relative rounded-2xl border-2 p-5 md:p-6 cursor-pointer transition-all hover:shadow-lg min-h-[120px] ${
                      isSelected
                        ? `${config.border} ${config.bg} shadow-md ring-2 ring-offset-2 ring-orange-500`
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                    }`}
                  >
                    {variant.tier === 'BETTER' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                        ⚡ РЕКОМЕНДУЕМ
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center flex-shrink-0`}>
                        <TierIcon size={26} className="text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-lg dark:text-white">{config.label}</h3>
                          <span className={`text-xs px-2.5 py-1 rounded-full ${config.badge}`}>
                            {Math.round(variant.confidence * 100)}% уверенность
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{variant.description}</p>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Package size={16} className="text-gray-400" />
                            <span className="dark:text-gray-300"><strong>{variant.taskIds.length}</strong> работ</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock size={16} className="text-gray-400" />
                            <span className="dark:text-gray-300"><strong>{variant.estimatedDays}</strong> дн.</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
                          {formatPrice(variant.estimatedPrice)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">фиксированная цена</p>
                      </div>
                    </div>

                    {variant.materials && variant.materials.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-400 mb-1.5">Материалы:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(variant.materials as any[]).map((m, i) => (
                            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full">
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <span className="text-sm text-orange-500 font-semibold flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center">
                        Выбрать <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Individual evaluation — big orange (under variants) ─── */}
            <Link
              to="/estimation/create"
              className="w-full min-h-[60px] md:min-h-[64px] bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl font-bold text-base md:text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-400/25 border-2 border-orange-300"
            >
              <AlertTriangle size={22} />
              🔍 Это не подходит — нужна индивидуальная оценка
            </Link>

            <button
              onClick={() => setStep('upload')}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-3 min-h-[44px]"
            >
              ← Изменить фото или описание
            </button>
          </div>
        )}

        {/* ═══ STEP 4: Confirm and create ═══ */}
        {step === 'confirm' && selectedVariant && (
          <div className="space-y-6 animate-fade-in">

            {/* Step label */}
            <div className="text-center">
              <span className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-semibold px-4 py-2 rounded-full">
                Шаг 4 из 4: Проверьте и подтвердите заказ
              </span>
            </div>

            {/* Selected variant card */}
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
              <button onClick={() => setStep('variants')} className="text-sm text-orange-500 mt-2 hover:underline min-h-[44px] flex items-center">
                ← Изменить вариант
              </button>
            </div>

            {/* Order details form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
              <h2 className="text-lg font-bold dark:text-white">Детали заказа</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Название заказа *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base focus:ring-2 focus:ring-orange-500"
                  placeholder="Напр.: Ремонт сантехники в ванной"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <MapPin size={14} className="inline mr-1" /> Адрес *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base focus:ring-2 focus:ring-orange-500"
                  placeholder="Город, улица, дом, квартира"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Город</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 min-h-[48px] text-base focus:ring-2 focus:ring-orange-500"
                  placeholder="Ташкент"
                />
              </div>

              {/* Urgency */}
              <label className="flex items-center gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-6 h-6 rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="dark:text-white text-base">
                  ⚡ Срочный заказ <span className="text-sm text-orange-500">(+40% к цене)</span>
                </span>
              </label>

              {isUrgent && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-300 font-medium">
                  Итого с срочностью: <strong>{formatPrice(selectedVariant.estimatedPrice * 1.4)}</strong>
                </div>
              )}
            </div>

            {/* Additional wishes */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold dark:text-white mb-2 flex items-center gap-2">
                Дополнительные пожелания
                <span className="text-xs text-gray-400 font-normal">(необязательно)</span>
              </h2>
              <textarea
                value={additionalWishes}
                onChange={(e) => setAdditionalWishes(e.target.value)}
                placeholder="Любые уточнения — будут отправлены на проверку менеджеру..."
                className="w-full min-h-[100px] rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 resize-none focus:ring-2 focus:ring-orange-500 text-base"
                maxLength={2000}
              />
              {additionalWishes.trim() && (
                <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={16} />
                  Заказ будет отправлен на модерацию менеджеру
                </div>
              )}
            </div>

            {/* Offer acceptance */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <label className="flex items-start gap-3 cursor-pointer min-h-[48px]">
                <input
                  type="checkbox"
                  checked={offerAccepted}
                  onChange={(e) => setOfferAccepted(e.target.checked)}
                  className="w-6 h-6 rounded text-orange-500 focus:ring-orange-500 mt-0.5 flex-shrink-0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  Я принимаю условия оферты и соглашаюсь с фиксированной ценой{' '}
                  <strong>{formatPrice(isUrgent ? selectedVariant.estimatedPrice * 1.4 : selectedVariant.estimatedPrice)}</strong>{' '}
                  + стоимость выезда мастера. Средства будут заблокированы на балансе.
                </span>
              </label>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreateOrder}
              disabled={creating || !offerAccepted || !title.trim() || !address.trim()}
              className="w-full min-h-[60px] md:min-h-[64px] bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg md:text-xl flex items-center justify-center gap-3 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-green-500/25"
            >
              {creating ? (
                <><Loader2 size={24} className="animate-spin" /> Создаём заказ...</>
              ) : (
                <><CheckCircle size={24} /> Создать заказ {isUrgent && '⚡'}</>
              )}
            </button>

            {/* Individual evaluation — big orange */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-sm text-gray-400">или</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <Link
              to="/estimation/create"
              className="w-full min-h-[60px] bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl font-bold text-base md:text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-orange-400/25 border-2 border-orange-300"
            >
              <AlertTriangle size={22} />
              🔍 Нужна индивидуальная оценка мастера
            </Link>
          </div>
        )}
      </div>

      {/* ─── Balance modal ─── */}
      {showBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative animate-scale-in">
            <button
              onClick={() => setShowBalanceModal(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 flex items-center justify-center"
            >
              <X size={20} />
            </button>
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-5">
              <Wallet size={36} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-extrabold dark:text-white mb-3">Недостаточно средств</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">{balanceError}</p>
            <button
              onClick={() => { setShowBalanceModal(false); navigate('/balance'); }}
              className="w-full min-h-[56px] bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg"
            >
              <Wallet size={22} /> Пополнить баланс
            </button>
            <button
              onClick={() => setShowBalanceModal(false)}
              className="w-full mt-3 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium text-sm min-h-[44px]"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstantOrderPage;
