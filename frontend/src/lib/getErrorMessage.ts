// ============================================
// MasterUz — getErrorMessage
// Достаёт человекочитаемое сообщение из ошибки API.
// Бэкенд отдаёт { success:false, error: { message, details } } либо { message };
// сеть/таймаут — уже размечены интерсептором axios в error.message.
// ============================================

import { translate } from '../i18n';

const fallback = () => translate('common.somethingWrong');

export function getErrorMessage(error: unknown): string {
  if (!error) return fallback();

  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (data && typeof data === 'object') {
    const { error: apiError, message } = data as { error?: unknown; message?: unknown };
    if (typeof apiError === 'string' && apiError.trim()) return apiError;
    // Основной формат errorHandler: { error: { message, details?: [{ field, message }] } }
    if (apiError && typeof apiError === 'object') {
      const { message: apiMessage, details } = apiError as { message?: unknown; details?: unknown };
      if (Array.isArray(details) && details.length > 0) {
        const parts = details
          .map((d) => (d && typeof d === 'object' ? (d as { message?: unknown }).message : null))
          .filter((m): m is string => typeof m === 'string' && m.trim() !== '');
        if (parts.length > 0) return parts.join('; ');
      }
      if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    }
    if (typeof message === 'string' && message.trim()) return message;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback();
}

export function getStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}
