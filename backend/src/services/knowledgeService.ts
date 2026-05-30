// ════════════════════════════════════════════════════════════════
// MasterUz — Knowledge Service
// ────────────────────────────────────────────────────────────────
// Самообучаемая база решений. Цикл жизни:
//   1) Заказ закрыт (COMPLETED) → enqueueExtractKnowledge(orderId)
//   2) Сервис вызывает GPT-4o-mini, который превращает заказ в
//      структурированный «рецепт»: проблема, диагноз, шаги, материалы,
//      визуальные теги.
//   3) Ищем близкий уже существующий рецепт (cosine similarity).
//      • Совпало (≥0.85) → MERGE: добавляем sourceOrderId, обновляем
//        диапазон цен, increment'им confidence и hits.
//      • Не совпало          → CREATE: новый рецепт.
//   4) При новом запросе AI получает 2-3 наиболее релевантных рецепта
//      в system-prompt — это даёт «понимание задачи», а не только
//      «похожие цены».
//
// Архитектурно изолирован: знает про OpenAI/Prisma. Снаружи доступны
// три функции: enqueueExtractKnowledge, findRelevantKnowledge,
// buildKnowledgeContext.
// ════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getEmbedding, toVectorLiteral } from './embeddingService.js';

// ─── Контракты ──────────────────────────────────────────────────────

export interface ExtractedKnowledge {
  problemSignature: string;       // 3-7 слов
  problemDescription: string;     // 1-2 предложения, нормализованные
  diagnosis: string;              // что вероятно сломано
  rootCauses: string[];           // вероятные причины (1-5)
  solutionSteps: { step: number; action: string; tool?: string }[];
  materials: { name: string; quantity?: number; unit?: string; approxPrice?: number }[];
  visualTags: string[];           // что AI «видит» как объект ремонта
  confidence: number;             // 0..1, насколько сам AI уверен
}

export interface RelevantKnowledge {
  id: string;
  problemSignature: string;
  diagnosis: string;
  rootCauses: string[];
  solutionSteps: { step: number; action: string; tool?: string }[];
  materials: { name: string; quantity?: number; unit?: string; approxPrice?: number }[];
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  visualTags: string[];
  hits: number;
  similarity: number;             // 0..1
}

// ─── OpenAI клиент ──────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY не задан');
  _client = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeoutMs,
    maxRetries: 1,
  });
  return _client;
}

// ─── Системный промпт для извлечения знания ─────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `Ты — AI-инженер базы знаний сервиса MasterUz (Ташкент).
Твоя задача — превратить ЗАКРЫТЫЙ заказ в обобщённый РЕЦЕПТ решения.
Этим рецептом потом будут пользоваться при похожих новых запросах.

ЗАПРЕЩЕНО:
- Копировать заказ дословно. Обобщай. Имена, адреса, номера выкидывай.
- Выдумывать материалы или шаги, которых не было в исходных данных.
- Описывать клиента или мастера. Только техническую суть проблемы.

ОБЯЗАТЕЛЬНО:
- problemSignature: 3-7 слов, в инфинитиве/номинативе («Замена личинки автомобильного замка»).
- problemDescription: 1-2 предложения, обобщённо описывающие задачу.
- diagnosis: 1 предложение про вероятную причину. Если из данных причина неясна — пиши «по фото/описанию причина не определена».
- rootCauses: 1-5 вероятных причин в порядке убывания вероятности.
- solutionSteps: пошаговый план ремонта. step — целое число с 1. action — короткая фраза.
- materials: что обычно нужно. quantity/unit/approxPrice заполняй ТОЛЬКО если данные явно есть.
- visualTags: 3-8 КОНКРЕТНЫХ объектов ремонта, упомянутых в тексте/описании заказа («дверной замок автомобиля», «личинка цилиндра», «выключатель Schneider», «латунный смеситель Grohe»). Без общих слов вроде «дверь» или «деталь».
- confidence: 0..1, насколько ты уверен в качестве извлечённого знания.

