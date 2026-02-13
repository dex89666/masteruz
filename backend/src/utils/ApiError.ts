// ============================================
// MasterUz — Класс ошибок API
// Агент 3 (Бэкенд-разработчик)
// ============================================

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }

  static badRequest(message = 'Некорректный запрос') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Не авторизован') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Доступ запрещён') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Не найдено') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Конфликт данных') {
    return new ApiError(409, message);
  }

  static tooMany(message = 'Слишком много запросов') {
    return new ApiError(429, message);
  }

  static internal(message = 'Внутренняя ошибка сервера') {
    return new ApiError(500, message, false);
  }
}
