// ============================================
// MasterUz — Прайс-движок
// ============================================
//
// Читает прайс-реестр из БД и считает смету детерминированно:
//
//   цена = Σ(труд × количество × множители) + Σ(материалы × количество)
//
// Ключевое отличие от прежнего расчёта: цену не называет языковая модель.
// Модель определяет, ЧТО делать и в каком объёме, а сумму даёт реестр,
// который правится из админки и подтягивается к реальным сделкам.
//
// Множители (срочность, район, этаж, доступ, сезон) применяются только к
// труду: аварийный вызов не делает герметик дороже.
// ============================================

import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
  applyQuantity,
  scaleVariantsToPriceHint,
  dropVisitFeeOnCheapVariant,
  TIER_LABELS,
  roundUnitPrice,
  type EstimateVariant,
  type PricedLine,
} from './pricing-catalog.js';

// ─── Снимок реестра в памяти ─────────────────────────────────────────────
// Реестр читается на каждый заказ и меняется редко. Держим слепок в памяти
// и сбрасываем его при любой правке через админку.

interface BookLine {
  /** Код позиции прайса — по нему спецификация от Vision находит строку. */
  code: string;
  name: string;
  unit: string;
  kind: 'LABOR' | 'MATERIAL';
  unitPrice: number;
  minCheck: number;
  qty: number;
}

interface BookSolution {
  tier: 'GOOD' | 'BETTER' | 'BEST';
  title: string;
  description: string;
  days: number;
  materialClass: 'STANDARD' | 'ENHANCED' | 'PREMIUM';
  lines: BookLine[];
}

interface BookProblem {
  slug: string;
  categorySlug: string;
  name: string;
  keywords: string[];
  solutions: BookSolution[];
}

interface PriceBookSnapshot {
  problems: BookProblem[];
  /** Множители по типу и ключу: modifiers.URGENCY.emergency → 1.3 */
  modifiers: Record<string, Record<string, number>>;
  loadedAt: number;
}

let snapshot: PriceBookSnapshot | null = null;
let loading: Promise<PriceBookSnapshot> | null = null;

/** Сбросить слепок — вызывается после любой правки прайса из админки. */
export function invalidatePriceBookCache(): void {
  snapshot = null;
  loading = null;
}

async function loadSnapshot(): Promise<PriceBookSnapshot> {
  const [problems, modifiers] = await Promise.all([
    prisma.priceProblem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        solutions: {
          include: {
            lines: {
              orderBy: { sortOrder: 'asc' },
              include: { item: true },
            },
          },
        },
      },
    }),
    prisma.priceModifier.findMany({ where: { isActive: true } }),
  ]);

  const modifierMap: Record<string, Record<string, number>> = {};
  for (const m of modifiers) {
    (modifierMap[m.type] ||= {})[m.key] = Number(m.factor);
  }

  return {
    problems: problems.map((p) => ({
      slug: p.slug,
      categorySlug: p.categorySlug,
      name: p.name,
      keywords: p.keywords,
      solutions: p.solutions.map((s) => ({
        tier: s.tier as BookSolution['tier'],
        title: s.title,
        description: s.description,
        days: s.days,
        materialClass: s.materialClass as BookSolution['materialClass'],
        lines: s.lines
          .filter((l) => l.item.isActive)
          .map((l) => ({
            code: l.item.code,
            name: l.item.name,
            unit: l.item.unit,
            kind: l.item.kind as BookLine['kind'],
            unitPrice: Number(l.item.unitPrice),
            minCheck: Number(l.item.minCheck),
            qty: Number(l.qty),
          })),
      })),
    })),
    modifiers: modifierMap,
    loadedAt: Date.now(),
  };
}

