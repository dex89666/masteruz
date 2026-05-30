/**
 * Backfill embedding-векторов для исторических закрытых заказов.
 * После накатки миграции 0018_orders_rag запускается один раз:
 *
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Скрипт:
 *  • берёт COMPLETED-заказы без embedding'а и не старше RAG_MAX_AGE_MONTHS;
 *  • генерирует векторы партиями по BATCH_SIZE (rate-limit + прогресс-лог);
 *  • безопасен к прерыванию: при повторном запуске продолжит с того места,
 *    где остановился (фильтр `embedding IS NULL`).
 */

import { prisma } from '../src/config/database.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';
import { upsertOrderEmbedding } from '../src/services/ragService.js';

const BATCH_SIZE = Number(process.env.RAG_BACKFILL_BATCH ?? 50);
const SLEEP_MS   = Number(process.env.RAG_BACKFILL_SLEEP_MS ?? 250); // пауза между заказами (rate-limit)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!config.rag.enabled) {
    logger.warn('RAG отключён (RAG_ENABLED=false). Backfill пропущен.');
    return;
  }
  if (!config.openai.apiKey) {
    logger.error('OPENAI_API_KEY не задан — backfill невозможен.');
    process.exit(1);
  }

  const ageCutoff = new Date();
  ageCutoff.setMonth(ageCutoff.getMonth() - config.rag.maxAgeMonths);

  // Сколько всего работы — для прогресса.
  const total = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "orders"
    WHERE "status" = 'COMPLETED'
      AND "completed_at" >= ${ageCutoff}
      AND "embedding" IS NULL
  `;
  const totalCount = Number(total[0]?.count ?? 0n);
  logger.info({ totalCount, batch: BATCH_SIZE, sleepMs: SLEEP_MS }, 'RAG backfill: старт');

  if (totalCount === 0) {
    logger.info('RAG backfill: всё уже посчитано. Выход.');
    return;
  }

  let processed = 0;
  let failed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.$queryRaw<
      Array<{ id: string; title: string; description: string; category_name: string }>
    >`
      SELECT o."id", o."title", o."description", c."name" AS category_name
      FROM "orders" o
      JOIN "categories" c ON c."id" = o."category_id"
      WHERE o."status" = 'COMPLETED'
        AND o."completed_at" >= ${ageCutoff}
        AND o."embedding" IS NULL
      ORDER BY o."completed_at" DESC
      LIMIT ${BATCH_SIZE}
    `;
    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        await upsertOrderEmbedding(row.id, {
          category: row.category_name,
          title: row.title,
          description: row.description,
        });
        processed++;
      } catch (err) {
        failed++;
        logger.warn({ err: (err as Error).message, orderId: row.id }, 'backfill: ошибка');
      }
      if (processed % 20 === 0) {
        logger.info({ processed, failed, totalCount }, 'RAG backfill: прогресс');
      }
      if (SLEEP_MS > 0) await sleep(SLEEP_MS);
    }
  }

  logger.info({ processed, failed, totalCount }, 'RAG backfill: завершено');
}

main()
  .catch((err) => {
    logger.error({ err }, 'RAG backfill: фатальная ошибка');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
