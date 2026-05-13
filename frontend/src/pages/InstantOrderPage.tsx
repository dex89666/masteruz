// ============================================
// MasterUz — InstantOrderPage (v5.0 — Фаза 3)
// Единая форма заказа: Фото → Голос/Текст → AI →
// Варианты (Good/Better/Best) → Подтверждение
// Адаптация под возраст 45–70+
// ============================================

import { useState, useRef, useCallback, useEffect, type DragEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Camera, Upload, Mic, MicOff, Sparkles, Zap, Star, Crown,
  ChevronRight, ChevronDown, ArrowLeft, MapPin, Calendar, AlertTriangle,
  CheckCircle, Loader2, X, Package, Clock, Wallet, Image,
  Plus, Trash2, Check, ListChecks,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '../i18n';
import { useFormatPrice } from '../hooks';
import { instantOrderApi, catalogApi, photosApi } from '../api/client';
import type { AiAnalysisResult, AiOrderTemplate, Category } from '../types';
import CategoryIcon from '../components/CategoryIcon';
import { CameraCapture } from '../components/CameraCapture';

// ─── Tier configuration ──────────────────────
const TIER_CONFIG = {
  GOOD: {
    icon: Star,
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Хороший',
  },
  BETTER: {
    icon: Zap,
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Отличный',
  },
  BEST: {
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    label: 'Премиум',
  },
};

type Step = 'upload' | 'analyzing' | 'clarify' | 'variants' | 'confirm';
const STEPS: Step[] = ['upload', 'analyzing', 'variants', 'confirm'];
const STEP_LABELS = ['Фото и описание', 'AI-анализ', 'Выбор варианта', 'Подтверждение'];

export function InstantOrderPage() {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formatPrice = useFormatPrice();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // ─── State ─────────────────────────
  const [step, setStep] = useState<Step>('upload');
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Timing / scheduling
  const [timing, setTiming] = useState<'asap' | 'date'>('asap');
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  // AI result
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<AiOrderTemplate | null>(null);

  // Раскрытые карточки вариантов с подробным списком услуг
  const [expandedVariants, setExpandedVariants] = useState<Record<string, boolean>>({});

  // Уточняющие вопросы (когда AI не смог точно определить характер работ)
  const [clarifyQuestions, setClarifyQuestions] = useState<import('../types').AiClarifyingQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string | string[]>>({});

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

  // Подсветка обязательного выбора категории, когда AI не справился
  const [categoryRequired, setCategoryRequired] = useState(false);
  const categorySectionRef = useRef<HTMLDivElement>(null);

  // Refs for speech
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // ─── Load categories ────────────────
  useEffect(() => {
    // Auto-enable urgency from URL param (?urgent=true)
    if (searchParams.get('urgent') === 'true') {
      setIsUrgent(true);
    }
  }, [searchParams]);

  useEffect(() => {
    catalogApi.getCategories()
      .then((res) => {
        const raw: any[] = res.data.data || [];

        // API возвращает дерево: [{ id, name, children: [...], subcategories: [...] }, ...]
        // Нам нужны «листовые» категории (с подкатегориями = реальные направления работ).
        // Алгоритм: рекурсивно собираем всё, отдаём предпочтение узлам, у которых есть подкатегории/задачи.
        const flat: any[] = [];
        const walk = (node: any) => {
          if (!node) return;
          flat.push(node);
          (node.children || []).forEach(walk);
        };
        raw.forEach(walk);

        // Берём только те, что активны и имеют подкатегории (значит, по ним можно строить смету).
        // Если таких нет — fallback: все активные с parentId, иначе все активные.
        const active = flat.filter((c) => c.isActive !== false);
        const withSubs = active.filter((c) => Array.isArray(c.subcategories) && c.subcategories.length > 0);
        const withParent = active.filter((c) => c.parentId);
        const picked = withSubs.length > 0 ? withSubs : (withParent.length > 0 ? withParent : active);

        // ─── Дедупликация: API может вернуть и parent, и child с тем же slug/именем ───
        // Приоритет: top-level категории (без parentId), затем по сумме подкатегорий.
        const seen = new Map<string, any>();
        for (const c of picked) {
          const key = (c.slug || c.name || '').toString().toLowerCase().trim();
          if (!key) continue;
          const existing = seen.get(key);
          if (!existing) {
            seen.set(key, c);
            continue;
          }
          // Если уже есть запись — оставляем ту, что лучше: top-level > больше подкатегорий
          const curSubs = (c.subcategories || []).length;
          const oldSubs = (existing.subcategories || []).length;
          const curIsRoot = !c.parentId;
          const oldIsRoot = !existing.parentId;
          if ((curIsRoot && !oldIsRoot) || (curIsRoot === oldIsRoot && curSubs > oldSubs)) {
            seen.set(key, c);
          }
        }
        const cats = Array.from(seen.values());

        if (cats.length > 0) {
          setCategories(cats);
          // Auto-select category from URL param (?category=id_or_slug)
          const catParam = searchParams.get('category');
          if (catParam) {
            const found = cats.find((c: Category) => c.id === catParam || (c as any).slug === catParam);
            if (found) setSelectedCategoryIds([found.id]);
          }
        } else {
          console.warn('Категории не получены: пустой список', raw);
        }
      })
      .catch((err) => {
        console.error('Не удалось загрузить категории:', err);
      });
  }, []);

  // ─── Сжатие изображения через Canvas ──────
  const compressImage = useCallback((file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      // Если файл маленький (< 500KB) — не сжимаем
      if (file.size < 500 * 1024) { resolve(file); return; }

      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }, []);

  // ─── Photo upload ────────────────────
  const addFiles = useCallback(async (files: File[]) => {
    if (images.length + files.length > 10) {
      toast.error('Максимум 10 фотографий');
      return;
    }
    const newPreviews: string[] = [];
    const newFiles: File[] = [];
    for (let file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Файл ${file.name} слишком большой (макс. 10 МБ)`);
        continue;
      }
      if (!file.type.startsWith('image/')) continue;
      // Сжимаем большие фото перед добавлением
      file = await compressImage(file);
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
          toast.success('Голос распознан! Отредактируйте текст при необходимости.');
        } else {
          toast.error('Не удалось распознать речь.');
        }
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      toast('Говорите... Текст появится в реальном времени', { duration: 2000 });
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
  /**
   * Преобразует ответы на уточняющие вопросы в плотную строку,
   * которая будет добавлена к описанию и отправлена на повторный анализ.
   */
  const buildClarificationText = useCallback(() => {
    if (!clarifyQuestions.length) return '';
    const parts: string[] = [];
    for (const q of clarifyQuestions) {
      const answer = clarifyAnswers[q.id];
      if (!answer || (Array.isArray(answer) && answer.length === 0)) continue;
      if (q.type === 'multiselect' && Array.isArray(answer)) {
        const labels = answer
          .map((v) => q.options?.find((o) => o.value === v)?.label || v)
          .join(', ');
        parts.push(`${q.question} ${labels}`);
      } else if (q.type === 'select' && typeof answer === 'string') {
        const label = q.options?.find((o) => o.value === answer)?.label || answer;
        parts.push(`${q.question} ${label}`);
      } else if (q.type === 'text' && typeof answer === 'string') {
        parts.push(answer);
      }
    }
    return parts.join('. ');
  }, [clarifyQuestions, clarifyAnswers]);

  const handleSubmitClarification = async () => {
    const extra = buildClarificationText();
    if (!extra.trim()) {
      toast.error('Заполните хотя бы один вопрос');
      return;
    }
    // Объединяем ответы с исходным описанием и снова запускаем анализ
    const merged = [description, extra].filter(Boolean).join('. ');
    setDescription(merged);
    // Сбрасываем флаг и запускаем анализ повторно
    setClarifyQuestions([]);
    setAnalysisResult(null);
    // Маленькая хитрость: handleAnalyze читает description из state, поэтому ждём микротик
    requestAnimationFrame(() => {
      handleAnalyze();
    });
  };

  const handleAnalyze = async () => {
    const hasContext =
      images.length > 0 ||
      description.trim().length > 0 ||
      voiceText.trim().length > 0 ||
      selectedCategoryIds.length > 0;
    if (!hasContext) {
      toast.error('Загрузите фото, опишите задачу или выберите категорию');
      return;
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
          const url = res.data.data?.url;
          if (url) {
            // Принимаем любой URL — обычный или base64 data URL
            uploadedUrls.push(url);
          }
        } catch (uploadErr) {
          console.warn('Ошибка загрузки фото на сервер:', uploadErr);
        }
      }

      // Если серверная загрузка не удалась — генерируем base64 из файлов напрямую
      if (uploadedUrls.length === 0 && imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            uploadedUrls.push(dataUrl);
          } catch {
            uploadedUrls.push(`photo-pending-${uploadedUrls.length + 1}`);
          }
        }
      }

      // Если файлы были, но ни один не загрузился — это реальная ошибка сети.
      // Если файлов изначально не было — это нормально, идём анализировать без фото.
      if (uploadedUrls.length === 0 && imageFiles.length > 0) {
        toast.error('Не удалось загрузить фотографии. Проверьте соединение.');
        setStep('upload');
        setLoading(false);
        return;
      }

      const result = await instantOrderApi.analyze({
        images: uploadedUrls,
        description: description || undefined,
        voiceText: voiceText || undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      });

      const data = result.data.data;

      // ─── Работа требует выезда мастера для замера ──
      if (data?.needsOnSiteEstimation) {
        setAnalysisResult(data);
        setStep('clarify'); // переиспользуем экран — на нём покажем кнопку «Вызвать мастера на замер»
        toast(
          data.message || 'Для точного расчёта нужны замеры на месте. Можем вызвать мастера на выездную оценку.',
          { icon: '📏', duration: 7000 }
        );
        return;
      }

      // ─── AI определил несколько вероятных категорий → клиент подтверждает ──
      if (data?.needsCategoryConfirmation && Array.isArray(data.suggestedCategories) && data.suggestedCategories.length > 0) {
        setAnalysisResult(data);
        // Предзаполняем выбор категорий тем что AI предположил
        const ids = data.suggestedCategories.map((c: any) => c.id).filter(Boolean);
        setSelectedCategoryIds(ids);
        setCategoryRequired(true);
        setStep('upload');
        const top = data.suggestedCategories[0];
        toast(
          top?.confidence
            ? `AI определил: ${top.name} (уверенность ${Math.round(top.confidence)}%). Подтвердите или измените выбор.`
            : 'AI определил несколько направлений. Подтвердите выбор.',
          { icon: '🤖', duration: 6000 }
        );
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          });
        });
        return;
      }

      // ─── Если AI не уверен → задаёт уточняющие вопросы ──
      if (data?.needsClarification && Array.isArray(data.clarifyingQuestions) && data.clarifyingQuestions.length > 0) {
        setClarifyQuestions(data.clarifyingQuestions);
        setClarifyAnswers({});
        setAnalysisResult(data);
        setStep('clarify');
        toast(data.message || 'Уточните детали, чтобы смета была точной', { icon: '💡', duration: 5000 });
        return;
      }

      setAnalysisResult(data);
      setStep('variants');

      if (data?.category) {
        const dirs = data.detectedCategories && data.detectedCategories.length > 1
          ? data.detectedCategories.map((c: any) => c.name).join(' + ')
          : data.category.name;
        setTitle(`${dirs} — ФотоЗаказ`);
      }

      const direCount = data?.detectedCategories?.length ?? 1;
      if (direCount > 1) {
        toast.success(`AI определил ${direCount} направлений работ — собрана общая смета`);
      } else {
        toast.success('AI-анализ завершён! Выберите вариант.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Ошибка AI-анализа';
      console.error('AI analyze error:', err.response?.data || err);

      // Если AI не смог определить категорию — подсвечиваем секцию выбора и скроллим к ней
      const lower = String(msg).toLowerCase();
      if (lower.includes('категори') && (lower.includes('определ') || lower.includes('вручн'))) {
        setCategoryRequired(true);
        setStep('upload');
        toast.error('Не удалось определить категорию. Отметьте подходящую галочкой ниже.', { duration: 6000 });
        // Двойной rAF + небольшая задержка — гарантирует, что секция уже отрендерена
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          });
        });
      } else {
        toast.error(msg);
        setStep('upload');
      }
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
      // Загружаем фото на сервер при создании заказа
      const orderImages: string[] = [];
      for (const file of imageFiles) {
        try {
          const formData = new FormData();
          formData.append('photo', file);
          const res = await photosApi.upload(formData);
          const url = res.data.data?.url;
          if (url) {
            // Принимаем любой URL — обычный или base64 data URL
            orderImages.push(url);
          }
        } catch {
          console.warn('Ошибка загрузки фото при создании заказа');
        }
      }
      // Если серверная загрузка не удалась — генерируем base64 из файлов
      if (orderImages.length === 0 && imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            orderImages.push(dataUrl);
          } catch {
            // пропускаем файл
          }
        }
      }
      const deadlineStr = timing === 'date' && deadline ? `${deadline}${deadlineTime ? 'T' + deadlineTime : ''}` : undefined;

      const result = await instantOrderApi.create({
        templateId: selectedVariant.id,
        title,
        description: description || voiceText || title,
        additionalWishes: additionalWishes || undefined,
        voiceDescription: voiceText || undefined,
        address,
        city: city || undefined,
        images: orderImages.length > 0 ? orderImages : [],
        deadline: deadlineStr,
        isUrgent,
        offerAccepted,
      });

      const order = result.data.data;
      toast.success(additionalWishes ? 'Заказ создан и отправлен на модерацию!' : 'Заказ создан и опубликован!');
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
      {/* ─── Urgent banner ─── */}
      {isUrgent && (
        <div className="bg-red-600 text-white py-3 px-4 text-center font-bold text-sm md:text-base flex items-center justify-center gap-2">
          <AlertTriangle size={20} className="shrink-0" />
          Срочный вызов — надбавка +40% за срочность
        </div>
      )}

      {/* ─── Header ─── */}
      <div className={`bg-gradient-to-r ${isUrgent ? 'from-red-600 to-red-700' : 'from-orange-500 to-amber-500'} text-white py-6 md:py-8`}>
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-white/80 hover:text-white mb-3 text-sm min-h-[44px] min-w-[44px]">
            <ArrowLeft size={18} className="mr-1" /> Назад
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
            <Sparkles size={28} /> {isUrgent ? 'Срочный вызов мастера' : 'Создать заказ за 30 секунд'}
          </h1>
          <p className="text-white/80 mt-1 text-sm md:text-base">
            Загрузите фото → опишите голосом → AI подберёт варианты
          </p>

          {/* ─── Перекрёстная ссылка на детальный режим ─── */}
          <Link
            to="/orders/create"
            className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs md:text-sm font-medium transition-colors min-h-[36px]"
          >
            <ListChecks size={16} /> Знаю что нужно — оформить детально
          </Link>

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
              <h2 className="text-lg md:text-xl font-bold mb-4 dark:text-white flex items-center gap-2 flex-wrap">
                <Camera size={22} className="text-orange-500" />
                Загрузите фото проблемы
                <span className="text-sm text-gray-400 font-normal">(до 10 шт., необязательно)</span>
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
                  onClick={() => setShowCamera(true)}
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

              {showCamera && (
                <CameraCapture
                  onCapture={(file) => addFiles([file])}
                  onClose={() => setShowCamera(false)}
                />
              )}
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
                      <span>Нажмите и говорите</span>
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
                <p className="text-xs text-gray-400 mt-1">Вы можете свободно редактировать распознанный текст</p>
              )}
            </div>

            {/* ─── Category (selectable grid) — сразу под описанием, чтобы видно при ошибке ─── */}
            <div
              ref={categorySectionRef}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm border-2 transition-all ${
                categoryRequired && selectedCategoryIds.length === 0
                  ? 'border-red-500 ring-4 ring-red-500/20 animate-pulse'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {categoryRequired && selectedCategoryIds.length === 0 && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3">
                  <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <strong>ИИ не смог определить категорию.</strong> Отметьте одну или несколько подходящих галочек ниже —
                    это нужно для составления точной сметы.
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between mb-1 gap-3">
                <h2 className="text-lg font-bold dark:text-white">
                  Категория{' '}
                  <span className="text-sm text-gray-400 font-normal">
                    {selectedCategoryIds.length > 0
                      ? `(выбрано: ${selectedCategoryIds.length})`
                      : '(AI определит автоматически)'}
                  </span>
                </h2>
                {selectedCategoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedCategoryIds([]); setCategoryRequired(false); }}
                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold whitespace-nowrap"
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Можно оставить пусто — ИИ определит сам по фото и описанию. Или отметьте <strong>несколько</strong> направлений для точности сметы.
              </p>

              {categories.length === 0 ? (
                <div className="text-sm text-gray-400 py-3 text-center">Загрузка категорий…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map((cat) => {
                    const checked = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategoryIds((prev) =>
                            prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id]
                          );
                          setCategoryRequired(false);
                        }}
                        className={[
                          'flex items-center gap-2.5 px-3 py-3 min-h-[60px] rounded-xl border-2 text-left transition-all',
                          checked
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-md shadow-orange-500/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-700',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex items-center justify-center w-5 h-5 rounded-md border-2 shrink-0 transition-all',
                            checked
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600',
                          ].join(' ')}
                        >
                          {checked && <Check size={14} strokeWidth={3} />}
                        </span>
                        <CategoryIcon name={cat.icon || 'Folder'} size="sm" />
                        <span
                          className={`text-sm font-medium line-clamp-2 ${
                            checked ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
                  Как можно скорее
                </button>
                <button
                  onClick={() => setTiming('date')}
                  className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm md:text-base transition-all ${
                    timing === 'date'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Выбрать дату
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

            {/* ─── Analyze button ─── */}
            <button
              onClick={handleAnalyze}
              disabled={
                loading ||
                (images.length === 0 &&
                  description.trim().length === 0 &&
                  voiceText.trim().length === 0 &&
                  selectedCategoryIds.length === 0)
              }
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
              Нужна индивидуальная оценка мастера
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

        {/* ═══ STEP 2.5a: Вызов мастера на замер (когда работа требует обмера) ═══ */}
        {step === 'clarify' && analysisResult?.needsOnSiteEstimation && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={22} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg dark:text-white mb-1">
                    Нужны замеры на месте
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {analysisResult.message ||
                      'Без точной площади/объёма смету не построить. Мастер приедет, замерит и составит точную смету. Стоимость выезда указана в тарифах платформы и пойдёт в зачёт работ, если вы согласитесь со сметой.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  // Переход на форму выездной оценки с предзаполненными данными:
                  // категория (если AI её распознал), описание и фотографии.
                  const primaryCategory =
                    analysisResult?.partialMatches?.[0]?.id || analysisResult?.category?.id || undefined;
                  navigate('/estimation/create', {
                    state: {
                      categoryId: primaryCategory,
                      description: description || voiceText || '',
                      images: images,
                      title: title || undefined,
                    },
                  });
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl py-3 hover:opacity-90 transition"
              >
                Вызвать мастера на замер
              </button>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="w-full text-sm text-gray-500 dark:text-gray-400 mt-3 hover:underline"
              >
                Назад — уточнить описание самостоятельно
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2.5: Clarifying questions (когда AI не уверен) ═══ */}
        {step === 'clarify' && clarifyQuestions.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-5 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={22} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-lg dark:text-white mb-1">
                    Уточните несколько деталей
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {analysisResult?.message ||
                      'AI не смог точно определить характер работ. Ответьте на пару вопросов — соберём точную смету.'}
                  </p>
                </div>
              </div>
            </div>

            {clarifyQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <label className="block font-semibold dark:text-white mb-1">{q.question}</label>
                {q.hint && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{q.hint}</p>
                )}

                {/* multiselect */}
                {q.type === 'multiselect' && q.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {q.options.map((opt) => {
                      const arr = (clarifyAnswers[q.id] as string[]) || [];
                      const checked = arr.includes(opt.value);
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                            checked
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600'
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...arr, opt.value]
                                : arr.filter((v) => v !== opt.value);
                              setClarifyAnswers({ ...clarifyAnswers, [q.id]: next });
                            }}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-sm dark:text-gray-200">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* select */}
                {q.type === 'select' && q.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {q.options.map((opt) => {
                      const checked = clarifyAnswers[q.id] === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                            checked
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600'
                              : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={checked}
                            onChange={() => setClarifyAnswers({ ...clarifyAnswers, [q.id]: opt.value })}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-sm dark:text-gray-200">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* free text */}
                {q.type === 'text' && (
                  <textarea
                    className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-orange-400 focus:outline-none resize-none"
                    rows={3}
                    placeholder={q.placeholder}
                    value={(clarifyAnswers[q.id] as string) || ''}
                    onChange={(e) => setClarifyAnswers({ ...clarifyAnswers, [q.id]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('upload')}
                className="px-5 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold"
              >
                ← Назад
              </button>
              <button
                onClick={handleSubmitClarification}
                disabled={loading}
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Анализирую…' : 'Пересчитать смету →'}
              </button>
            </div>
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
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(analysisResult.detectedCategories?.length ?? 1) > 1
                    ? `Определено направлений: ${analysisResult.detectedCategories!.length}`
                    : 'Категория определена'}
                </p>
                <p className="font-bold dark:text-white text-base">{analysisResult.category.name}</p>
              </div>
              {typeof analysisResult.aiConfidence === 'number' && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    analysisResult.aiConfidence >= 85
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : analysisResult.aiConfidence >= 70
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title="Уверенность AI в определении категории"
                >
                  AI {Math.round(analysisResult.aiConfidence)}%
                </span>
              )}
              {analysisResult.detectedFromPhoto && typeof analysisResult.aiConfidence !== 'number' && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full font-medium">
                  Определено AI
                </span>
              )}
            </div>

            {/* AI Summary — что увидел AI на фото */}
            {analysisResult.aiSummary && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1">
                  🤖 AI разобрал ваш запрос:
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {analysisResult.aiSummary}
                </p>
                {analysisResult.urgency && analysisResult.urgency !== 'normal' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      analysisResult.urgency === 'emergency'
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : analysisResult.urgency === 'urgent'
                        ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}>
                      {analysisResult.urgency === 'emergency' ? '🚨 АВАРИЯ' :
                       analysisResult.urgency === 'urgent' ? '⚡ Срочно' :
                       '🕐 Гибко'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Чипы всех найденных направлений (когда их > 1) */}
            {analysisResult.detectedCategories && analysisResult.detectedCategories.length > 1 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  В смете учтены работы по всем направлениям:
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.detectedCategories.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-700 shadow-sm"
                    >
                      ✓ {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                        РЕКОМЕНДУЕМ
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

                    {/* ─── Подробный список услуг (раскрывающийся) ─── */}
                    {variant.taskIds && variant.taskIds.length > 0 && (() => {
                      const tasksInVariant = (analysisResult.allTasks || []).filter((t) =>
                        variant.taskIds.includes(t.id)
                      );
                      if (tasksInVariant.length === 0) return null;

                      const isOpen = !!expandedVariants[variant.id];
                      // Группируем по категории (для мульти-категорий)
                      const grouped = tasksInVariant.reduce<Record<string, typeof tasksInVariant>>(
                        (acc, t) => {
                          const key = t.categoryName || 'Услуги';
                          (acc[key] ||= []).push(t);
                          return acc;
                        },
                        {}
                      );

                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedVariants((prev) => ({ ...prev, [variant.id]: !prev[variant.id] }));
                            }}
                            className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors py-1"
                          >
                            <span className="flex items-center gap-2">
                              <ListChecks size={16} className="text-orange-500" />
                              Подробный список услуг ({tasksInVariant.length})
                            </span>
                            <ChevronDown
                              size={18}
                              className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {isOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 space-y-3 animate-fade-in"
                            >
                              {Object.entries(grouped).map(([catName, tasks]) => (
                                <div key={catName}>
                                  {Object.keys(grouped).length > 1 && (
                                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1.5">
                                      {catName}
                                    </p>
                                  )}
                                  <ul className="space-y-1.5">
                                    {tasks.map((t) => (
                                      <li
                                        key={t.id}
                                        className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2"
                                      >
                                        <Check size={14} className="text-green-500 shrink-0 mt-0.5" strokeWidth={3} />
                                        <div className="flex-1 min-w-0">
                                          <p className="leading-snug">{t.name}</p>
                                          {(t.subcategoryName || t.estimatedTime) && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                              {[t.subcategoryName, t.estimatedTime].filter(Boolean).join(' • ')}
                                            </p>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic pt-1">
                                Все эти работы будут выполнены мастером по фиксированной цене.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
              Это не подходит — нужна индивидуальная оценка
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
                  Срочный заказ <span className="text-sm text-orange-500">(+40% к цене)</span>
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
                <><CheckCircle size={24} /> Создать заказ</>
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
              Нужна индивидуальная оценка мастера
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
