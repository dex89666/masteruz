// ============================================
// MasterUz — Error Handler Middleware
// Агент 3 (Бэкенд-разработчик)
// ============================================

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: Error & { type?: string; status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Ошибки парсинга JSON (невалидный JSON в body)
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Невалидный JSON в теле запроса',
        statusCode: 400,
      },
    });
    return;
  }

  // API ошибки (ожидаемые)
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  // Ошибки валидации Zod
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        message: 'Ошибка валидации',
        statusCode: 400,
        details: errors,
      },
    });
    return;
  }

  // Ошибки Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Ошибка базы данных';
    let statusCode = 500;

    switch (err.code) {
      case 'P2002':
        message = 'Запись с такими данными уже существует';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Запись не найдена';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Нарушение ссылочной целостности';
        statusCode = 400;
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: { message, statusCode },
    });
    return;
  }

  // Неожиданные ошибки
  logger.error({ err }, 'Непредвиденная ошибка');

  res.status(500).json({
    success: false,
    error: {
      message: config.env === 'development' ? err.message : 'Внутренняя ошибка сервера',
      statusCode: 500,
    },
  });
}

/**
 * Обработчик 404
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: 'Маршрут не найден',
      statusCode: 404,
    },
  });
}
