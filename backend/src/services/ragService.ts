// ════════════════════════════════════════════════════════════════
// MasterUz — RAG Service
// ────────────────────────────────────────────────────────────────
// Самообучаемый поиск решений: для нового запроса находим N
// закрытых заказов, наиболее близких по смыслу, и подмешиваем их
// в system-prompt AI Vision. Каждый закрытый заказ — обучающий
// пример. Чем больше история, тем точнее цены и формулировки.
//
// Поиск: pgvector cosine distance, индекс HNSW.
// Запись: outside (см. embeddingService + хук в orders.service).
// ════════════════════════════════════════════════════════════════

import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getOrderEmbedding, toVectorLiteral, type OrderEmbeddingInput } from './embeddingService.js';

export interface SimilarOrder {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  finalPrice: number;        // итоговая цена закрытого заказа в сумах
  similarity: number;        // 0..1
  completedAt: Date | null;
}

/**
 * Найти похожие закрытые заказы. Возвращает [] при любой ошибке —
 * RAG обязан быть best-effort, основной AI-анализ работает и без него.
 */
export async function findSimilarOrders(input: OrderEmbeddingInput): Promise<SimilarOrder[]> {
  if (!config.rag.enabled) return [];

  let queryVec: number[];
  try {
    queryVec = await getOrderEmbedding(input);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'RAG: не удалось получить query-embedding — пропуск');
    return [];
  }

  const literal = toVectorLiteral(queryVec);
  const distanceCutoff = 1 - config.rag.similarityThreshold; // cosine distance: < threshold ⇒ похоже
  const ageCutoff = new Date();
  ageCutoff.setMonth(ageCutoff.getMonth() - config.rag.maxAgeMonths);

  try {
    // Берём только COMPLETED-заказы (это «обучающие примеры» с реальной финальной ценой)
    // и не старше cut-off. Сортировка по cosine distance по HNSW-индексу.
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        description: string;
        category_name: string;
        final_price: string;
        completed_at: Date | null;
        distance: number;
      }>
    >(
      `
      SELECT
        o."id",
        o."title",
        o."description",
        c."name"          AS "category_name",
        o."price"::text   AS "final_price",
        o."completed_at",
        (o."embedding" <=> $1::vector) AS "distance"
      FROM "orders" o
      JOIN "categories" c ON c."id" = o."category_id"
      WHERE o."embedding" IS NOT NULL
        AND o."status" = 'COMPLETED'
        AND o."completed_at" >= $2
        AND (o."embedding" <=> $1::vector) < $3
      ORDER BY o."embedding" <=> $1::vector
      LIMIT $4
      `,
      literal,
      ageCutoff,
      distanceCutoff,
      config.rag.topK,
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      categoryName: r.category_name,
      finalPrice: parseFloat(r.final_price) || 0,
      similarity: 1 - r.distance,
      completedAt: r.completed_at,
    }));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'RAG: запрос похожих заказов провалился');
    return [];
  }
}

/**
 * Сборка контекста для system-prompt. Возвращает пустую строку, если
 * история пуста — тогда промпт-префикс не «портится» лишним блоком.
 */
export function buildRagContext(similar: SimilarOrder[]): string {
  if (similar.length === 0) return '';

  const fmtPrice = (p: number) => new Intl.NumberFormat('ru-RU').format(Math.round(p));
  const items = similar
    .map((s, i) => {
      const matchPct = Math.round(s.similarity * 100);
      const desc = s.description.length > 240 ? s.description.slice(0, 240) + '…' : s.description;
      return [
        `### Заказ #${i + 1} — совпадение ${matchPct}%`,
        `Категория: ${s.categoryName}`,
        `Заголовок: ${s.title}`,
        `Описание: ${desc}`,
        `Итоговая цена: ${fmtPrice(s.finalPrice)} UZS`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    '## История похожих закрытых заказов (реальные цены Узбекистана):',
    items,
    'ИСПОЛЬЗУЙ эту историю как ориентир для priceHint. Если задача совпадает почти полностью —',
    'опирайся на цены из истории, не выдумывай свои. Если совпадения частичные — используй как нижнюю/верхнюю границу.',
  ].join('\n\n');
}

/**
 * Записать (или обновить) embedding для заказа. Используется хуком
 * после создания/завершения заказа и backfill-скриптом. Идемпотентно:
 * перезапись разрешена.
 */
export async function upsertOrderEmbedding(
  orderId: string,
  input: OrderEmbeddingInput,
): Promise<void> {
  if (!config.rag.enabled) return;

  let vec: number[];
  try {
    vec = await getOrderEmbedding(input);
  } catch (err) {
    logger.warn({ err: (err as Error).message, orderId }, 'RAG: не удалось получить embedding для заказа');
    return;
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "orders"
         SET "embedding" = $1::vector,
             "embedding_updated_at" = NOW()
       WHERE "id" = $2`,
      toVectorLiteral(vec),
      orderId,
    );
  } catch (err) {
    logger.warn({ err: (err as Error).message, orderId }, 'RAG: запись embedding провалилась');
  }
}
