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

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Разрешены только изображения (JPEG, PNG, WebP) и PDF'));
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
  if (isVercel && process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob — загрузка через REST API
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    
    const response = await fetch(
      `https://blob.vercel-storage.com/${filename}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          'x-content-type': file.mimetype,
          'x-cache-control-max-age': '31536000',
        },
        body: file.buffer,
      }
    );
    
    if (!response.ok) {
      throw new ApiError(500, 'Ошибка загрузки файла');
    }
    
    const blob = (await response.json()) as { url: string };
    return blob.url; // Полный URL к файлу на CDN
  }
  
  // VPS — файл уже сохранён multer'ом на диск
  return `/uploads/${file.filename}`;
}
