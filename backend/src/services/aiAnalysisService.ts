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
import { notificationService } from './notificationService.js';
import { findSimilarOrders, buildRagContext, type SimilarOrder } from './ragService.js';
import { findRelevantKnowledge, buildKnowledgeContext, type RelevantKnowledge } from './knowledgeService.js';

// Анти-спам: не дёргаем админов чаще раза в 30 минут на одну причину
const ADMIN_ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const lastAdminAlertAt = new Map<string, number>();

function alertAdminsOnce(reason: 'quota_exhausted' | 'auth_failed' | 'model_unavailable' | 'unknown', detail?: string) {
  const now = Date.now();
  const last = lastAdminAlertAt.get(reason) ?? 0;
  if (now - last < ADMIN_ALERT_COOLDOWN_MS) return;
  lastAdminAlertAt.set(reason, now);
  void notificationService
    .notifyAdminsAiProviderIssue({ reason, provider: 'OpenAI', detail })
    .catch((err) => logger.error({ err, reason }, 'alertAdminsOnce: не удалось отправить уведомление'));
}

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
  /** Визуальные теги объектов ремонта на фото — пойдут в knowledge base при закрытии заказа */
  visualTags: string[];
  /** Дополнительные данные для логирования/отладки */
  raw: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
    /** Сколько похожих заказов из истории RAG нашёл и подмешал в prompt */
    ragHits: number;
    /** Косинусная похожесть лучшего совпадения (0..1) или null */
    ragTopSimilarity: number | null;
    /** Сколько релевантных «рецептов» из knowledge base подмешано в prompt */
    knowledgeHits: number;
    /** Релевантность лучшего рецепта (0..1) или null */
    knowledgeTopSimilarity: number | null;
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

