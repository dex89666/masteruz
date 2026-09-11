// ============================================
// MasterUz — Перенос каталогов в прайс-реестр
// ============================================
//
// Чистое преобразование: два сегодняшних источника цен превращаются в плоский
// набор записей реестра. Ни одного обращения к БД — благодаря этому маппинг
// проверяется тестами, а скрипт импорта остаётся тонкой обёрткой над ним.
//
// Источники:
//   PRICING_CATALOG (pricing-catalog.ts) — проблемы, решения и позиции с ценами
//   SERVICE_CATALOG (services-catalog.ts) — задачи каталога услуг с minPrice
//
// Оба сливаются в один реестр: позиции решений и задачи каталога живут в
// одной таблице price_items, поэтому цена перестаёт зависеть от того, каким
// путём пошёл расчёт.
// ============================================

import { PRICING_CATALOG } from './pricing-catalog.js';
import { SERVICE_CATALOG } from '../../data/services-catalog.js';

export type SeedItemKind = 'LABOR' | 'MATERIAL';
export type SeedTier = 'GOOD' | 'BETTER' | 'BEST';
export type SeedMaterialClass = 'STANDARD' | 'ENHANCED' | 'PREMIUM';
export type SeedModifierType = 'REGION' | 'URGENCY' | 'FLOOR' | 'ACCESS' | 'SEASON';

export interface SeedItem {
  code: string;
  name: string;
  nameUz?: string;
  nameEn?: string;
  unit: string;
  kind: SeedItemKind;
  unitPrice: number;
  minCheck: number;
  laborMinutes: number;
  categorySlug: string;
  taskSlug?: string;
}

export interface SeedLine {
  itemCode: string;
  qty: number;
  sortOrder: number;
}

export interface SeedSolution {
  tier: SeedTier;
  title: string;
  description: string;
  days: number;
  materialClass: SeedMaterialClass;
  lines: SeedLine[];
}

export interface SeedProblem {
  slug: string;
  categorySlug: string;
  name: string;
  keywords: string[];
  sortOrder: number;
  solutions: SeedSolution[];
}

export interface SeedModifier {
  type: SeedModifierType;
  key: string;
  label: string;
  factor: number;
}

export interface PriceBookSeed {
  items: SeedItem[];
  problems: SeedProblem[];
  modifiers: SeedModifier[];
}

// ─── Транслитерация для читаемых кодов ───────────────────────────────────
// Код позиции виден админу в панели и попадает в логи калибровки, поэтому
// «plumbing.w.zamena-smesitelya» полезнее, чем «plumbing.w.a41f».

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugifyRu(input: string, maxLen = 48): string {
  const out = input
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out.slice(0, maxLen).replace(/-+$/g, '') || 'item';
}

/** Минуты на единицу работы по единице измерения — грубая, но честная оценка. */
function laborMinutesFor(unit: string, kind: SeedItemKind): number {
  if (kind === 'MATERIAL') return 0;
  const u = unit.toLowerCase();
  if (u.includes('выезд')) return 30;
  if (u.includes('м²') || u.includes('м2')) return 40;
  if (u.includes('м.п')) return 25;
  if (u.includes('точк') || u.includes('пайк')) return 45;
  return 60;
}

/** Класс комплектующих по уровню решения: объём работ одинаков, материал разный. */
const MATERIAL_CLASS_BY_TIER: Record<SeedTier, SeedMaterialClass> = {
  GOOD: 'STANDARD',
  BETTER: 'ENHANCED',
  BEST: 'PREMIUM',
};

/**
 * Реестр позиций с дедупликацией.
 *
 * Одна и та же строка («Диагностика и выезд мастера», 50 000) встречается
 * в десятках решений. В реестре она должна быть одной записью — иначе
 * калибровщик будет двигать полсотни копий одной и той же цены.
 *
 * Если имя совпало, а цена или единица отличаются — это разные позиции,
 * им выдаётся код с числовым суффиксом.
 */
class ItemRegistry {
  private readonly byCode = new Map<string, SeedItem>();

  add(draft: Omit<SeedItem, 'code'> & { codeBase: string }): string {
    const { codeBase, ...rest } = draft;
    let code = codeBase;
    let suffix = 1;

    while (this.byCode.has(code)) {
      const existing = this.byCode.get(code)!;
      const same =
        existing.unitPrice === rest.unitPrice &&
        existing.unit === rest.unit &&
        existing.kind === rest.kind;
      if (same) return code;
      suffix += 1;
      code = `${codeBase}-${suffix}`;
    }

    this.byCode.set(code, { code, ...rest });
    return code;
  }

  list(): SeedItem[] {
    return Array.from(this.byCode.values());
  }
}

