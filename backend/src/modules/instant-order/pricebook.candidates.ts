// ============================================
// MasterUz — Кандидаты позиций прайса для Vision
// ============================================
//
// Модель не должна выбирать работу из шестисот позиций: это и дорого по
// токенам, и провоцирует выдумывать несуществующие коды. Вместо этого мы
// заранее находим два десятка кандидатов и просим выбрать из них.
//
// Поиск двухступенчатый:
//   1. Векторный по эмбеддингам проблем (pgvector, HNSW) — понимает смысл,
//      а не совпадение букв: «не держит воду» находит протечку.
//   2. Если эмбеддингов ещё нет или вектор не получен — ключевые слова.
//
// Второй шаг обязателен: эмбеддинги заполняются отдельным скриптом, и до
// его прогона подбор обязан продолжать работать.
// ============================================

import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { getEmbedding, toVectorLiteral } from '../../services/embeddingService.js';
import { scoreProblemMatch } from './pricebook.service.js';

export interface WorkCandidate {
  /** Код позиции прайса — именно его модель возвращает в ответе. */
  code: string;
  name: string;
  unit: string;
  categorySlug: string;
  /** Проблема, в решение которой входит позиция (для группировки в промпте). */
  problemName: string | null;
}

/** Сколько позиций уходит в промпт. Больше — дороже и не точнее. */
const DEFAULT_LIMIT = 20;
/** Сколько проблем берём вектором перед разворачиванием в позиции. */
const PROBLEM_TOP_K = 5;

/**
 * Найти проблемы, семантически близкие к описанию.
 * Возвращает [] при любой ошибке — подбор обязан деградировать, а не падать.
 */
async function findProblemsByVector(
  text: string,
  categorySlugs: string[],
  limit: number,
): Promise<{ id: string; slug: string; name: string; similarity: number }[]> {
  if (!config.rag.enabled) return [];

  let vector: number[];
  try {
    vector = await getEmbedding(text);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Подбор позиций: эмбеддинг не получен — идём по ключевым словам');
    return [];
  }

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; slug: string; name: string; distance: number }>
    >(
      `
      SELECT p."id", p."slug", p."name", (p."embedding" <=> $1::vector) AS "distance"
      FROM "price_problems" p
      WHERE p."embedding" IS NOT NULL
        AND p."is_active" = true
        AND ($2::text[] IS NULL OR p."category_slug" = ANY($2::text[]))
      ORDER BY p."embedding" <=> $1::vector
      LIMIT $3
      `,
      toVectorLiteral(vector),
      categorySlugs.length > 0 ? categorySlugs : null,
      limit,
    );

    return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, similarity: 1 - r.distance }));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Подбор позиций: векторный поиск недоступен');
    return [];
  }
}

/** Ключевой поиск — работает всегда, даже без эмбеддингов и без OpenAI. */
async function findProblemsByKeywords(
  text: string,
  categorySlugs: string[],
  limit: number,
): Promise<{ id: string; slug: string; name: string; similarity: number }[]> {
  const problems = await prisma.priceProblem.findMany({
    where: {
      isActive: true,
      ...(categorySlugs.length > 0 ? { categorySlug: { in: categorySlugs } } : {}),
    },
    select: { id: true, slug: true, name: true, keywords: true },
  });

  return problems
    .map((p) => ({ id: p.id, slug: p.slug, name: p.name, similarity: scoreProblemMatch(p.keywords, text) }))
    .filter((p) => p.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Собрать список позиций прайса, из которых модель выбирает работы.
 *
 * Помимо позиций найденных проблем добавляются задачи каталога услуг той же
 * категории: без этого модель не смогла бы описать работу, для которой в
 * справочнике решений ещё нет отдельной проблемы.
 */
export async function findCandidateWorkItems(input: {
  text: string;
  categorySlugs?: string[];
  limit?: number;
}): Promise<WorkCandidate[]> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const categorySlugs = input.categorySlugs ?? [];
  const text = input.text.trim();

  if (!text) return [];

  let problems = await findProblemsByVector(text, categorySlugs, PROBLEM_TOP_K);
  if (problems.length === 0) {
    problems = await findProblemsByKeywords(text, categorySlugs, PROBLEM_TOP_K);
  }

  const candidates: WorkCandidate[] = [];
  const seen = new Set<string>();

  const push = (c: WorkCandidate) => {
    if (seen.has(c.code)) return;
    seen.add(c.code);
    candidates.push(c);
  };

  // ─── Позиции найденных проблем ───
  if (problems.length > 0) {
    const lines = await prisma.priceSolutionLine.findMany({
      where: {
        solution: { problemId: { in: problems.map((p) => p.id) } },
        item: { isActive: true, kind: 'LABOR' },
      },
      include: { item: true, solution: { include: { problem: true } } },
    });

    // Порядок кандидатов повторяет порядок проблем: самое релевантное сверху.
    const rank = new Map(problems.map((p, i) => [p.id, i]));
    lines.sort(
      (a, b) =>
        (rank.get(a.solution.problemId) ?? 99) - (rank.get(b.solution.problemId) ?? 99) ||
        a.sortOrder - b.sortOrder,
    );

    for (const line of lines) {
      push({
        code: line.item.code,
        name: line.item.name,
        unit: line.item.unit,
        categorySlug: line.item.categorySlug,
        problemName: line.solution.problem.name,
      });
      if (candidates.length >= limit) return candidates;
    }
  }

  // ─── Добор задачами каталога услуг ───
  if (categorySlugs.length > 0 && candidates.length < limit) {
    const tasks = await prisma.priceItem.findMany({
      where: {
        isActive: true,
        kind: 'LABOR',
        categorySlug: { in: categorySlugs },
        taskSlug: { not: null },
      },
      take: limit * 3,
      orderBy: { unitPrice: 'asc' },
    });

    const scored = tasks
      .map((t) => ({ item: t, score: scoreProblemMatch([t.name], text) }))
      .sort((a, b) => b.score - a.score);

    for (const { item } of scored) {
      push({
        code: item.code,
        name: item.name,
        unit: item.unit,
        categorySlug: item.categorySlug,
        problemName: null,
      });
      if (candidates.length >= limit) break;
    }
  }

  return candidates.slice(0, limit);
}

/**
 * Текстовый блок кандидатов для системного промпта.
 * Пустая строка, если кандидатов нет — тогда контракт остаётся прежним.
 */
export function buildCandidatesBlock(candidates: WorkCandidate[]): string {
  if (candidates.length === 0) return '';

  const byProblem = new Map<string, WorkCandidate[]>();
  for (const c of candidates) {
    const key = c.problemName ?? 'Отдельные услуги каталога';
    byProblem.set(key, [...(byProblem.get(key) ?? []), c]);
  }

  const blocks = Array.from(byProblem.entries()).map(([problem, items]) => {
    const lines = items.map((i) => `    • ${i.code} — ${i.name} (за ${i.unit})`).join('\n');
    return `  ${problem}:\n${lines}`;
  });

  return [
    'ДОСТУПНЫЕ РАБОТЫ (выбирай workCode ТОЛЬКО отсюда, коды копируй буквально):',
    blocks.join('\n'),
  ].join('\n');
}
