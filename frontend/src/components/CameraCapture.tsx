// ============================================
// MasterUz — CameraCapture
// Живой захват фото через getUserMedia.
// Открывает реальную камеру устройства, а не галерею.
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Check, AlertTriangle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type Facing = 'environment' | 'user';

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (mode: Facing) => {
    setError(null);
    setIsReady(false);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsReady(true);
      }
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setError('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError('nocamera');
      else setError('unsupported');
    }
  }, [stopStream]);

  useEffect(() => {
    startStream(facing);
    return () => stopStream();
  }, [facing, startStream, stopStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPreview({ url: URL.createObjectURL(blob), file });
    }, 'image/jpeg', 0.92);
  }, [isReady]);

  const handleConfirm = () => {
    if (!preview) return;
    onCapture(preview.file);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    onClose();
  };

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleFallback = () => fallbackInputRef.current?.click();

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    onClose();
  };

  const errorMessage =
    error === 'denied'
      ? 'Доступ к камере запрещён. Разрешите доступ в настройках браузера или выберите фото из галереи.'
      : error === 'nocamera'
        ? 'Камера не найдена. Подключите камеру или выберите фото из галереи.'
        : 'Ваш браузер или приложение не поддерживает прямой доступ к камере. Используйте съёмку через системный выбор файла.';

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Закрыть"
        >
          <X size={22} />
        </button>
        <span className="text-sm font-medium">Сделать фото</span>
        <button
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={!!error}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
          aria-label="Переключить камеру"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center text-center px-6 max-w-md text-white">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-orange-400" />
            </div>
            <p className="text-base mb-6">{errorMessage}</p>
            <button
              onClick={handleFallback}
              className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors"
            >
              Выбрать фото
            </button>
            <input
              ref={fallbackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFallbackChange}
            />
          </div>
        ) : preview ? (
          <img src={preview.url} alt="Превью" className="max-w-full max-h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`max-w-full max-h-full object-contain ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        )}
      </div>

      {/* Controls */}
      {!error && (
        <div className="bg-black/60 px-6 py-6 flex items-center justify-center gap-8">
          {preview ? (
            <>
              <button
                onClick={handleRetake}
                className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Переснять"
              >
                <RefreshCw size={24} />
              </button>
              <button
                onClick={handleConfirm}
                className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-xl"
                aria-label="Использовать фото"
              >
                <Check size={36} />
              </button>
              <div className="w-14 h-14" />
            </>
          ) : (
            <button
              onClick={handleCapture}
              disabled={!isReady}
              className="w-20 h-20 rounded-full bg-white hover:bg-gray-100 text-gray-900 flex items-center justify-center transition-colors shadow-xl disabled:opacity-50"
              aria-label="Сделать снимок"
            >
              <Camera size={32} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