/**
 * Собрать полный слепок прайс-реестра из обоих каталогов.
 */
export function buildPriceBookSeed(): PriceBookSeed {
  const registry = new ItemRegistry();
  const problems: SeedProblem[] = [];

  // ─── 1. Справочник решений: проблемы, решения, позиции ──────────────
  for (const category of PRICING_CATALOG) {
    category.problems.forEach((problem, problemIndex) => {
      const problemSlug = `${category.slug}.${slugifyRu(problem.problemName, 40)}`;

      const solutions: SeedSolution[] = problem.solutions.map((solution) => {
        const lines: SeedLine[] = [];
        let sortOrder = 0;

        for (const work of solution.works) {
          const itemCode = registry.add({
            codeBase: `${category.slug}.w.${slugifyRu(work.name)}`,
            name: work.name,
            unit: work.unit,
            kind: 'LABOR',
            unitPrice: work.unitPrice,
            // Минимальный чек хранится на позиции: ниже него мастер не поедет.
            // Пока он равен нулю — общий пол сметы задаётся калькулятором.
            minCheck: 0,
            laborMinutes: laborMinutesFor(work.unit, 'LABOR'),
            categorySlug: category.slug,
          });
          lines.push({ itemCode, qty: work.qty, sortOrder: sortOrder++ });
        }

        for (const material of solution.materials) {
          const itemCode = registry.add({
            codeBase: `${category.slug}.m.${slugifyRu(material.name)}`,
            name: material.name,
            unit: material.unit,
            kind: 'MATERIAL',
            unitPrice: material.unitPrice,
            minCheck: 0,
            laborMinutes: 0,
            categorySlug: category.slug,
          });
          lines.push({ itemCode, qty: material.qty, sortOrder: sortOrder++ });
        }

        return {
          tier: solution.tier,
          title: solution.title,
          description: solution.description,
          days: solution.days,
          materialClass: MATERIAL_CLASS_BY_TIER[solution.tier],
          lines,
        };
      });

      problems.push({
        slug: problemSlug,
        categorySlug: category.slug,
        name: problem.problemName,
        keywords: problem.keywords,
        sortOrder: problemIndex,
        solutions,
      });
    });
  }

  // ─── 2. Каталог услуг: задачи как позиции реестра ───────────────────
  // Нужны для резервного пути расчёта и как якоря калибровки: у задачи есть
  // slug, а значит закрытые заказы можно разложить именно по ним.
  for (const category of SERVICE_CATALOG) {
    for (const subcategory of category.subcategories) {
      for (const task of subcategory.tasks) {
        registry.add({
          codeBase: `task.${task.slug}`,
          name: task.name,
          nameUz: task.nameUz,
          nameEn: task.nameEn,
          unit: 'услуга',
          kind: 'LABOR',
          unitPrice: task.minPrice,
          minCheck: 0,
          laborMinutes: parseEstimatedMinutes(task.estimatedTime),
          categorySlug: category.slug,
          taskSlug: task.slug,
        });
      }
    }
  }

  return { items: registry.list(), problems, modifiers: DEFAULT_MODIFIERS };
}

/** «30-60 мин», «1-3 часа» → среднее в минутах. */
export function parseEstimatedMinutes(estimatedTime?: string): number {
  if (!estimatedTime) return 60;
  const time = estimatedTime.toLowerCase();
  const hours = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*час/);
  if (hours) {
    const avg = hours[2] ? (parseInt(hours[1], 10) + parseInt(hours[2], 10)) / 2 : parseInt(hours[1], 10);
    return Math.round(avg * 60);
  }
  const minutes = time.match(/(\d+)(?:\s*-\s*(\d+))?\s*мин/);
  if (minutes) {
    const avg = minutes[2]
      ? (parseInt(minutes[1], 10) + parseInt(minutes[2], 10)) / 2
      : parseInt(minutes[1], 10);
    return Math.round(avg);
  }
  return 60;
}

// ─── Множители ───────────────────────────────────────────────────────────
// Все заводятся нейтральными (1.000) — это рычаги для админа, а не готовые
// коэффициенты: их настраивают по факту рынка.
//
// ВНИМАНИЕ ПРО СРОЧНОСТЬ. Платформа уже берёт наценку за срочность отдельно:
// клиент сам ставит галочку «срочно», заказ хранит urgentMultiplier, и сумма
// видна в интерфейсе до оплаты. Множитель ниже применился бы ПОВЕРХ неё и по
// догадке модели, а не по выбору клиента: «авария» по мнению AI плюс галочка
// клиента давали бы 1.3 × 1.4 ≈ 1.82 без единого объяснения в чеке.
// Поэтому здесь они нейтральны. Менять — только вместе с решением, где именно
// срочность берётся, чтобы она не начислялась дважды.

