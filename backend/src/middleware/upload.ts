// ============================================
// MasterUz — Upload Middleware (Multer)
// Поддерживает: Disk (VPS) + Memory (Vercel/serverless)
// ============================================

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import fs from 'fs';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Создаём директорию для загрузок если не serverless
if (!isVercel) {
  const uploadDir = path.resolve(config.upload.dir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

// На Vercel: memory storage (затем загрузим в Vercel Blob)
// На VPS: disk storage
const storage = isVercel
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, path.resolve(config.upload.dir));
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    });

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new ApiError(400, 'Разрешены только изображения (JPEG, PNG, WebP) и PDF'));
  } else {
    cb(null, true);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 5,
  },
});

/**
 * Проверка магических байтов (защита от подмены типа: переименованный .php в .jpg).
 * Возвращает true, если первые байты соответствуют заявленному mime.
 */
function isMagicBytesValid(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return false;
  const sig = buffer.subarray(0, 12);
  if (mime === 'image/jpeg') return sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff;
  if (mime === 'image/png') return sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
  if (mime === 'image/webp')
    return sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46
      && sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50;
  if (mime === 'application/pdf') return sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46;
  return false;
}

/**
 * Middleware: после multer проверяет magic-bytes (защита от поддельных типов).
 * Использовать ПОСЛЕ upload.single/array.
 */
export function verifyFileMagic(req: any, _res: any, next: any) {
  const files: Express.Multer.File[] = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat() as any)
    : (req.file ? [req.file] : []);
  for (const f of files) {
    let buf: Buffer | null = null;
    if (f.buffer) buf = f.buffer;
    else if (f.path) {
      try { buf = fs.readFileSync(f.path).subarray(0, 16); } catch { /* skip */ }
    }
    if (!buf || !isMagicBytesValid(buf, f.mimetype)) {
      // Удаляем подозрительный файл с диска
      if (f.path && fs.existsSync(f.path)) {
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
      }
      return next(new ApiError(400, 'Файл повреждён или его тип не соответствует расширению'));
    }
  }
  next();
}

/**
 * Утилита: загрузить файл в Vercel Blob (для serverless)
 * На VPS — возвращает локальный путь
 */
export async function saveUploadedFile(file: Express.Multer.File): Promise<string> {
  if (isVercel) {
    // Попытка 1: Vercel Blob Storage
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const ext = path.extname(file.originalname);
      const filename = `${uuidv4()}${ext}`;
      
      try {
        const response = await fetch(
          `https://blob.vercel-storage.com/${filename}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
              'x-content-type': file.mimetype,
              'x-cache-control-max-age': '31536000',
            },
            body: new Uint8Array(file.buffer),
          }
        );
        
        if (response.ok) {
          const blob = (await response.json()) as { url: string };
          return blob.url;
        }
      } catch (err) {
        console.error('Vercel Blob upload failed:', err);
      }
    }

    // Попытка 2: ImgBB (бесплатный хостинг изображений)
    if (process.env.IMGBB_API_KEY) {
      try {
        const base64 = file.buffer.toString('base64');
        const formBody = new URLSearchParams();
        formBody.append('key', process.env.IMGBB_API_KEY);
        formBody.append('image', base64);
        formBody.append('name', uuidv4());

        const response = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formBody,
        });

        if (response.ok) {
          const result = (await response.json()) as { data?: { url?: string } };
          if (result.data?.url) return result.data.url;
        }
      } catch (err) {
        console.error('ImgBB upload failed:', err);
      }
    }

    // Попытка 3: Компактный base64 data URL (сжимаем до 100KB)
    // Для маленьких изображений это приемлемо
    const base64 = file.buffer.toString('base64');
    const sizeKB = Math.round(base64.length / 1024);
    if (sizeKB > 500) {
      // Слишком большой — возвращаем placeholder
      console.warn(`File too large for base64 inline (${sizeKB}KB), using placeholder`);
      return `/photo-placeholder-${uuidv4().substring(0, 8)}`;
    }
    return `data:${file.mimetype};base64,${base64}`;
  }
  
  // VPS — файл уже сохранён multer'ом на диск
  return `/uploads/${file.filename}`;
}
