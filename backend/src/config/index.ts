// ============================================
// MasterUz — Конфигурация приложения
// Агент 1 (Архитектор)
// ============================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Безопасное чтение env. Игнорирует placeholder `__SET_ME__`,
 * чтобы зарезервированные, но ещё не заполненные переменные
 * не считались валидными значениями (пустыми строками работаем как раньше).
 */
const env = (key: string, fallback = ''): string => {
  const v = process.env[key];
  if (!v || v === '__SET_ME__') return fallback;
  return v;
};

export const config = {
  // Сервер
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // База данных
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),

  // JWT — обязательные переменные (без дефолтов!)
  jwt: {
    secret: (() => {
      const v = env('JWT_SECRET');
      if (!v) throw new Error('FATAL: JWT_SECRET is required in environment variables');
      return v;
    })(),
    expiresIn: env('JWT_EXPIRES_IN', '7d'),
    refreshSecret: (() => {
      const v = env('JWT_REFRESH_SECRET');
      if (!v) throw new Error('FATAL: JWT_REFRESH_SECRET is required in environment variables');
      return v;
    })(),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  // Telegram
  telegram: {
    botToken: env('TELEGRAM_BOT_TOKEN'),
    botUsername: (env('TELEGRAM_BOT_USERNAME') || env('TELEGRAM_BOT_NAME')).replace(/^@/, ''),
    miniAppUrl: env('TELEGRAM_MINI_APP_URL', 'https://masteruz.uz'),
    adminChatId: env('ADMIN_TELEGRAM_CHAT_ID'),
  },

  // Yandex Maps
  yandexMaps: {
    apiKey: env('YANDEX_MAPS_API_KEY'),
  },

  // OpenAI — AI Vision для анализа фотозаказов
  openai: {
    apiKey: env('OPENAI_API_KEY'),
    model: env('OPENAI_VISION_MODEL', 'gpt-4o'),
    timeoutMs: parseInt(env('OPENAI_TIMEOUT_MS', '45000'), 10),
  },

  // Click (платежи)
  click: {
    merchantId: env('CLICK_MERCHANT_ID'),
    serviceId: env('CLICK_SERVICE_ID'),
    secretKey: env('CLICK_SECRET_KEY'),
  },

  // Payme (платежи)
  payme: {
    merchantId: env('PAYME_MERCHANT_ID'),
    merchantKey: env('PAYME_MERCHANT_KEY'),
  },

  // Загрузка файлов
  upload: {
    dir: env('UPLOAD_DIR', './uploads'),
    maxFileSize: parseInt(env('MAX_FILE_SIZE', '5242880'), 10),
  },

  // Платформа (значения по умолчанию)
  platform: {
    defaultCommissionRate: parseFloat(env('DEFAULT_COMMISSION_RATE', '15')),
    masterRegistrationFee: parseInt(env('MASTER_REGISTRATION_FEE', '400000'), 10),
    defaultReferralMasterBonusRate: parseFloat(env('DEFAULT_REFERRAL_MASTER_BONUS_RATE', '5')),
    defaultReferralClientDiscountRate: parseFloat(env('DEFAULT_REFERRAL_CLIENT_DISCOUNT_RATE', '3')),
  },

  // CORS
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),

  // Суперадмины (через env, без hardcode в коде)
  superAdminUsernames: env('SUPER_ADMIN_USERNAMES')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Бэкапы Postgres → S3-совместимое хранилище
  backup: {
    s3Endpoint: env('BACKUP_S3_ENDPOINT'),
    s3Bucket: env('BACKUP_S3_BUCKET'),
    s3AccessKey: env('BACKUP_S3_ACCESS_KEY'),
    s3SecretKey: env('BACKUP_S3_SECRET_KEY'),
  },

  // Логирование
  logLevel: env('LOG_LEVEL', 'info'),
} as const;

export type Config = typeof config;
