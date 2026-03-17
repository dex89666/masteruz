// ============================================
// MasterUz — Image Upload Component
// Загрузка изображений с превью
// ============================================

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from '../i18n';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  onUpload: (file: File) => void;
  maxSizeMB?: number;
  accept?: string;
  preview?: string | null;
  onRemove?: () => void;
  label?: string;
  compact?: boolean;
}

export function ImageUpload({
  onUpload,
  maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp',
  preview,
  onRemove,
  label,
  compact = false,
}: ImageUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const displayPreview = preview || localPreview;

  const handleFile = useCallback((file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`${t('common.error')}: Max ${maxSizeMB}MB`);
      return;
    }

    // Validate type
    const allowedTypes = accept.split(',').map(t => t.trim());
    if (!allowedTypes.includes(file.type)) {
      toast.error(`${t('common.error')}: ${accept}`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    onUpload(file);
  }, [maxSizeMB, accept, onUpload, t]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    setLocalPreview(null);
    onRemove?.();
  }

  if (displayPreview) {
    return (
      <div className="relative inline-block">
        <img
          src={displayPreview}
          alt="Upload preview"
          className={`${compact ? 'w-20 h-20' : 'w-full max-w-xs h-48'} object-cover rounded-xl ring-1 ring-gray-200 dark:ring-gray-700`}
        />
        <button
          onClick={handleRemove}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div>
      {label && <label className="label dark:text-gray-300">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`${compact ? 'w-20 h-20' : 'w-full py-8'} flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-gray-50 dark:bg-gray-800'
        }`}
      >
        {compact ? (
          <Upload size={20} className="text-gray-400 dark:text-gray-500" />
        ) : (
          <>
            <ImageIcon size={32} className="text-gray-400 dark:text-gray-500 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.dragOrClick')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Max {maxSizeMB}MB · JPEG, PNG, WebP
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