async function getSnapshot(): Promise<PriceBookSnapshot> {
  const fresh = snapshot && Date.now() - snapshot.loadedAt < config.pricebook.cacheTtlMs;
  if (fresh) return snapshot!;
  // Параллельные запросы ждут один и тот же прогрев, а не бьют в БД каждый.
  loading ||= loadSnapshot()
    .then((s) => {
      snapshot = s;
      loading = null;
      return s;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

// ─── Подбор проблемы ─────────────────────────────────────────────────────

/**
 * Совпадение описания с проблемой реестра.
 *
 * Вес ключевого слова определяется его конкретностью (числом значимых слов),
 * а не длиной строки. Прежний скоринг складывал `kw.length`, из-за чего
 * длинная общая фраза побеждала короткое точное совпадение.
 *
 * В неделю 3 этот подбор заменяется векторным поиском по эмбеддингам.
 */
export function scoreProblemMatch(keywords: string[], description: string): number {
  const lower = description.toLowerCase().replace(/ё/g, 'е');
  if (!lower.trim()) return 0;

  const stem = (w: string) =>
    w.replace(/(ами|ями|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ие|ые|ую|юю|ого|его|ому|ему|ость|ам|ям|ах|ях|ен|ан|у|ю|а|я|и|ы|о|е|ь)$/i, '');

  const descStems = lower
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map(stem);

  let score = 0;
  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().replace(/ё/g, 'е');
    const words = kw.split(/\s+/).filter((w) => w.length > 2);
    // Многословный ключ конкретнее односложного — он и весит больше.
    const weight = 1 + 0.5 * Math.max(0, words.length - 1);

    if (lower.includes(kw)) {
      score += weight;
      continue;
    }
    if (words.length === 0) continue;

    const kwStems = words.map(stem).filter((s) => s.length >= 3);
    if (kwStems.length === 0) continue;

    // Совпасть должны ВСЕ значимые слова ключа, иначе «замена трубы»
    // сработала бы на любом упоминании замены.
    const allMatch = kwStems.every((ks) =>
      descStems.some((ds) => ds.length >= 3 && (ds.startsWith(ks) || ks.startsWith(ds))),
    );
    if (allMatch) score += weight * 0.8;
  }

  return score;
}

/** Минимальный вес совпадения, ниже которого считаем, что проблема не найдена. */
const MATCH_THRESHOLD = 1;

export async function findProblemInBook(
  categorySlug: string,
  description: string,
  aiContext?: string,
): Promise<BookProblem | null> {
  const book = await getSnapshot();
  const candidates = book.problems.filter((p) => p.categorySlug === categorySlug);
  if (candidates.length === 0) return null;

  const scored = candidates.map((problem) => ({
    problem,
    text: scoreProblemMatch(problem.keywords, description),
    photo: aiContext ? scoreProblemMatch(problem.keywords, aiContext) : 0,
  }));

  // Слова клиента решают; фото разрешает ничью между ними — когда клиент
  // написал лишь «собрать», какой предмет собирать, видно только на снимке.
  // Правило общее с каталогом в коде: иначе пути разошлись бы в выборе.
  const byText = [...scored].sort((x, y) => y.text - x.text || y.photo - x.photo)[0];
  if (byText && byText.text >= MATCH_THRESHOLD) return byText.problem;

  const byPhoto = [...scored].sort((x, y) => y.photo - x.photo)[0];
  return byPhoto && byPhoto.photo >= MATCH_THRESHOLD ? byPhoto.problem : null;
}

// ─── Расчёт ──────────────────────────────────────────────────────────────

export interface PriceBookQuery {
  categorySlug: string;
  description: string;
  /** Количество единиц штучной работы из описания клиента. */
  quantity?: number | null;
  /** Уверенность в смете, посчитанная из сигналов. */
  confidence?: number;
  urgency?: 'emergency' | 'urgent' | 'normal' | 'flexible';
  region?: string;
  floorNoLift?: boolean;
  tightAccess?: boolean;
  /** Диапазон, который назвал Vision. Используется, пока действует старый контракт. */
  aiPriceHint?: { min: number; max: number } | null;
  /** Что увидел Vision: резюме, объекты на фото, материалы. */
  aiContext?: string;
}

/** Итоговый множитель труда: произведение активных модификаторов. */
export function resolveLaborMultiplier(
  modifiers: PriceBookSnapshot['modifiers'],
  query: PriceBookQuery,
): number {
  if (!config.pricebook.modifiersEnabled) return 1;

  let factor = 1;
  // Срочность платформа берёт отдельно и по явному выбору клиента
  // (галочка «срочно» → Order.urgentMultiplier). Здесь она участвует только
  // если админ сознательно выставит множитель — по умолчанию он 1.000,
  // иначе наценка начислялась бы дважды и без объяснения в чеке.
  if (query.urgency) factor *= modifiers.URGENCY?.[query.urgency] ?? 1;
  if (query.region) factor *= modifiers.REGION?.[query.region] ?? 1;
  if (query.floorNoLift) factor *= modifiers.FLOOR?.['no-lift-above-3'] ?? 1;
  if (query.tightAccess) factor *= modifiers.ACCESS?.['tight'] ?? 1;

  // Потолок на случай, если админ выставит несколько агрессивных множителей.
  return Math.min(Math.max(factor, 0.5), 2);
}

const MATERIAL_CLASS_NOTE: Record<BookSolution['materialClass'], string> = {
  STANDARD: 'Стандартные комплектующие.',
  ENHANCED: 'Комплектующие повышенного класса.',
  PREMIUM: 'Премиум-комплектующие.',
};

const TIER_ORDER: Array<BookSolution['tier']> = ['GOOD', 'BETTER', 'BEST'];

/**
 * Построить смету из реестра. Возвращает null, если проблема не найдена —
 * вызывающий код уходит на резервный путь.
 */
export async function buildVariantsFromPriceBook(
  query: PriceBookQuery,
): Promise<{ problemName: string; problemSlug: string; variants: EstimateVariant[] } | null> {
  const problem = await findProblemInBook(query.categorySlug, query.description, query.aiContext);
  if (!problem || problem.solutions.length === 0) return null;

  const book = await getSnapshot();
  const laborMultiplier = resolveLaborMultiplier(book.modifiers, query);
  const confidence = query.confidence ?? 0.75;

  const ordered = [...problem.solutions].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  let variants: EstimateVariant[] = ordered.map((solution) => {
    const works: PricedLine[] = [];
    const materials: PricedLine[] = [];

    for (const line of solution.lines) {
      if (line.kind === 'LABOR') {
        // Множители — только к труду. Без множителей цена проходит как есть:
        // округлять неизменённую каталожную цену незачем, а на дешёвых
        // позициях вроде 500 сум за м² это ещё и искажает смету.
        const unitPrice = Math.max(
          laborMultiplier === 1 ? line.unitPrice : roundUnitPrice(line.unitPrice * laborMultiplier),
          line.minCheck,
        );
        works.push({ code: line.code, name: line.name, qty: line.qty, unit: line.unit, unitPrice, total: Math.round(line.qty * unitPrice) });
      } else {
        materials.push({
          code: line.code,
          name: line.name,
          qty: line.qty,
          unit: line.unit,
          unitPrice: line.unitPrice,
          total: Math.round(line.qty * line.unitPrice),
        });
      }
    }

    const estimatedPrice =
      works.reduce((s, w) => s + w.total, 0) + materials.reduce((s, m) => s + m.total, 0);

    return {
      tier: solution.tier,
      tierLabel: TIER_LABELS[solution.tier] ?? solution.tier,
      title: solution.title,
      description: `${solution.description} ${MATERIAL_CLASS_NOTE[solution.materialClass]}`.trim(),
      works,
      materials,
      estimatedPrice,
      estimatedDays: solution.days,
      confidence,
    };
  });

  // Те же правила, что и у каталожного пути — расчёт обязан совпадать
  // независимо от источника позиций.
  variants = applyQuantity(variants, query.quantity);
  variants = scaleVariantsToPriceHint(variants, query.aiPriceHint);
  variants = dropVisitFeeOnCheapVariant(variants);

  logger.debug(
    { problem: problem.slug, laborMultiplier, quantity: query.quantity ?? 1 },
    'Прайс-движок: смета собрана из реестра',
  );

  return { problemName: problem.name, problemSlug: problem.slug, variants };
}

/** Готов ли реестр к работе: есть ли в нём хоть одна проблема с решениями. */
export async function isPriceBookReady(): Promise<boolean> {
  if (!config.pricebook.enabled) return false;
  try {
    const book = await getSnapshot();
    return book.problems.some((p) => p.solutions.length > 0);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Прайс-движок: реестр недоступен, идём по каталогу в коде');
    return false;
  }
}

// ─── Смета по спецификации работ ─────────────────────────────────────────
//
// Это конечная точка нового контракта: модель вернула коды работ и объём,
// сумму считает реестр. Языковая модель больше не участвует в цене.

export interface JobSpec {
  workCode: string;
  qty: number;
  unit: string;
  evidence?: string;
}

/** Надбавка за класс комплектующих, доля от труда. */
const MATERIAL_CLASS_UPLIFT: Record<'GOOD' | 'BETTER' | 'BEST', number> = {
  GOOD: 0,
  BETTER: 0.12,
  BEST: 0.28,
};

const MATERIAL_CLASS_TITLE: Record<'GOOD' | 'BETTER' | 'BEST', string> = {
  GOOD: 'Стандартные комплектующие',
  BETTER: 'Комплектующие повышенного класса',
  BEST: 'Премиум-комплектующие',
};

/**
 * Собрать смету из перечня работ, который вернул Vision.
 *
 * Если коды работ принадлежат одной проблеме реестра — берём её готовые
 * решения GOOD/BETTER/BEST и подменяем в них объём на измеренный по фото.
 * Так сохраняется продуманный состав решения, но количество перестаёт быть
 * каталожной единицей «одна штука».
 *
 * Если коды пришли из каталога услуг (проблемы для них ещё нет) — строим
 * три уровня на одном и том же объёме работ, различая класс комплектующих.
 */
export async function buildVariantsFromJobs(
  jobs: JobSpec[],
  query: Omit<PriceBookQuery, 'description'> & { description?: string },
): Promise<{ problemName: string; problemSlug: string | null; variants: EstimateVariant[] } | null> {
  if (jobs.length === 0) return null;

  const codes = Array.from(new Set(jobs.map((j) => j.workCode)));
  const items = await prisma.priceItem.findMany({ where: { code: { in: codes }, isActive: true } });
  if (items.length === 0) return null;

  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const qtyByCode = new Map<string, number>();
  for (const job of jobs) {
    if (!itemByCode.has(job.workCode)) continue;
    // Один код может прийти несколькими строками — объёмы складываем.
    qtyByCode.set(job.workCode, (qtyByCode.get(job.workCode) ?? 0) + job.qty);
  }
  if (qtyByCode.size === 0) return null;

  const book = await getSnapshot();
  const laborMultiplier = resolveLaborMultiplier(book.modifiers, query as PriceBookQuery);
  const confidence = query.confidence ?? 0.75;

  // Множители — только к труду. Без множителей цена проходит как есть.
  const priceLabor = (unitPrice: number, minCheck: number): number =>
    Math.max(laborMultiplier === 1 ? unitPrice : roundUnitPrice(unitPrice * laborMultiplier), minCheck);

  // ─── Ищем проблему, которой принадлежит большинство кодов ───
  const matchingLines = await prisma.priceSolutionLine.findMany({
    where: { item: { code: { in: codes } } },
    include: { solution: { include: { problem: true } } },
  });

  const hitsByProblem = new Map<string, number>();
  for (const line of matchingLines) {
    const id = line.solution.problemId;
    hitsByProblem.set(id, (hitsByProblem.get(id) ?? 0) + 1);
  }
  const bestProblemId = Array.from(hitsByProblem.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (bestProblemId) {
    const bestSlug = matchingLines.find((l) => l.solution.problemId === bestProblemId)?.solution.problem.slug;
    const problem = bestSlug ? book.problems.find((p) => p.slug === bestSlug) : undefined;

    if (problem && problem.solutions.length > 0) {
      const variants: EstimateVariant[] = problem.solutions.map((solution) => {
        const works: PricedLine[] = [];
        const materials: PricedLine[] = [];

        for (const line of solution.lines) {
          // Объём из спецификации перекрывает каталожный: модель измерила
          // объект по фото, каталог знает лишь «одна единица».
          const measured = line.kind === 'LABOR' ? qtyByCode.get(line.code) : undefined;
          const qty = measured ?? line.qty;

          if (line.kind === 'LABOR') {
            const unitPrice = priceLabor(line.unitPrice, line.minCheck);
            works.push({ code: line.code, name: line.name, qty, unit: line.unit, unitPrice, total: Math.round(qty * unitPrice) });
          } else {
            materials.push({
              code: line.code,
              name: line.name,
              qty,
              unit: line.unit,
              unitPrice: line.unitPrice,
              total: Math.round(qty * line.unitPrice),
            });
          }
        }

        const estimatedPrice =
          works.reduce((s, w) => s + w.total, 0) + materials.reduce((s, m) => s + m.total, 0);

        return {
          tier: solution.tier,
          tierLabel: TIER_LABELS[solution.tier] ?? solution.tier,
          title: solution.title,
          description: solution.description,
          works,
          materials,
          estimatedPrice,
          estimatedDays: solution.days,
          confidence,
        };
      });

      return {
        problemName: problem.name,
        problemSlug: problem.slug,
        variants: dropVisitFeeOnCheapVariant(variants),
      };
    }
  }

  // ─── Проблемы нет: три уровня на одном объёме ───
  const tiers: Array<'GOOD' | 'BETTER' | 'BEST'> = ['GOOD', 'BETTER', 'BEST'];
  const variants: EstimateVariant[] = tiers.map((tier) => {
    const works: PricedLine[] = [];
    let minutes = 0;

    for (const [code, qty] of qtyByCode) {
      const item = itemByCode.get(code)!;
      const unitPrice = priceLabor(Number(item.unitPrice), Number(item.minCheck));
      works.push({ code: item.code, name: item.name, qty, unit: item.unit, unitPrice, total: Math.round(qty * unitPrice) });
      minutes += item.laborMinutes * qty;
    }

    const laborTotal = works.reduce((s, w) => s + w.total, 0);
    const materials: PricedLine[] = [];
    const uplift = roundUnitPrice(laborTotal * MATERIAL_CLASS_UPLIFT[tier]);
    if (uplift > 0) {
      materials.push({
        name: MATERIAL_CLASS_TITLE[tier],
        qty: 1,
        unit: 'компл.',
        unitPrice: uplift,
        total: uplift,
      });
    }

    return {
      tier,
      tierLabel: TIER_LABELS[tier] ?? tier,
      title: works.map((w) => w.name).slice(0, 2).join(', ') || 'Работы по заказу',
      description: `${MATERIAL_CLASS_TITLE[tier]}. Объём работ определён по фотографии.`,
      works,
      materials,
      estimatedPrice: laborTotal + materials.reduce((s, m) => s + m.total, 0),
      // Шесть рабочих часов в дне.
      estimatedDays: Math.max(1, Math.ceil(minutes / 60 / 6)),
      confidence,
    };
  });

  return {
    problemName: variants[0].title,
    problemSlug: null,
    variants: dropVisitFeeOnCheapVariant(variants),
  };
}

// ─── Диапазон цены по реальным сделкам ───────────────────────────────────

/** Разброс, при котором одна цифра ещё честна. */
const FIXED_PRICE_SPREAD = 0.3;
/** Неоткалиброванной позиции даём симметричный допуск. */
const UNCALIBRATED_TOLERANCE = 0.1;

/**
 * Подставить в смету диапазон, посчитанный по квартилям реальных сделок.
 *
 * Для откалиброванных позиций берутся P25 и P75, для остальных — цена ±10 %.
 * Материалы идут по фиксированной каталожной цене: их разброс определяется
 * магазином, а не мастером.
 *
 * Клиенту показывается одна сумма только при узком итоговом разбросе.
 * Обещание «ровно 900 000» там, где сделки идут от 600 тысяч до 1,3 млн,
 * стоит дороже любой неточности модели: его нечем сдержать.
 */
export async function attachPriceRanges(variants: EstimateVariant[]): Promise<EstimateVariant[]> {
  const codes = Array.from(
    new Set(variants.flatMap((v) => v.works.map((w) => w.code).filter((c): c is string => !!c))),
  );
  if (codes.length === 0) return variants;

  const items = await prisma.priceItem.findMany({
    where: { code: { in: codes } },
    select: { code: true, priceP25: true, priceP75: true, sampleSize: true },
  });
  const stats = new Map(items.map((i) => [i.code, i]));

  return variants.map((variant) => {
    let min = 0;
    let max = 0;

    for (const work of variant.works) {
      const stat = work.code ? stats.get(work.code) : undefined;
      const hasQuartiles = stat?.priceP25 && stat?.priceP75 && stat.sampleSize > 0;

      if (hasQuartiles) {
        min += work.qty * Number(stat!.priceP25);
        max += work.qty * Number(stat!.priceP75);
      } else {
        min += work.total * (1 - UNCALIBRATED_TOLERANCE);
        max += work.total * (1 + UNCALIBRATED_TOLERANCE);
      }
    }

    const materialsTotal = variant.materials.reduce((s, m) => s + m.total, 0);
    min = Math.round((min + materialsTotal) / 1000) * 1000;
    max = Math.round((max + materialsTotal) / 1000) * 1000;

    // Диапазон обязан накрывать саму смету: иначе клиент видит цену вне
    // собственного диапазона и перестаёт верить обоим числам.
    min = Math.min(min, variant.estimatedPrice);
    max = Math.max(max, variant.estimatedPrice);

    const mid = (min + max) / 2;
    const spread = mid > 0 ? (max - min) / mid : 1;

    return { ...variant, priceRange: { min, max }, priceIsFixed: spread <= FIXED_PRICE_SPREAD };
  });
}

// ─── Эмбеддинги проблем ──────────────────────────────────────────────────

/**
 * Текст, который векторизуется для поиска проблемы.
 * Одно правило для записи и для поиска — иначе вектора несравнимы.
 */
export function problemEmbeddingText(problem: {
  name: string;
  keywords: string[];
  solutions: { title: string }[];
}): string {
  return [problem.name, problem.keywords.join(', '), problem.solutions.map((s) => s.title).join('. ')]
    .filter(Boolean)
    .join('. ');
}

export interface EmbedResult {
  total: number;
  embedded: number;
  skipped: number;
  failed: { slug: string; error: string }[];
}

/**
 * Посчитать векторы для проблем реестра.
 *
 * Без них подбор работ идёт по ключевым словам и не понимает формулировок
 * вроде «не держит воду» — общих слов с «протечкой» там нет ни одного.
 *
 * Живёт в сервисе, а не только в скрипте: ключ OpenAI есть у приложения,
 * и пересчёт нужен админу после каждой правки проблем в панели.
 */
export async function embedProblems(options: { force?: boolean } = {}): Promise<EmbedResult> {
  const { getEmbedding, toVectorLiteral } = await import('../../services/embeddingService.js');

  const problems = await prisma.priceProblem.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, keywords: true, solutions: { select: { title: true } } },
    orderBy: { slug: 'asc' },
  });

  // Prisma не читает столбец vector — какие уже посчитаны, узнаём сырым запросом.
  const withVector = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "price_problems" WHERE "embedding" IS NOT NULL`,
  );
  const done = new Set(withVector.map((r) => r.id));

  const todo = options.force ? problems : problems.filter((p) => !done.has(p.id));
  const result: EmbedResult = {
    total: problems.length,
    embedded: 0,
    skipped: problems.length - todo.length,
    failed: [],
  };

  for (const problem of todo) {
    try {
      const vector = await getEmbedding(problemEmbeddingText(problem));
      await prisma.$executeRawUnsafe(
        `UPDATE "price_problems" SET "embedding" = $1::vector WHERE "id" = $2`,
        toVectorLiteral(vector),
        problem.id,
      );
      result.embedded += 1;
    } catch (err) {
      result.failed.push({ slug: problem.slug, error: (err as Error).message });
    }
  }

  if (result.embedded > 0) invalidatePriceBookCache();

  logger.info(
    { total: result.total, embedded: result.embedded, skipped: result.skipped, failed: result.failed.length },
    'Прайс-реестр: эмбеддинги проблем пересчитаны',
  );

  return result;
}

/** Сколько проблем реестра уже имеют вектор — видно, готов ли семантический подбор. */
export async function getEmbeddingCoverage(): Promise<{ total: number; embedded: number; coveragePct: number }> {
  const [total, rows] = await Promise.all([
    prisma.priceProblem.count({ where: { isActive: true } }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "price_problems" WHERE "embedding" IS NOT NULL AND "is_active" = true`,
    ),
  ]);
  const embedded = Number(rows[0]?.count ?? 0);
  return { total, embedded, coveragePct: total > 0 ? (embedded / total) * 100 : 0 };
}
