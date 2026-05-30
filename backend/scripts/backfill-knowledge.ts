/**
 * Backfill базы знаний (L2) из исторических закрытых заказов.
 *
 *   npx tsx scripts/backfill-knowledge.ts
 *
 * Запускать ПОСЛЕ миграции 0019_knowledge_base и (желательно) после
 * backfill-embeddings.ts. Безопасен к повторному запуску — для каждого
 * заказа сервис сам решает: создать новую запись или дополнить существующую
 * (merge при cosine ≥ 0.85).
 *
 * Берёт только COMPLETED-заказы:
 *   • не старше RAG_MAX_AGE_MONTHS;
 *   • не входящие в source_order_ids ни одной знания (т.е. ещё не извлечены).
 */

import { prisma } from '../src/config/database.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';
import { enqueueExtractKnowledge } from '../src/services/knowledgeService.js';

const BATCH_SIZE = Number(process.env.RAG_BACKFILL_BATCH ?? 25);
const SLEEP_MS   = Number(process.env.RAG_BACKFILL_SLEEP_MS ?? 600);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!config.rag.knowledgeEnabled) {
    logger.warn('Knowledge Base отключена (RAG_KNOWLEDGE_ENABLED=false). Backfill пропущен.');
    return;
  }
  if (!config.openai.apiKey) {
    logger.error('OPENAI_API_KEY не задан — backfill невозможен.');
    process.exit(1);
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - config.rag.maxAgeMonths);

  // Собираем все order_id, уже учтённые в knowledge_entries.source_order_ids
  const usedRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT DISTINCT unnest(source_order_ids) AS id FROM knowledge_entries`,
  );
  const used = new Set(usedRows.map((r) => r.id));

  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: cutoff },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  const todo = orders.map((o) => o.id).filter((id) => !used.has(id));
  logger.info(
    { total: orders.length, alreadyExtracted: used.size, todo: todo.length },
    'Knowledge backfill: старт',
  );

  let done = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const id = todo[i];
    try {
      await enqueueExtractKnowledge(id);
      done++;
    } catch (err) {
      failed++;
      logger.warn({ err: (err as Error).message, orderId: id }, 'extract failed');
    }
    if ((i + 1) % BATCH_SIZE === 0) {
      logger.info({ progress: `${i + 1}/${todo.length}`, done, failed }, 'batch complete');
    }
    await sleep(SLEEP_MS);
  }

  logger.info({ done, failed, total: todo.length }, 'Knowledge backfill: завершено');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  logger.error({ err: e?.message ?? e }, 'backfill-knowledge fatal');
  await prisma.$disconnect();
  process.exit(1);
});
