// ============================================
// MasterUz — getErrorMessage
// Достаёт человекочитаемое сообщение из ошибки API.
// Бэкенд отдаёт { success:false, error } либо { message };
// сеть/таймаут — уже размечены интерсептором axios в error.message.
// ============================================

const FALLBACK = 'Что-то пошло не так. Попробуйте ещё раз';

export function getErrorMessage(error: unknown): string {
  if (!error) return FALLBACK;

  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (data && typeof data === 'object') {
    const { error: apiError, message } = data as { error?: unknown; message?: unknown };
    if (typeof apiError === 'string' && apiError.trim()) return apiError;
    if (typeof message === 'string' && message.trim()) return message;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;

  return FALLBACK;
}

export function getStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}
