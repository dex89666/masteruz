// ============================================
// MasterUz — Логгер (Pino)
// Агент 3 (Бэкенд-разработчик)
// ============================================

import pino from 'pino';
import { config } from '../config/index.js';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

export const logger = pino({
  level: config.logLevel,
  // pino-pretty только в development и НЕ на Vercel (сокращает бандл)
  transport:
    config.env === 'development' && !isVercel
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export default logger;
