// ============================================
// MasterUz — Конвейер Vision
// ============================================
//
// Один код анализа фотографии для продакшена и для замера точности.
//
// Раньше eval звал analyzeOrder напрямую, без списка позиций прайса, и потому
// мог измерить только старый контракт: новый режим он не видел вовсе, а цену
// брал из priceHint, которого там нет. Гейт, не умеющий проверить то, что
// собирается выпустить, бесполезен — поэтому логика вынесена сюда, и оба
// потребителя используют её без копий.
// ============================================

import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { analyzeOrder, type AiAnalysisResult } from '../../services/aiAnalysisService.js';
import { findCandidateWorkItems } from './pricebook.candidates.js';
import { buildVariantsFromJobs, buildVariantsFromPriceBook } from './pricebook.service.js';
import type { EstimateVariant } from './pricing-catalog.js';

export interface VisionPipelineInput {
  images: string[];
  text: string;
  availableCategories: { slug: string; name: string }[];
}

/**
 * Текст, описывающий то, ЧТО УВИДЕЛ Vision: резюме, объекты на фото, материалы.
 * Нужен там, где слов клиента нет совсем.
 */
export function buildAiContext(ai: AiAnalysisResult | null): string {
  if (!ai) return '';
  return [ai.summary, ...(ai.visualTags || []), ...(ai.materials || [])]
    .filter(Boolean)
    .join('. ')
    .trim();
}

/**
 * Анализ фото через Vision — в один или два прохода.
 *
 * Контракт «спецификация» требует списка позиций прайса, из которых модель
 * выбирает работы. Список подбирается по тексту — и здесь возникает развилка:
 *
 *   • клиент что-то написал → кандидатов находим сразу, хватает одного прохода;
 *   • клиент прислал только фото → сначала спрашиваем модель, ЧТО она видит,
 *     затем по её описанию подбираем кандидатов и спрашиваем второй раз,
 *     КАКИЕ работы это закрывают.
 *
 * Второй проход стоит ещё одного запроса к Vision, но без него заказ по одной
 * фотографии не с чем сопоставлять: у нас нет ни слова текста.
 */
export async function runVisionAnalysis(input: VisionPipelineInput): Promise<AiAnalysisResult> {
  const { images, text, availableCategories } = input;
  const hasText = text.trim().length > 0;

  // Спецификация работает только поверх заполненного реестра.
  if (!config.pricebook.enabled) {
    return analyzeOrder({ photoUrls: images, text, availableCategories });
  }

  if (hasText) {
    const candidates = await findCandidateWorkItems({ text }).catch(() => []);
    return analyzeOrder({ photoUrls: images, text, availableCategories, workCandidates: candidates });
  }

  // ─── Проход 1: что на фотографии ───
  const firstPass = await analyzeOrder({ photoUrls: images, text: '', availableCategories });
  const context = buildAiContext(firstPass);
  const topSlug = firstPass.categories[0]?.slug;
  if (!context || !topSlug) return firstPass;

  const candidates = await findCandidateWorkItems({ text: context, categorySlugs: [topSlug] }).catch(() => []);
  if (candidates.length === 0) return firstPass;

  // ─── Проход 2: какие работы это закрывают ───
  try {
    const secondPass = await analyzeOrder({
      photoUrls: images,
      // Во второй проход отдаём то, что модель сама увидела в первом:
      // так она сопоставляет работы со своим же описанием объекта.
      text: context,
      availableCategories,
      workCandidates: candidates,
    });

    // Расхождение проходов в категории — честный сигнал неуверенности,
    // а не повод молча выбрать один из ответов.
    const agreed = secondPass.categories[0]?.slug === topSlug;
    logger.info(
      { firstPass: topSlug, secondPass: secondPass.categories[0]?.slug, agreed, jobs: secondPass.jobs.length },
      'Vision: второй проход завершён',
    );

    if (!agreed && secondPass.categories[0]) {
      secondPass.categories[0].confidence = Math.round(secondPass.categories[0].confidence * 0.8);
    }
    return secondPass;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Vision: второй проход не удался — берём результат первого');
    return firstPass;
  }
}

/**
 * Цена, которую увидит клиент по результату анализа.
 *
 * Выделена отдельно, чтобы замер точности сравнивал с фактом ровно ту сумму,
 * которую называет продакшен, а не диапазон, придуманный моделью.
 * Возвращает null, если смету собрать не удалось — это тоже результат.
 */
export async function estimateFromAnalysis(
  analysis: AiAnalysisResult,
  options: { description?: string; urgency?: AiAnalysisResult['urgency'] } = {},
): Promise<{ variants: EstimateVariant[]; source: 'JOBS' | 'PRICEBOOK' | 'PRICE_HINT' } | null> {
  const top = analysis.categories[0];

  if (config.pricebook.enabled && top) {
    if (analysis.jobs.length > 0) {
      const fromJobs = await buildVariantsFromJobs(analysis.jobs, {
        categorySlug: top.slug,
        description: options.description,
        urgency: options.urgency ?? analysis.urgency,
      }).catch(() => null);
      if (fromJobs) return { variants: fromJobs.variants, source: 'JOBS' };
    }

    const fromBook = await buildVariantsFromPriceBook({
      categorySlug: top.slug,
      description: options.description ?? '',
      urgency: options.urgency ?? analysis.urgency,
      aiContext: buildAiContext(analysis),
    }).catch(() => null);
    if (fromBook) return { variants: fromBook.variants, source: 'PRICEBOOK' };
  }

  return null;
}