Отвечай СТРОГО валидным JSON без markdown-обёртки.`;

const EXTRACTION_SCHEMA = `{
  "problemSignature": string,
  "problemDescription": string,
  "diagnosis": string,
  "rootCauses": string[],
  "solutionSteps": [{ "step": number, "action": string, "tool"?: string }],
  "materials": [{ "name": string, "quantity"?: number, "unit"?: string, "approxPrice"?: number }],
  "visualTags": string[],
  "confidence": number
}`;

// ─── Извлечение знания из закрытого заказа ──────────────────────────

interface OrderForExtraction {
  id: string;
  title: string;
  description: string;
  price: number;
  categoryName: string;
  categoryId: string;
  images: string[];
  // Если был отзыв — даёт сильный сигнал, что задача действительно решена
  reviewComment?: string;
}

async function extractKnowledge(order: OrderForExtraction): Promise<ExtractedKnowledge | null> {
  const userPayload = [
    `Категория: ${order.categoryName}`,
    `Заголовок: ${order.title}`,
    `Описание клиента: ${order.description}`,
    `Итоговая цена: ${order.price} UZS`,
    order.reviewComment ? `Отзыв клиента после выполнения: ${order.reviewComment}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // К фото: на этапе извлечения не отправляем картинки в LLM —
  // они уже отражены в title/description (этим занимается analyzeOrder
  // на этапе создания заказа). Это бережёт деньги: vision вызывается
  // только когда фото нужны живому клиенту.
  try {
    const res = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: 'system', content: `${EXTRACTION_SYSTEM_PROMPT}\n\nСхема ответа:\n${EXTRACTION_SCHEMA}` },
        { role: 'user', content: userPayload },
      ],
    });

    const content = res.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    return normalizeExtracted(parsed);
  } catch (err) {
    logger.warn({ err: (err as Error).message, orderId: order.id }, 'knowledge: extract failed');
    return null;
  }
}

function normalizeExtracted(raw: any): ExtractedKnowledge | null {
  const sig = String(raw?.problemSignature || '').trim().slice(0, 200);
  const desc = String(raw?.problemDescription || '').trim().slice(0, 1000);
  if (!sig || !desc) return null;

  const steps = Array.isArray(raw?.solutionSteps) ? raw.solutionSteps : [];
  const materials = Array.isArray(raw?.materials) ? raw.materials : [];
  const tags = Array.isArray(raw?.visualTags)
    ? raw.visualTags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12)
    : [];
  const causes = Array.isArray(raw?.rootCauses)
    ? raw.rootCauses.map((c: any) => String(c).trim()).filter(Boolean).slice(0, 8)
    : [];

  const conf = typeof raw?.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;

  return {
    problemSignature: sig,
    problemDescription: desc,
    diagnosis: String(raw?.diagnosis || '').trim().slice(0, 500),
    rootCauses: causes,
    solutionSteps: steps
      .filter((s: any) => s && typeof s.action === 'string')
      .slice(0, 20)
      .map((s: any, idx: number) => ({
        step: Number.isFinite(s.step) ? Number(s.step) : idx + 1,
        action: String(s.action).trim().slice(0, 300),
        tool: s.tool ? String(s.tool).trim().slice(0, 100) : undefined,
      })),
    materials: materials
      .filter((m: any) => m && typeof m.name === 'string')
      .slice(0, 30)
      .map((m: any) => ({
        name: String(m.name).trim().slice(0, 150),
        quantity: typeof m.quantity === 'number' ? m.quantity : undefined,
        unit: m.unit ? String(m.unit).trim().slice(0, 30) : undefined,
        approxPrice:
          typeof m.approxPrice === 'number' && m.approxPrice > 0 ? m.approxPrice : undefined,
      })),
    visualTags: tags,
    confidence: conf,
  };
}

// ─── Слияние знаний ─────────────────────────────────────────────────

const MERGE_SIMILARITY = 0.85; // если совпадение ≥ 85% — мержим, иначе создаём новый рецепт

async function findClosestKnowledge(
  categoryId: string,
  embedding: number[],
): Promise<{ id: string; similarity: number } | null> {
  const literal = toVectorLiteral(embedding);
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; distance: number }>>(
      `
      SELECT "id", "embedding" <=> $1::vector AS "distance"
      FROM "knowledge_entries"
      WHERE "category_id" = $2 AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> $1::vector
      LIMIT 1
      `,
      literal,
      categoryId,
    );
    const top = rows[0];
    if (!top) return null;
    return { id: top.id, similarity: 1 - top.distance };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'knowledge: closest lookup failed');
    return null;
  }
}

