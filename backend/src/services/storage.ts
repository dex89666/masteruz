// ============================================
// MasterUz — Storage adapter (local | S3-совместимый)
// ────────────────────────────────────────────
// При STORAGE_DRIVER=s3 — заливает файлы в S3-совместимое хранилище
// (Cloudflare R2 / Backblaze B2 / AWS S3). Иначе — оставляет на локальном диске
// (как сейчас). Прозрачно для роутов: возвращает публичный URL.
//
// ENV:
//   STORAGE_DRIVER=local|s3        (default: local)
//   S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com
//   S3_REGION=auto                 (R2: auto)
//   S3_BUCKET=masteruz-uploads
//   S3_ACCESS_KEY_ID=…
//   S3_SECRET_ACCESS_KEY=…
//   S3_PUBLIC_URL=https://cdn.masteruz.uz   ← публичный CDN-домен
// ============================================

import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import { logger } from '../utils/logger.js';

const DRIVER = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

interface PutArgs {
  key: string;            // относительный путь, напр. "photos/2026/abc.jpg"
  body: Buffer;
  contentType: string;
}

interface GetResult {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

interface StorageAdapter {
  put(args: PutArgs): Promise<string>; // возвращает публичный URL
  get(key: string): Promise<GetResult | null>; // стрим объекта (null — не найден)
  remove(key: string): Promise<void>;
}

// ─── LOCAL ──────────────────────────────────────────────
class LocalAdapter implements StorageAdapter {
  constructor(private uploadDir: string) {}

  async put({ key, body }: PutArgs): Promise<string> {
    const full = path.join(this.uploadDir, key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, body);
    return `/uploads/${key}`;
  }

  async get(key: string): Promise<GetResult | null> {
    const full = path.join(this.uploadDir, key);
    if (!fs.existsSync(full)) return null;
    return { body: fs.createReadStream(full) };
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.promises.unlink(path.join(this.uploadDir, key));
    } catch {
      /* ignore */
    }
  }
}

// ─── S3 (lazy-loaded, чтобы local-режим не тянул aws-sdk) ──
class S3Adapter implements StorageAdapter {
  private client: any;
  private bucket: string = '';
  private publicUrl: string = '';
  private S3: any;

  static async create(): Promise<S3Adapter> {
    // Динамический импорт — пакет ставится только при STORAGE_DRIVER=s3
    const mod = await import('@aws-sdk/client-s3' as string);
    const instance = new S3Adapter();
    instance.S3 = {
      PutObjectCommand: mod.PutObjectCommand,
      GetObjectCommand: mod.GetObjectCommand,
      DeleteObjectCommand: mod.DeleteObjectCommand,
    };
    instance.client = new mod.S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'auto',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    instance.bucket = process.env.S3_BUCKET!;
    instance.publicUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');
    return instance;
  }

  async put({ key, body, contentType }: PutArgs): Promise<string> {
    await this.client.send(
      new this.S3.PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return this.publicUrl ? `${this.publicUrl}/${key}` : `/uploads/${key}`;
  }

  async get(key: string): Promise<GetResult | null> {
    try {
      const res = await this.client.send(
        new this.S3.GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        body: res.Body as Readable,
        contentType: res.ContentType,
        contentLength: res.ContentLength,
      };
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
      logger.warn({ err, key }, '[storage] ошибка чтения из S3');
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(new this.S3.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      logger.warn({ err, key }, '[storage] не удалось удалить из S3');
    }
  }
}

// ─── Factory ────────────────────────────────────────────
let adapter: StorageAdapter | null = null;
let initPromise: Promise<StorageAdapter> | null = null;

async function init(): Promise<StorageAdapter> {
  if (DRIVER === 's3') {
    try {
      const s3 = await S3Adapter.create();
      logger.info({ bucket: process.env.S3_BUCKET, endpoint: process.env.S3_ENDPOINT }, '☁️ Storage: S3');
      return s3;
    } catch (err) {
      logger.error({ err }, '[storage] S3 init failed, fallback на local');
    }
  }
  const local = new LocalAdapter(path.resolve(process.env.UPLOAD_DIR ?? './uploads'));
  logger.info({ dir: process.env.UPLOAD_DIR ?? './uploads' }, '💾 Storage: local');
  return local;
}

export async function getStorage(): Promise<StorageAdapter> {
  if (adapter) return adapter;
  if (!initPromise) initPromise = init().then((a) => (adapter = a));
  return initPromise;
}