function buildSystemPrompt(
  categories: AiCategoryHint[],
  ragContext: string,
  knowledgeContext: string,
): string {
  const list = categories
    .map((c) => `  • ${c.slug} — ${c.name}`)
    .join('\n');

  // Динамические блоки — В САМОМ КОНЦЕ. Префикс системного промпта (правила и
  // список категорий) остаётся стабильным между запросами и попадает в
  // OpenAI prefix-cache (~50% скидка на input-tokens). Меняется только хвост:
  // RAG (история) + Knowledge Base (рецепты).
  const dynamicTail = [knowledgeContext, ragContext].filter(Boolean).join('\n\n');
  const tail = dynamicTail ? `\n\n${dynamicTail}` : '';

  return `Ты — AI-эксперт сервиса MasterUz (Ташкент, Узбекистан). Ты помогаешь определить, какие ремонтные/бытовые работы нужны клиенту, на основании фотографий и текста.

🔑 ГЛАВНЫЙ ПРИНЦИП — ПРИОРИТЕТ ТЕКСТА КЛИЕНТА:
- Если клиент написал/сказал что конкретное («замена выключателя», «течёт кран», «сломался ящик») — это ИСТИНА в первую очередь.
- Фото используй ТОЛЬКО для уточнения деталей (размер, материал, сложность) работы, о которой говорит клиент.
- ИГНОРИРУЙ посторонние предметы на фото (банки, еда, люди, животные, инструмент, мусор, телефон в руке и т.п.) — это ФОН, не предмет ремонта.
- Целевой объект на фото — тот, который СООТВЕТСТВУЕТ описанию клиента. Если клиент сказал «выключатель» — ищи на фото выключатель, даже если он в углу и рядом стоит банка энергетика.
- Если текст клиента и фото РАСХОДЯТСЯ — верь тексту. Только если текста нет вообще — опирайся на фото.
- КЛЮЧЕВЫЕ СЛОВА → ПРЯМОЕ СООТВЕТСТВИЕ:
  • «выключатель», «розетка», «свет», «проводка», «люстра» → электрика
  • «кран», «смеситель», «унитаз», «течёт», «засор», «сифон» → сантехника
  • «ящик», «дверца», «петля», «ручка мебели», «собрать шкаф» → мебель
  • «покрасить», «обои», «шпаклёвка», «плитка» → отделка
  • «замок», «дверь» (входная/межкомнатная) → дверные
  С этими словами confidence ОБЯЗАТЕЛЬНО ≥ 90.

ТВОИ ЗАДАЧИ:
1. Сначала прочитай текст клиента, затем посмотри фото
2. Определи 1–3 наиболее вероятные категории работ ИЗ СПИСКА НИЖЕ (ничего вне списка)
3. Оцени свою уверенность от 0 до 100 (90+ = я точно вижу проблему; 60–89 = вероятно, но нужно подтверждение; <60 = недостаточно данных)
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

ПРИНЦИП «МАКСИМАЛЬНОГО УПРОЩЕНИЯ» ДЛЯ КЛИЕНТА:
- Клиент уже описал проблему голосом/текстом + приложил фото — этого достаточно.
- НЕ запрашивай дополнительных уточнений у клиента (никаких «сколько единиц», «какие габариты»).
- Если описана единичная поломка («сломан выдвижной ящик», «не работает розетка», «течёт кран», «починить дверцу», «заменить замок») и видно фото — ставь confidence ≥ 80 и needsOnSite: false.
- При сомнении между несколькими категориями — выбери самую вероятную с confidence 75–85, не возвращай 50/50.

🧠 КОГДА needsOnSite = false (МЕЛКАЯ РАБОТА — БОЛЬШИНСТВО СЛУЧАЕВ):
Если по фото и описанию ОЧЕВИДНО, что работа локальная и материалов уйдёт мало — рассчитай сам, без выезда. Примеры:
- Заделать щель/трещину под дверью, в стене, между плиткой → 0.5–1 кг цемента/шпаклёвки/герметика
- Залить раствором небольшой участок (≤ 0.5 м²)
- Зашпаклевать дыру от дюбеля, замазать трещину
- Подкрасить участок, замазать царапину
- Приклеить плинтус, отвалившуюся плитку (1–3 шт)
- Прикрутить полку, повесить картину, установить карниз
- Герметизировать стык ванны / раковины / окна
- Затереть шов между плитками
- Заменить силиконовый шов
- Подтянуть петли, отрегулировать дверь
- Прочистить сифон, заменить прокладку
Для таких работ ВСЕГДА: confidence ≥ 80, needsOnSite: false, priceHint в диапазоне 80–250 тыс UZS (минимальный выезд мастера в Ташкенте).

🚧 КОГДА needsOnSite = true (РЕДКО — только крупные объёмы):
ТОЛЬКО для работ, где объём измеряется квадратными/погонными метрами и клиент его не знает:
- Покраска ВСЕЙ комнаты/квартиры (не локальный участок)
- Укладка плитки на пол/стену площадью > 2 м²
- Стяжка пола во всей комнате
- Поклейка обоев в комнате
- Кровельные работы
- Капитальный ремонт «под ключ»
- Утепление фасада
ВАЖНО: само по себе слово «раствор», «цемент», «штукатурка», «шпаклёвка» НЕ означает needsOnSite=true — смотри на ОБЪЁМ. «Залить раствором щель» = мелкая работа. «Залить стяжку» = крупная.

🔍 ОЦЕНКА РАЗМЕРА И СЛОЖНОСТИ ПО ФОТО (КРИТИЧНО для priceHint):
- ВНИМАТЕЛЬНО оцени габариты предмета по фото: используй стандарты комнаты (плинтус ~10см, дверь ~2м, розетка ~8см, плитка пола ~30-60см).
- Для МЕБЕЛИ обязательно различай:
  • Маленький предмет (тумба, комод до 80см, стеллаж до 1м) — простая работа
  • Шкаф средний (до 1.8м высоты, до 1.5м ширины) — средняя
  • Шкаф-купе / гардероб / до потолка / шириной 2м+ — КРУПНАЯ работа (одна стоит 400-600к)
  • Гарнитур / кухня / комплект 2-3 предмета — премиум (600-1200к)
- РАЗЛИЧАЙ «собрать» и «разобрать/демонтаж»:
  • «разобрать», «демонтаж», «снять», «вывезти», «утилизировать» = РАЗБОРКА (≈70% цены сборки, но крупный шкаф = 300-500к)
  • «собрать», «установить», «поставить» = СБОРКА
- Не занижай цену! Если на фото явно крупная мебель/большая работа — priceHint min должен быть РЕАЛЬНЫМ рыночным минимумом, даже если клиент написал коротко.

💰 РЫНОЧНЫЕ ОРИЕНТИРЫ ТАШКЕНТА 2026 (UZS):
- Заделка щели/трещины/дыры локально, силиконовый шов, подкрасить участок: 80–200 тыс (минимальный выезд)
- Прикрутить полку/карниз/повесить картину: 80–150 тыс
- Замена розетки: 50–80 тыс
- Замена смесителя: 100–180 тыс
- Сборка маленького комода/стеллажа: 150–250 тыс
- Сборка/разборка шкафа-купе крупного: 350–550 тыс
- Сборка комплекта (2-3 предмета): 500–900 тыс
- Покраска комнаты 15м²: 600–1200 тыс
- Укладка плитки 5м²: 400–700 тыс

СХЕМА ОТВЕТА:
{
  "categories": [
    { "slug": "<один из списка>", "confidence": 0-100, "reasoning": "<краткое обоснование>" }
  ],
  "urgency": "emergency" | "urgent" | "normal" | "flexible",
  "summary": "<1-2 предложения о том, что нужно сделать>",
  "materials": ["<материал1>", "<материал2>"],
  "priceHint": { "min": число_UZS, "max": число_UZS } | null,
  "needsOnSite": true | false,
  "visualTags": ["<конкретный объект ремонта 1>", "<объект 2>"]
}

ОБЯЗАТЕЛЬНО заполняй visualTags 3-8 КОНКРЕТНЫМИ объектами ремонта, которые видишь на фото
(«дверной замок автомобиля», «личинка цилиндра», «врезной замок», «выключатель Schneider»,
«латунный смеситель Grohe»). Не используй общие слова («дверь», «деталь»).
Эти теги попадут в базу знаний и помогут будущим запросам.${tail}`;
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
      image_url: { url, detail: 'high' },
    });
  }

  // Если в итоге нет ни картинок, ни текста — отказ
  const hasAnyImage = userContent.some((p) => p.type === 'image_url');
  if (!hasAnyImage && !text.trim()) {
    throw ApiError.badRequest('Нужны фото или описание для AI-анализа');
  }

  // ─── RAG: ищем похожие закрытые заказы в истории ─────────────────────
  // Best-effort: при любой ошибке возвращается [] и анализ идёт без подсказок.
  // Поиск только по тексту клиента — на этом этапе категория ещё не определена.
  let similar: SimilarOrder[] = [];
  let knowledge: RelevantKnowledge[] = [];
  if (text.trim()) {
    [similar, knowledge] = await Promise.all([
      findSimilarOrders({ description: text.trim() }),
      findRelevantKnowledge({ description: text.trim(), limit: config.rag.knowledgeTopK }),
    ]);
  }
  const ragContext = buildRagContext(similar);
  const knowledgeContext = buildKnowledgeContext(knowledge);

  // Список моделей в порядке приоритета: основная → дешёвый fallback.
  // Если у аккаунта нет квоты на gpt-4o, gpt-4o-mini обычно остаётся доступен.
  const primary = config.openai.model;
  const fallback = primary === 'gpt-4o-mini' ? null : 'gpt-4o-mini';
  const modelChain = [primary, fallback].filter(Boolean) as string[];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let response: any = null;
  let lastErr: any = null;

  outer: for (const model of modelChain) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await client.chat.completions.create({
          model,
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 800,
          messages: [
            { role: 'system', content: buildSystemPrompt(availableCategories, ragContext, knowledgeContext) },
            { role: 'user', content: userContent },
          ],
        });
        if (model !== primary) {
          logger.warn({ primary, fallback: model }, 'AI Vision: переключились на fallback-модель');
        }
        break outer;
      } catch (err: any) {
        lastErr = err;
        const status: number | undefined = err?.status;
        const code: string | undefined = err?.code || err?.error?.code;

        // Постоянные ошибки — не ретраим, пробуем следующую модель сразу.
        const isQuota = code === 'insufficient_quota';
        const isModelMissing = status === 404 || code === 'model_not_found';
        const isAuth = status === 401;
        const isBadRequest = status === 400;
        if (isQuota || isModelMissing || isAuth || isBadRequest) break;

        // Временные ошибки (429 rate_limit, 5xx) — экспоненциальный backoff
        const isTransient = status === 429 || (status !== undefined && status >= 500);
        if (!isTransient || attempt === 2) break;
        const delayMs = 500 * 2 ** attempt; // 500, 1000, 2000
        logger.warn({ model, attempt: attempt + 1, status, code }, 'AI Vision: ретрай после ошибки');
        await sleep(delayMs);
      }
    }
    if (response) break;
  }

  if (!response) {
    const err = lastErr;
    const status: number | undefined = err?.status;
    const code: string | undefined = err?.code || err?.error?.code;

    logger.error(
      { err: err?.message, status, code },
      'OpenAI Vision: запрос провален после всех попыток'
    );

    // Критичные постоянные ошибки → оповещаем админов (с троттлингом)
    if (code === 'insufficient_quota') {
      alertAdminsOnce('quota_exhausted', err?.message);
    } else if (status === 401) {
      alertAdminsOnce('auth_failed', err?.message);
    } else if (code === 'model_not_found' || status === 404) {
      alertAdminsOnce('model_unavailable', err?.message);
    }

    const userMsg =
      status === 401
        ? 'AI-сервис не авторизован: проверьте OPENAI_API_KEY.'
        : code === 'insufficient_quota'
        ? 'AI-сервис недоступен: исчерпан баланс OpenAI. Свяжитесь с администратором для пополнения.'
        : status === 429
        ? 'AI-сервис временно перегружен, попробуйте через минуту.'
        : status === 400
        ? 'AI не смог обработать изображения. Попробуйте другие фото или сократите текст.'
        : code === 'model_not_found'
        ? 'AI-модель недоступна для вашего аккаунта OpenAI. Включите доступ к gpt-4o-mini.'
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
    ragHits: similar.length,
    ragTopSimilarity: similar[0]?.similarity ?? null,
    knowledgeHits: knowledge.length,
    knowledgeTopSimilarity: knowledge[0]?.similarity ?? null,
  });

  logger.info(
    {
      latencyMs,
      tokens: response.usage?.total_tokens,
      topCategory: result.categories[0]?.slug,
      topConfidence: result.categories[0]?.confidence,
      urgency: result.urgency,
      needsOnSite: result.needsOnSite,
      ragHits: similar.length,
      ragTopSimilarity: similar[0]?.similarity ?? null,
      knowledgeHits: knowledge.length,
      knowledgeTopSimilarity: knowledge[0]?.similarity ?? null,
      visualTags: result.visualTags.length,
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

  const visualTags: string[] = Array.isArray(raw?.visualTags)
    ? raw.visualTags
        .filter((t: any) => typeof t === 'string')
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length >= 3 && t.length <= 80)
        .slice(0, 12)
    : [];

  return {
    categories,
    urgency,
    summary: String(raw?.summary || '').slice(0, 500),
    materials,
    priceHint,
    needsOnSite: Boolean(raw?.needsOnSite),
    visualTags,
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