async function mergeKnowledge(
  knowledgeId: string,
  orderId: string,
  orderPrice: number,
  extracted: ExtractedKnowledge,
): Promise<void> {
  // Накопительная статистика: новый sourceOrderId, обновлённый ценовой
  // диапазон, increment confidence/hits. Существующие шаги/материалы НЕ
  // перезаписываем — ранние извлечения не теряются. Новые теги дописываем.
  await prisma.$executeRawUnsafe(
    `
    UPDATE "knowledge_entries"
    SET
      "source_order_ids" = ARRAY(SELECT DISTINCT unnest("source_order_ids" || $2::uuid)),
      "visual_tags"      = ARRAY(SELECT DISTINCT unnest("visual_tags" || $3::text[])),
      "price_min"        = LEAST(COALESCE("price_min", $4), $4),
      "price_max"        = GREATEST(COALESCE("price_max", $4), $4),
      "price_avg"        = (COALESCE("price_avg", $4) + $4) / 2,
      "confidence"       = LEAST(1.0, "confidence" + 0.05),
      "hits"             = "hits" + 1,
      "updated_at"       = NOW()
    WHERE "id" = $1
    `,
    knowledgeId,
    orderId,
    extracted.visualTags,
    orderPrice,
  );
  logger.info({ knowledgeId, orderId }, 'knowledge: merged');
}

async function createKnowledge(
  categoryId: string,
  orderId: string,
  orderPrice: number,
  extracted: ExtractedKnowledge,
  embedding: number[],
): Promise<string> {
  const literal = toVectorLiteral(embedding);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
    INSERT INTO "knowledge_entries" (
      "category_id", "problem_signature", "problem_description",
      "diagnosis", "root_causes", "solution_steps", "materials",
      "price_min", "price_max", "price_avg",
      "visual_tags", "source_order_ids", "confidence", "embedding"
    )
    VALUES (
      $1, $2, $3,
      $4, $5, $6::jsonb, $7::jsonb,
      $8, $8, $8,
      $9, ARRAY[$10::uuid], $11, $12::vector
    )
    RETURNING "id"
    `,
    categoryId,
    extracted.problemSignature,
    extracted.problemDescription,
    extracted.diagnosis,
    extracted.rootCauses,
    JSON.stringify(extracted.solutionSteps),
    JSON.stringify(extracted.materials),
    orderPrice,
    extracted.visualTags,
    orderId,
    extracted.confidence,
    literal,
  );
  const id = rows[0]?.id;
  logger.info({ knowledgeId: id, orderId, signature: extracted.problemSignature }, 'knowledge: created');
  return id;
}

// ─── Публичные функции ──────────────────────────────────────────────

/**
 * Запуск извлечения знания из закрытого заказа.
 * Best-effort: молча проглатывает ошибки. Идемпотентно — заказ может
 * быть уже учтён в существующем рецепте, повторный вызов сольёт ещё раз
 * (но даст +0.05 confidence и новый hit, что приемлемо).
 */
export async function enqueueExtractKnowledge(orderId: string): Promise<void> {
  if (!config.rag.enabled || !config.rag.knowledgeEnabled) return;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        category: { select: { id: true, name: true } },
        reviews: { select: { comment: true }, take: 1 },
      },
    });
    if (!order || !order.category) return;

    const extracted = await extractKnowledge({
      id: order.id,
      title: order.title,
      description: order.description,
      price: Number(order.price),
      images: order.images,
      categoryId: order.category.id,
      categoryName: order.category.name,
      reviewComment: order.reviews[0]?.comment ?? undefined,
    });
    if (!extracted) return;

    // Эмбеддинг строим по «сигнатура + описание + теги» — то, что и будет
    // использовано для поиска в findRelevantKnowledge.
    const embText = [
      `Проблема: ${extracted.problemSignature}`,
      `Описание: ${extracted.problemDescription}`,
      extracted.visualTags.length ? `Теги: ${extracted.visualTags.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const embedding = await getEmbedding(embText);

    const closest = await findClosestKnowledge(order.category.id, embedding);
    if (closest && closest.similarity >= MERGE_SIMILARITY) {
      await mergeKnowledge(closest.id, order.id, Number(order.price), extracted);
    } else {
      await createKnowledge(order.category.id, order.id, Number(order.price), extracted, embedding);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, orderId }, 'enqueueExtractKnowledge failed');
  }
}

/**
 * Найти 2-3 наиболее релевантных «рецепта» для нового запроса.
 * Используется в aiAnalysisService для подмешивания в system-prompt.
 */
