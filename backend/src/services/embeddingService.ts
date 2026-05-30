// ════════════════════════════════════════════════════════════════
// MasterUz — Embedding Service
// ────────────────────────────────────────────────────────────────
// Тонкая обёртка над OpenAI Embeddings API. Даёт две вещи:
//   1) `getEmbedding(text)` — сырой вектор для произвольного текста.
//   2) `getOrderEmbedding({ category, title, description })` —
//      канонический способ векторизовать заказ; одна функция —
//      одно правило. Любые «как мы строим текст для эмбеддинга»
//      живут только здесь, чтобы поиск (ragService) и запись
//      (ordersService/instantOrderService) использовали один и
//      тот же канон.
//
// Архитектурно изолирован: знает про OpenAI, не знает про Prisma.
// ════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY не настроен — embedding-сервис недоступен');
  }
  _client = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeoutMs,
    maxRetries: 1,
  });
  return _client;
}

/** Очистка и нормализация перед эмбеддингом — убирает мусор, который шумит вектор. */
function normalize(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')        // ссылки
    .replace(/data:image\/[^;]+;base64,\S+/gi, '') // инлайн-картинки
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);                         // OpenAI лимит — 8191 токен
}

/**
 * Получить embedding-вектор для произвольного текста.
 * Бросает исключение при ошибке — вызывающий код решает, фейлить запрос
 * или просто залогировать (RAG — best-effort, основной поток не должен падать).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const input = normalize(text);
  if (!input) throw new Error('Embedding: пустой текст');

  const startedAt = Date.now();
  const res = await getClient().embeddings.create({
    model: config.rag.embeddingModel,
    input,
  });

  const vec = res.data[0]?.embedding;
  if (!vec || vec.length !== config.rag.embeddingDim) {
    throw new Error(
      `Embedding: получен вектор размерности ${vec?.length}, ожидалось ${config.rag.embeddingDim}`,
    );
  }

  logger.debug(
    { latencyMs: Date.now() - startedAt, tokens: res.usage?.total_tokens, model: config.rag.embeddingModel },
    'embedding generated',
  );
  return vec;
}

/**
 * Каноническая векторизация заказа. Объединяет категорию, заголовок и
 * описание в один компактный текст. Финальная цена и материалы НЕ входят
 * в эмбеддинг — это «решение», а не «задача»; иначе похожие проблемы с
 * разной ценой будут дальше друг от друга, и поиск сломается.
 *
 * `category` опциональна: на этапе AI-анализа категория ещё не определена,
 * используем только текст клиента.
 */
export interface OrderEmbeddingInput {
  category?: string;      // человекочитаемое имя категории (не slug)
  title?: string;
  description: string;
}

export async function getOrderEmbedding(input: OrderEmbeddingInput): Promise<number[]> {
  const parts = [
    input.category ? `Категория: ${input.category}` : '',
    input.title ? `Заголовок: ${input.title}` : '',
    `Описание: ${input.description}`,
  ].filter(Boolean);
  return getEmbedding(parts.join('\n'));
}

/** Вектор → строка `'[0.1,0.2,...]'`, ожидаемая pgvector в `$queryRaw`. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
