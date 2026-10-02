// ============================================
// MasterUz — compressImage
// Ужимает фото перед отправкой: ресайз по длинной стороне + JPEG,
// пока файл не станет меньше maxBytes.
// Фото с телефона весят 4–10 МБ и не пролезают в лимит загрузки (5 МБ),
// а запасной base64 — в лимит поля images (2 МБ) и тела запроса.
// ============================================

/** Предел для фото заказа: проходит и загрузку, и запасной base64 (×1.37). */
export const MAX_ORDER_PHOTO_BYTES = 1024 * 1024;

const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52];
const MIN_DIM = 640;

function loadImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    // HEIC и прочее, что браузер не декодирует.
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob | null> {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const longest = Math.max(w, h);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  // Белый фон — у PNG с прозрачностью в JPEG иначе будет чёрный.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Возвращает JPEG не больше maxBytes: сначала снижает качество, затем размер.
 * Если браузер не может декодировать файл, возвращает его как есть —
 * вызывающий код проверяет размер сам.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  maxBytes = MAX_ORDER_PHOTO_BYTES
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const img = await loadImage(file);
  if (!img) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  let dim = maxDim;
  let best: Blob | null = null;

  while (dim >= MIN_DIM) {
    for (const quality of QUALITY_STEPS) {
      const blob = await encode(img, dim, quality);
      if (!blob) return file;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= maxBytes) {
        // Маленькое исходное фото не раздуваем.
        if (file.size <= blob.size && file.size <= maxBytes) return file;
        return new File([blob], name, { type: 'image/jpeg' });
      }
    }
    dim = Math.round(dim * 0.75);
  }

  return best ? new File([best], name, { type: 'image/jpeg' }) : file;
}