export async function findRelevantKnowledge(input: {
  description: string;
  visualTags?: string[];
  categoryId?: string;
  limit?: number;
}): Promise<RelevantKnowledge[]> {
  if (!config.rag.enabled || !config.rag.knowledgeEnabled) return [];

  const limit = Math.min(Math.max(input.limit ?? 3, 1), 5);
  const distanceCutoff = 1 - config.rag.knowledgeThreshold;

  let queryVec: number[];
  try {
    const embText = [
      `Описание: ${input.description}`,
      input.visualTags?.length ? `Теги: ${input.visualTags.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    queryVec = await getEmbedding(embText);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'knowledge: query embedding failed');
    return [];
  }

  const literal = toVectorLiteral(queryVec);

  try {
    const categoryFilter = input.categoryId ? `AND "category_id" = $4` : '';
    const params: unknown[] = [literal, distanceCutoff, limit];
    if (input.categoryId) params.push(input.categoryId);

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        problem_signature: string;
        diagnosis: string;
        root_causes: string[];
        solution_steps: any;
        materials: any;
        price_min: string | null;
        price_max: string | null;
        price_avg: string | null;
        visual_tags: string[];
        hits: number;
        distance: number;
      }>
    >(
      `
      SELECT
        "id",
        "problem_signature",
        "diagnosis",
        "root_causes",
        "solution_steps",
        "materials",
        "price_min"::text,
        "price_max"::text,
        "price_avg"::text,
        "visual_tags",
        "hits",
        ("embedding" <=> $1::vector) AS "distance"
      FROM "knowledge_entries"
      WHERE "embedding" IS NOT NULL
        AND ("embedding" <=> $1::vector) < $2
        ${categoryFilter}
      ORDER BY "embedding" <=> $1::vector
      LIMIT $3
      `,
      ...params,
    );

    // Increment hits в фоне — это «использовалось», даже если запрос
    // в итоге не дошёл до создания заказа.
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      void prisma
        .$executeRawUnsafe(
          `UPDATE "knowledge_entries" SET "hits" = "hits" + 1 WHERE "id" = ANY($1::uuid[])`,
          ids,
        )
        .catch(() => {});
    }

    return rows.map((r) => ({
      id: r.id,
      problemSignature: r.problem_signature,
      diagnosis: r.diagnosis,
      rootCauses: r.root_causes,
      solutionSteps: Array.isArray(r.solution_steps) ? r.solution_steps : [],
      materials: Array.isArray(r.materials) ? r.materials : [],
      priceMin: r.price_min ? parseFloat(r.price_min) : null,
      priceMax: r.price_max ? parseFloat(r.price_max) : null,
      priceAvg: r.price_avg ? parseFloat(r.price_avg) : null,
      visualTags: r.visual_tags,
      hits: r.hits,
      similarity: 1 - r.distance,
    }));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'findRelevantKnowledge: query failed');
    return [];
  }
}

/**
 * Сборка текстового блока для подмешивания в system-prompt AI Vision.
 * Возвращает пустую строку, если знаний нет, чтобы не «портить» промпт-префикс.
 */
export function buildKnowledgeContext(items: RelevantKnowledge[]): string {
  if (items.length === 0) return '';

  const fmtPrice = (p: number) => new Intl.NumberFormat('ru-RU').format(Math.round(p));
  const blocks = items.map((k, i) => {
    const matchPct = Math.round(k.similarity * 100);
    const steps = (k.solutionSteps || [])
      .slice(0, 6)
      .map((s) => `${s.step}. ${s.action}${s.tool ? ` (инструмент: ${s.tool})` : ''}`)
      .join('\n');
    const causes = (k.rootCauses || []).slice(0, 5).join('; ');
    const materials = (k.materials || [])
      .slice(0, 6)
      .map((m) => `${m.name}${m.quantity ? ` ×${m.quantity}${m.unit ? ' ' + m.unit : ''}` : ''}`)
      .join(', ');
    const priceLine =
      k.priceMin && k.priceMax
        ? `Реальный диапазон цен: ${fmtPrice(k.priceMin)}–${fmtPrice(k.priceMax)} UZS (среднее ${
            k.priceAvg ? fmtPrice(k.priceAvg) : '—'
          })`
        : '';

    return [
      `### Рецепт #${i + 1} — ${k.problemSignature} (релевантность ${matchPct}%, использован ${k.hits} раз)`,
      k.diagnosis ? `Диагноз: ${k.diagnosis}` : '',
      causes ? `Вероятные причины: ${causes}` : '',
      steps ? `План ремонта:\n${steps}` : '',
      materials ? `Материалы: ${materials}` : '',
      priceLine,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [
    '## База знаний MasterUz — проверенные рецепты решений:',
    blocks.join('\n\n'),
    'Если рецепт совпадает с задачей клиента — ИСПОЛЬЗУЙ его как основу: бери диагноз, шаги и ценовой диапазон оттуда.',
    'Если рецепт частично подходит — адаптируй с учётом текущего фото и описания, но не выдумывай новые решения с нуля.',
  ].join('\n\n');
}
