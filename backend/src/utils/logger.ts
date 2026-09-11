// ============================================
// MasterUz — Логгер (Pino)
// Агент 3 (Бэкенд-разработчик)
// ============================================

import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.logLevel,
  // Секреты и персональные данные не пишутся в логи, даже если их случайно
  // передали в объекте лога: логи хранятся в Railway, их видят не только
  // те, кому положено видеть токены, пароли и ПИНФЛ.
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie',
      'password', '*.password', 'token', '*.token', 'accessToken', '*.accessToken',
      'refreshToken', '*.refreshToken', 'secret', '*.secret', 'secretKey', '*.secretKey',
      'pinfl', '*.pinfl', 'passport', '*.passport', 'cardNumber', '*.cardNumber',
    ],
    censor: '[скрыто]',
  },
  // pino-pretty только в development
  transport:
    config.env === 'development'
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
