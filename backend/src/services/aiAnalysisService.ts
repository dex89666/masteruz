// ============================================
// MasterUz — AI Analysis Service (OpenAI GPT-4o Vision)
// Iteration 1: компьютерное зрение + уверенность определения
// ============================================
//
// Сервис принимает фото + текст пользователя и возвращает структурированный
// разбор: какая категория работ, насколько уверен AI, срочно ли, нужен ли
// выезд для замера, какие материалы и ориентировочный бюджет.
//
// Архитектурно изолирован: ни один модуль домена не должен знать про OpenAI.
// Сервис экспортирует чистую функцию analyzeOrder() с типизированным
// контрактом — это единственная точка интеграции с LLM.
// ============================================

import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

// ─── Контракт ────────────────────────────────────────────────────────────

export interface AiCategoryHint {
  slug: string;
  name: string;
}

export interface AiAnalysisInput {
  /** data URLs (base64) или публичные https URL фото */
  photoUrls: string[];
  /** Объединённый текст: голос + ввод */
  text: string;
  /** Доступные в системе категории — AI выбирает только из них */
  availableCategories: AiCategoryHint[];
}

export interface AiCategoryGuess {
  slug: string;
  confidence: number; // 0..100
  reasoning: string;  // короткое обоснование (1 фраза)
}

export type AiUrgency = 'emergency' | 'urgent' | 'normal' | 'flexible';

export interface AiAnalysisResult {
  /** Топ-3 предположения, отсортированные по убыванию confidence */
  categories: AiCategoryGuess[];
  /** Срочность исходя из текста ("течёт", "сегодня", "горит" → emergency) */
  urgency: AiUrgency;
  /** Краткое резюме того, что AI увидел и понял */
  summary: string;
  /** Список материалов, которые нужны (пусто если не определимо) */
  materials: string[];
  /** Ориентировочный бюджет в сумах. null если AI не смог оценить */
  priceHint: { min: number; max: number } | null;
  /** True если работа требует обмера/выезда (без замеров точный расчёт невозможен) */
  needsOnSite: boolean;
  /** Дополнительные данные для логирования/отладки */
  raw: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
  };
}

// ─── Клиент OpenAI ───────────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  if (!config.openai.apiKey) {
    throw ApiError.badRequest(
      'AI-анализ временно недоступен: не настроен ключ OpenAI. Свяжитесь с поддержкой.'
    );
  }
  _client = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeoutMs,
    maxRetries: 1,
  });
  return _client;
}

// ─── Системный промпт ────────────────────────────────────────────────────

function buildSystemPrompt(categories: AiCategoryHint[]): string {
  const list = categories
    .map((c) => `  • ${c.slug} — ${c.name}`)
    .join('\n');

  return `Ты — AI-эксперт сервиса MasterUz (Ташкент, Узбекистан). Ты помогаешь определить, какие ремонтные/бытовые работы нужны клиенту, на основании фотографий и текста.

ТВОИ ЗАДАЧИ:
1. Внимательно изучи фото и текст
2. Определи 1–3 наиболее вероятные категории работ ИЗ СПИСКА НИЖЕ (ничего вне списка)
3. Оцени свою уверенность от 0 до 100 (90+ = я точно вижу проблему на фото; 60–89 = вероятно, но нужно подтверждение; <60 = недостаточно данных)
4. Определи срочность: emergency (авария — потоп, замыкание, газ), urgent (сегодня-завтра), normal (на неделе), flexible (не срочно)
5. Если работа требует обмера (площадь, метраж, объём) — пометь needsOnSite: true
6. Перечисли основные материалы, если применимо
7. Дай ориентировочный бюджет в сумах UZS (минимум-максимум по Ташкенту 2026)

ДОСТУПНЫЕ КАТЕГОРИИ (используй ТОЛЬКО эти slug):
${list}

ВАЖНЫЕ ПРАВИЛА:
- Отвечай ИСКЛЮЧИТЕЛЬНО валидным JSON-объектом по схеме (без markdown-обрамления)
- Все строки — на русском
- Если на фото вообще не видно работ или предмета ремонта — confidence для всех ≤ 30
- Если на фото видно, что нужны измерения (стены, пол, потолок) — needsOnSite: true
- Бюджет priceHint указывай ТОЛЬКО когда уверен ≥ 70, иначе null

СХЕМА ОТВЕТА:
{
  "categories": [
    { "slug": "<один из списка>", "confidence": 0-100, "reasoning": "<краткое обоснование>" }
  ],
  "urgency": "emergency" | "urgent" | "normal" | "flexible",
  "summary": "<1-2 предложения о том, что нужно сделать>",
  "materials": ["<материал1>", "<материал2>"],
  "priceHint": { "min": число_UZS, "max": число_UZS } | null,
  "needsOnSite": true | false
}`;
}

