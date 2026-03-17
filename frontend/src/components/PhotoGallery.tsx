// ============================================
// MasterUz — PhotoGallery (фото до/после работы)
// ============================================

import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { OrderPhoto } from '../types';

interface PhotoGalleryProps {
  photos: OrderPhoto[];
  orderId?: string;
  canAdd?: boolean;
  isParticipant?: boolean;
  onAdd?: (type: 'before' | 'after') => void;
  onPhotosChange?: () => void;
}

export function PhotoGallery({ photos, canAdd, onAdd }: PhotoGalleryProps) {
  const { t } = useTranslation();
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState(0);

  const beforePhotos = photos.filter((p) => p.type === 'before');
  const afterPhotos = photos.filter((p) => p.type === 'after');
  const allPhotos = [...beforePhotos, ...afterPhotos];

  function openLightbox(url: string) {
    const idx = allPhotos.findIndex((p) => p.url === url);
    setViewIndex(idx >= 0 ? idx : 0);
    setViewPhoto(url);
  }

  function navigate(dir: 1 | -1) {
    const newIdx = (viewIndex + dir + allPhotos.length) % allPhotos.length;
    setViewIndex(newIdx);
    setViewPhoto(allPhotos[newIdx].url);
  }

  if (photos.length === 0 && !canAdd) return null;

  return (
    <div className="card mb-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Camera size={18} className="text-primary-600" />
        {t('photos.title')}
      </h3>

      {/* Before */}
      {(beforePhotos.length > 0 || canAdd) && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase">{t('photos.before')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {beforePhotos.map((photo) => (
              <div key={photo.id} className="relative shrink-0 group cursor-pointer" onClick={() => openLightbox(photo.url)}>
                <img
                  src={photo.url}
                  alt={photo.caption || ''}
                  className="w-20 h-20 rounded-xl object-cover ring-1 ring-gray-200 group-hover:ring-primary-300 transition-all"
                />
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                  <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {canAdd && (
              <button
                onClick={() => onAdd?.('before')}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors shrink-0"
              >
                <Camera size={16} />
                <span className="text-[9px] mt-0.5">{t('photos.add')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* After */}
      {(afterPhotos.length > 0 || canAdd) && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase">{t('photos.after')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {afterPhotos.map((photo) => (
              <div key={photo.id} className="relative shrink-0 group cursor-pointer" onClick={() => openLightbox(photo.url)}>
                <img
                  src={photo.url}
                  alt={photo.caption || ''}
                  className="w-20 h-20 rounded-xl object-cover ring-2 ring-green-200 group-hover:ring-green-400 transition-all"
                />
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                  <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {canAdd && (
              <button
                onClick={() => onAdd?.('after')}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-green-300 flex flex-col items-center justify-center text-green-400 hover:border-green-500 hover:text-green-600 transition-colors shrink-0"
              >
                <Camera size={16} />
                <span className="text-[9px] mt-0.5">{t('photos.add')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Comparison side-by-side */}
      {beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-primary-600 mb-2">{t('photos.comparison')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400 mb-1 text-center">{t('photos.before')}</p>
              <img src={beforePhotos[0].url} alt="" className="w-full h-32 rounded-xl object-cover ring-1 ring-gray-200" />
            </div>
            <div>
              <p className="text-[10px] text-green-500 mb-1 text-center">{t('photos.after')}</p>
              <img src={afterPhotos[0].url} alt="" className="w-full h-32 rounded-xl object-cover ring-2 ring-green-200" />
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {viewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewPhoto(null)}
        >
          <button
            onClick={() => setViewPhoto(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={24} />
          </button>
          {allPhotos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 bg-black/30 rounded-full"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 bg-black/30 rounded-full"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <img
            src={viewPhoto}
            alt=""
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-6 text-white/60 text-xs">
            {viewIndex + 1} / {allPhotos.length}
          </p>
        </div>
      )}
    </div>
  );
}
