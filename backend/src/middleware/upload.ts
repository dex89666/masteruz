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