// ─── Основная функция ────────────────────────────────────────────────────

export async function analyzeOrder(input: AiAnalysisInput): Promise<AiAnalysisResult> {
  const { photoUrls, text, availableCategories } = input;

  if (!availableCategories.length) {
    throw ApiError.badRequest('Нет доступных категорий для AI-анализа');
  }

  const client = getClient();
  const startedAt = Date.now();

  // Готовим content для Vision: текст + изображения
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: text?.trim()
        ? `Описание клиента: ${text.trim()}`
        : 'Клиент не оставил описание — определи задачу только по фото.',
    },
  ];

  for (const url of photoUrls.slice(0, 10)) {
    // Принимаем только data:image/... или https:// — иначе пропускаем
    if (!/^(data:image\/|https?:\/\/)/i.test(url)) continue;
    userContent.push({
      type: 'image_url',
      image_url: { url, detail: 'auto' },
    });
  }

  // Если в итоге нет ни картинок, ни текста — отказ
  const hasAnyImage = userContent.some((p) => p.type === 'image_url');
  if (!hasAnyImage && !text.trim()) {
    throw ApiError.badRequest('Нужны фото или описание для AI-анализа');
  }

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: 'system', content: buildSystemPrompt(availableCategories) },
        { role: 'user', content: userContent },
      ],
    });
  } catch (err: any) {
    logger.error(
      { err: err?.message, status: err?.status, code: err?.code },
      'OpenAI Vision: запрос провален'
    );
    const userMsg =
      err?.status === 401
        ? 'AI-сервис не авторизован (проверьте OPENAI_API_KEY)'
        : err?.status === 429
        ? 'AI-сервис временно перегружен, попробуйте через минуту'
        : err?.status === 400
        ? 'AI не смог обработать изображения. Попробуйте другие фото.'
        : 'AI-анализ временно недоступен. Попробуйте ещё раз через минуту.';
    throw ApiError.badRequest(userMsg);
  }

  const latencyMs = Date.now() - startedAt;
  const content = response.choices[0]?.message?.content || '';
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    logger.error({ content: content.slice(0, 500) }, 'OpenAI Vision: ответ не JSON');
    throw ApiError.badRequest('AI вернул некорректный ответ. Попробуйте ещё раз.');
  }

  const result = normalize(parsed, availableCategories, {
    model: config.openai.model,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    latencyMs,
  });

  logger.info(
    {
      latencyMs,
      tokens: response.usage?.total_tokens,
      topCategory: result.categories[0]?.slug,
      topConfidence: result.categories[0]?.confidence,
      urgency: result.urgency,
      needsOnSite: result.needsOnSite,
    },
    'AI Vision: анализ завершён'
  );

  return result;
}

// ─── Нормализация и валидация ответа ─────────────────────────────────────

function normalize(
  raw: any,
  available: AiCategoryHint[],
  meta: AiAnalysisResult['raw']
): AiAnalysisResult {
  const allowedSlugs = new Set(available.map((c) => c.slug));

  const rawCats: any[] = Array.isArray(raw?.categories) ? raw.categories : [];
  const categories: AiCategoryGuess[] = rawCats
    .filter((c) => typeof c?.slug === 'string' && allowedSlugs.has(c.slug))
    .map((c) => ({
      slug: c.slug,
      confidence: clamp(toNum(c.confidence), 0, 100),
      reasoning: String(c.reasoning || '').slice(0, 200),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const urgency = (['emergency', 'urgent', 'normal', 'flexible'] as const).includes(raw?.urgency)
    ? (raw.urgency as AiUrgency)
    : 'normal';

  const materials = Array.isArray(raw?.materials)
    ? raw.materials.filter((m: any) => typeof m === 'string').slice(0, 20)
    : [];

  let priceHint: { min: number; max: number } | null = null;
  if (raw?.priceHint && typeof raw.priceHint === 'object') {
    const min = toNum(raw.priceHint.min);
    const max = toNum(raw.priceHint.max);
    if (min > 0 && max >= min && max < 10_000_000_000) {
      priceHint = { min, max };
    }
  }

  return {
    categories,
    urgency,
    summary: String(raw?.summary || '').slice(0, 500),
    materials,
    priceHint,
    needsOnSite: Boolean(raw?.needsOnSite),
    raw: meta,
  };
}

function toNum(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