export const DEFAULT_MODIFIERS: SeedModifier[] = [
  { type: 'URGENCY', key: 'emergency', label: 'Авария — немедленный выезд', factor: 1.0 },
  { type: 'URGENCY', key: 'urgent', label: 'Срочно — сегодня-завтра', factor: 1.0 },
  { type: 'URGENCY', key: 'normal', label: 'В обычные сроки', factor: 1.0 },
  { type: 'URGENCY', key: 'flexible', label: 'Не срочно', factor: 1.0 },

  { type: 'REGION', key: 'tashkent-center', label: 'Ташкент — центр', factor: 1.0 },
  { type: 'REGION', key: 'tashkent-outskirts', label: 'Ташкент — окраина', factor: 1.0 },
  { type: 'REGION', key: 'region', label: 'Область', factor: 1.0 },

  { type: 'FLOOR', key: 'no-lift-above-3', label: 'Выше 3 этажа без лифта', factor: 1.0 },
  { type: 'ACCESS', key: 'tight', label: 'Стеснённый доступ к месту работ', factor: 1.0 },
  { type: 'SEASON', key: 'peak', label: 'Сезон пикового спроса', factor: 1.0 },
];

/**
 * Проверка множителя перед сохранением. Возвращает текст ошибки или null.
 *
 * Срочность в реестре должна оставаться нейтральной: платформа уже берёт её
 * отдельно по выбору клиента — галочка «срочно» → Order.urgentMultiplier, —
 * и множитель здесь лёг бы поверх неё, по догадке модели и без объяснения.
 */
export function modifierFactorViolation(type: string, factor: number): string | null {
  if (type === 'URGENCY' && factor !== 1) {
    return (
      'Срочность уже начисляется отдельно по выбору клиента («срочно» в заказе). ' +
      'Множитель срочности в прайс-реестре привёл бы к двойной наценке.'
    );
  }
  return null;
}

// ─── Контроль качества переноса ──────────────────────────────────────────

export interface PriceConflict {
  /** Что именно расходится: «выезд мастера» или конкретное название работы. */
  subject: string;
  reason: 'VISIT_FEE' | 'SAME_NAME';
  min: number;
  max: number;
  items: { code: string; name: string; price: number; categorySlug: string }[];
}

/**
 * Найти расхождения, которые стоит разобрать глазами после переноса.
 *
 * Импорт намеренно не «чинит» такие места: цена — решение владельца сервиса,
 * а не скрипта. Но невидимыми они быть не должны.
 *
 * Проверяются только те случаи, где расхождение действительно означает ошибку:
 *   VISIT_FEE — выезд мастера, платформенная величина, а в каталогах она
 *               стоит от 30 000 до 80 000 под четырьмя разными названиями;
 *   SAME_NAME — одна и та же работа с одинаковым названием, но разной ценой.
 *
 * Сравнивать цены просто по единице измерения бессмысленно: в «услуге»
 * лежит и покос газона за 500 сум, и ремонт коттеджа за 80 млн.
 */
export function findPriceConflicts(seed: PriceBookSeed): PriceConflict[] {
  const conflicts: PriceConflict[] = [];
  const toItem = (i: SeedItem) => ({
    code: i.code,
    name: i.name,
    price: i.unitPrice,
    categorySlug: i.categorySlug,
  });

  // ─── Выезд мастера ───
  const visits = seed.items.filter((i) => i.unit.toLowerCase().includes('выезд'));
  if (visits.length > 1) {
    const prices = visits.map((i) => i.unitPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (max > min) {
      conflicts.push({
        subject: 'Выезд мастера',
        reason: 'VISIT_FEE',
        min,
        max,
        items: visits.map(toItem).sort((a, b) => a.price - b.price),
      });
    }
  }

  // ─── Одинаковое название, разная цена ───
  const byName = new Map<string, SeedItem[]>();
  for (const item of seed.items) {
    const key = `${item.kind}:${item.name.trim().toLowerCase()}`;
    const bucket = byName.get(key) ?? [];
    bucket.push(item);
    byName.set(key, bucket);
  }

  for (const bucket of byName.values()) {
    if (bucket.length < 2) continue;
    const prices = bucket.map((i) => i.unitPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (max === min) continue;
    conflicts.push({
      subject: bucket[0].name,
      reason: 'SAME_NAME',
      min,
      max,
      items: bucket.map(toItem).sort((a, b) => a.price - b.price),
    });
  }

  return conflicts.sort((a, b) => b.max / b.min - a.max / a.min);
}
