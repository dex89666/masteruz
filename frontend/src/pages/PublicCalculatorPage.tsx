// ============================================
// MasterUz — Публичный AI-калькулятор цены
// Lead-magnet: аноним фоткает проблему → узнаёт цену → регистрируется
// Доступен БЕЗ авторизации и без consent-модала (viral landing)
// ============================================

import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, Camera, X, Loader2, ArrowRight, ShieldCheck,
  Clock, Wand2, ImagePlus, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { instantOrderApi } from '../api/client';

// ─── Типы ответа ─────────────────────────────
interface EstimateVariant {
  tier: string;
  tierLabel: string;
  title: string;
  estimatedPrice: number;
  estimatedDays: number;
}

interface EstimateResult {
  category: { name: string; slug: string; icon?: string | null } | null;
  confidence: number | null;
  summary?: string;
  urgency?: string;
  priceRange: { min: number; max: number } | null;
  needsOnSite: boolean;
  variants: EstimateVariant[];
  materials: Array<{ name: string }>;
}

// ─── Форматирование суммы ────────────────────
const formatSum = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} сум`;

// ─── Сжатие фото → base64 data URL (для AI без загрузки на сервер) ──
async function fileToCompressedDataUrl(file: File, maxSide = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('canvas')); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

const MAX_PHOTOS = 5;

export function PublicCalculatorPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previews, setPreviews] = useState<string[]>([]);
  const [dataUrls, setDataUrls] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const room = MAX_PHOTOS - previews.length;
    if (room <= 0) { toast.error(`Максимум ${MAX_PHOTOS} фото`); return; }
    const slice = files.slice(0, room).filter((f) => f.type.startsWith('image/'));
    for (const file of slice) {
      if (file.size > 12 * 1024 * 1024) { toast.error('Файл слишком большой (макс. 12 МБ)'); continue; }
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        setPreviews((p) => [...p, dataUrl]);
        setDataUrls((d) => [...d, dataUrl]);
      } catch { toast.error('Не удалось обработать фото'); }
    }
  }, [previews.length]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (e.target) e.target.value = '';
  };

  const removePhoto = (i: number) => {
    setPreviews((p) => p.filter((_, idx) => idx !== i));
    setDataUrls((d) => d.filter((_, idx) => idx !== i));
  };

  const canSubmit = (dataUrls.length > 0 || description.trim().length >= 5) && !loading;

  const handleEstimate = async () => {
    if (!canSubmit) {
      toast.error('Добавьте фото или опишите задачу');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await instantOrderApi.publicEstimate({
        images: dataUrls,
        description: description.trim() || undefined,
      });
      setResult(res.data.data as EstimateResult);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Не удалось рассчитать. Попробуйте ещё раз.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Переход в воронку заказа: сохраняем контекст, ведём на регистрацию
  const goToOrder = () => {
    try {
      sessionStorage.setItem('calc_prefill', JSON.stringify({
        description: description.trim(),
        categorySlug: result?.category?.slug,
      }));
    } catch { /* noop */ }
    navigate('/login', { state: { from: '/instant-order' } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-extrabold text-lg dark:text-white">
            <span className="inline-flex w-8 h-8 rounded-xl bg-primary-600 text-white items-center justify-center">M</span>
            MasterUz
          </Link>
          <Link to="/login" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
            Войти
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-24">
        {/* Hero */}
        <section className="text-center pt-10 pb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold mb-4">
            <Sparkles size={14} /> AI-оценка за 30 секунд
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
            Сколько стоит починить <span className="text-primary-600 dark:text-primary-400">это?</span>
          </h1>
          <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Сфотографируйте проблему или опишите словами — искусственный интеллект назовёт
            примерную цену работы в Ташкенте. Бесплатно и без регистрации.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-green-500" /> Без регистрации</span>
            <span className="flex items-center gap-1"><Clock size={14} className="text-primary-500" /> Результат за 30 сек</span>
            <span className="flex items-center gap-1"><MapPin size={14} className="text-amber-500" /> Цены Ташкента 2026</span>
          </div>
        </section>

        {/* Input card */}
        <section className="card p-5 sm:p-6">
          {/* Photos */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-90 hover:bg-black"
                  aria-label="Удалить"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {previews.length < MAX_PHOTOS && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
              >
                {previews.length === 0 ? <Camera size={22} /> : <ImagePlus size={22} />}
                <span className="text-[10px] font-medium">Фото</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleSelect}
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Опишите задачу: «течёт смеситель на кухне», «поклеить обои в комнате 18 м²»…"
            rows={3}
            maxLength={2000}
            className="mt-4 w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* CTA */}
          <button
            onClick={handleEstimate}
            disabled={!canSubmit}
            className="btn-primary w-full mt-4 py-3.5 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={20} className="animate-spin" /> Считаем…</>
            ) : (
              <><Wand2 size={20} /> Узнать цену</>
            )}
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-500 text-center">
            Загружая фото, вы соглашаетесь на обработку данных для AI-оценки.
            Точную стоимость подтвердит мастер.
          </p>
        </section>

        {/* Result */}
        {result && (
          <section className="mt-6 animate-fade-in">
            {result.priceRange ? (
              <div className="card p-6 text-center border-2 border-primary-200 dark:border-primary-800">
                {result.category && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 mb-3">
                    {result.category.icon && <span>{result.category.icon}</span>}
                    {result.category.name}
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">Примерная стоимость работы</p>
                <p className="mt-1 text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
                  {formatSum(result.priceRange.min)}
                  {result.priceRange.max > result.priceRange.min && (
                    <span className="text-gray-400 dark:text-gray-500"> – {formatSum(result.priceRange.max)}</span>
                  )}
                </p>
                {result.summary && (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{result.summary}</p>
                )}

                {result.variants.length > 0 && (
                  <div className="mt-5 grid gap-2 text-left">
                    {result.variants.map((v) => (
                      <div key={v.tier} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{v.title}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {v.tierLabel} · ~{v.estimatedDays} дн.
                          </p>
                        </div>
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-400 shrink-0 ml-3">
                          {formatSum(v.estimatedPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-6 text-center">
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {result.category ? `Похоже на «${result.category.name}»` : 'Нужны замеры на месте'}
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {result.summary || 'Для точного расчёта мастер оценит объём работ на месте — это бесплатно или по тарифу платформы.'}
                </p>
              </div>
            )}

            {/* Conversion CTA */}
            <div className="mt-4 card p-5 bg-primary-600 dark:bg-primary-700 text-white text-center">
              <p className="font-bold text-lg">Готовы решить проблему?</p>
              <p className="text-sm text-primary-100 mt-1">
                Зарегистрируйтесь — проверенные мастера откликнутся с точной ценой,
                а оплата защищена эскроу.
              </p>
              <button
                onClick={goToOrder}
                className="mt-4 w-full bg-white text-primary-700 font-semibold py-3 rounded-xl hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
              >
                Найти мастера <ArrowRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* Trust footer */}
        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
          MasterUz — платформа проверенных мастеров. Оплата через эскроу, гарантия на работы.
        </p>
      </main>
    </div>
  );
}
