// ============================================
// MasterUz — Upload Middleware (Multer)
// Disk storage — файлы сохраняются в config.upload.dir
// ============================================

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';
import fs from 'fs';

// Создаём директорию для загрузок
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
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

// ─── Медиа-загрузка (изображения + видео, до 60 МБ) ───────
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm'];
const MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm',
];

const mediaFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!MEDIA_TYPES.includes(file.mimetype) || !MEDIA_EXTENSIONS.includes(ext)) {
    cb(new ApiError(400, 'Разрешены изображения (JPEG/PNG/WebP) и видео (MP4/MOV/WebM)'));
  } else {
    cb(null, true);
  }
};

export const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 60 * 1024 * 1024, // 60 МБ — достаточно для коротких видео с телефона
    files: 1,
  },
});

// ─── Аудио для распознавания речи (Whisper) ──────────
// Хранение в памяти: на S3/диск не пишем, сразу отдаём в OpenAI.
const AUDIO_TYPES = [
  'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/3gpp',
];

const audioFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Многие браузеры присылают audio/webm;codecs=opus — обрезаем суффикс
  const baseType = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  if (AUDIO_TYPES.includes(baseType)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `Неподдерживаемый аудиоформат: ${file.mimetype}`));
  }
};

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 МБ — голосовое сообщение до ~5 мин
    files: 1,
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
 * Возвращает публичный URL загруженного файла (multer уже сохранил его на диск).
 */
export async function saveUploadedFile(file: Express.Multer.File): Promise<string> {
  return `/uploads/${file.filename}`;
}
