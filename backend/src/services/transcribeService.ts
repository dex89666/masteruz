// ============================================
// MasterUz — Speech-to-Text (OpenAI Whisper)
// Принимает audio Buffer → возвращает распознанный текст
// ============================================

import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    if (!config.openai.apiKey) {
      throw ApiError.badRequest('OpenAI API не настроен на сервере');
    }
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

/**
 * Преобразует аудио (Buffer + mime) в текст через Whisper.
 * Поддерживаемые форматы: webm, mp4, mp3, wav, m4a, ogg.
 */
export async function transcribeAudio(audio: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ text: string; durationMs: number }> {
  const startedAt = Date.now();
  const c = getClient();

  // OpenAI SDK ожидает File-подобный объект (BlobLike с name).
  // В Node 20+ есть глобальный File, в более старых — используем Blob c name.
  const FileCtor = (globalThis as any).File;
  let fileLike: any;
  if (FileCtor) {
    fileLike = new FileCtor([audio.buffer], audio.filename, { type: audio.mimeType });
  } else {
    const blob = new Blob([audio.buffer], { type: audio.mimeType });
    (blob as any).name = audio.filename;
    fileLike = blob;
  }

  try {
    const response = await c.audio.transcriptions.create({
      file: fileLike,
      model: 'whisper-1',
      language: 'ru',
      response_format: 'json',
      temperature: 0,
    });
    const text = (response as any).text?.trim() || '';
    const durationMs = Date.now() - startedAt;
    logger.info({ durationMs, len: text.length }, 'Whisper: транскрибация завершена');
    return { text, durationMs };
  } catch (err: any) {
    const status = err?.status || err?.response?.status;
    const message = err?.message || 'Ошибка распознавания речи';
    logger.error({ status, message }, 'Whisper: ошибка транскрибации');
    if (status === 401) throw ApiError.unauthorized('OpenAI: неверный ключ API');
    if (status === 429) throw ApiError.tooMany('OpenAI: превышен лимит запросов, попробуйте позже');
    throw ApiError.badRequest(`Не удалось распознать речь: ${message}`);
  }
}
