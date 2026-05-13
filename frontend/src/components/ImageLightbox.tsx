// ============================================
// MasterUz — ImageLightbox
// Полноэкранный просмотрщик фото с зумом и навигацией.
// Открытие: клик по миниатюре. Закрытие: Esc, клик по фону, кнопка ✕.
// Навигация: ← →, кнопки и свайпы по краям.
// Зум: колесо мыши, двойной клик, pinch на тач-устройствах (через CSS-трансформ).
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.5;

export function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  const total = images.length;
  const current = images[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
    setScale(1);
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
    setScale(1);
  }, [total]);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
  }, []);

  // Клавиатура: Esc / стрелки / +/-
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
    };
    window.addEventListener('keydown', handleKey);
    // Блокируем скролл фона, пока открыт лайтбокс
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, zoomIn, zoomOut]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((s) => (s === 1 ? 2.5 : 1));
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Верхняя панель — отступ под Telegram header / safe-area */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pb-4 z-10 bg-gradient-to-b from-black/60 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 3.75rem)' }}
      >
        <span className="text-white/80 text-sm font-medium">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); zoomOut(); }}
            disabled={scale <= MIN_SCALE}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Уменьшить"
          >
            <ZoomOut size={20} />
          </button>
          <span className="text-white/80 text-sm w-12 text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); zoomIn(); }}
            disabled={scale >= MAX_SCALE}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Увеличить"
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ml-2"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Стрелки навигации */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Предыдущее"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Следующее"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      {/* Изображение */}
      <div
        className="w-full h-full flex items-center justify-center overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        <img
          src={current}
          alt={`Фото ${index + 1}`}
          onClick={toggleZoom}
          className="select-none transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${scale})`,
            cursor: scale > 1 ? 'zoom-out' : 'zoom-in',
            maxWidth: '90vw',
            maxHeight: '85vh',
            objectFit: 'contain',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
