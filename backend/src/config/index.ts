// ============================================
// MasterUz — Конфигурация приложения
// Агент 1 (Архитектор)
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// В serverless (Vercel) dotenv не нужен — переменные из dashboard
if (process.env.VERCEL !== '1' && process.env.VERCEL !== 'true') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

export const config = {
  // Сервер
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // База данных
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT — обязательные переменные (без дефолтов!)
  jwt: {
    secret: (() => {
      if (!process.env.JWT_SECRET) throw new Error('FATAL: JWT_SECRET is required in environment variables');
      return process.env.JWT_SECRET;
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: (() => {
      if (!process.env.JWT_REFRESH_SECRET) throw new Error('FATAL: JWT_REFRESH_SECRET is required in environment variables');
      return process.env.JWT_REFRESH_SECRET;
    })(),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: (process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_NAME || '').replace(/^@/, ''),
    miniAppUrl: process.env.TELEGRAM_MINI_APP_URL || 'https://masteruz-ecru.vercel.app',
    adminChatId: process.env.ADMIN_TELEGRAM_CHAT_ID || '',
  },

  // Yandex Maps
  yandexMaps: {
    apiKey: process.env.YANDEX_MAPS_API_KEY || '',
  },

  // Click (платежи)
  click: {
    merchantId: process.env.CLICK_MERCHANT_ID || '',
    serviceId: process.env.CLICK_SERVICE_ID || '',
    secretKey: process.env.CLICK_SECRET_KEY || '',
  },

  // Payme (платежи)
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID || '',
    merchantKey: process.env.PAYME_MERCHANT_KEY || '',
  },

  // Загрузка файлов
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  },

  // Платформа (значения по умолчанию)
  platform: {
    defaultCommissionRate: parseFloat(process.env.DEFAULT_COMMISSION_RATE || '15'),
    masterRegistrationFee: parseInt(process.env.MASTER_REGISTRATION_FEE || '400000', 10),
    defaultReferralMasterBonusRate: parseFloat(process.env.DEFAULT_REFERRAL_MASTER_BONUS_RATE || '5'),
    defaultReferralClientDiscountRate: parseFloat(process.env.DEFAULT_REFERRAL_CLIENT_DISCOUNT_RATE || '3'),
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Суперадмины (через env, без hardcode в коде)
  superAdminUsernames: (process.env.SUPER_ADMIN_USERNAMES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Логирование
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

export type Config = typeof config;
