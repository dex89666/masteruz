// ============================================
// MasterUz — Catalog Data Hook (prefetch + cache)
// Загрузка полного каталога 1 раз, навигация без HTTP
// ============================================

import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../api/client';

interface CatalogTask {
  id: string;
  slug: string;
  name: string;
  nameUz?: string | null;
  nameEn?: string | null;
  description?: string | null;
  descriptionUz?: string | null;
  descriptionEn?: string | null;
  estimatedTime?: string | null;
  estimatedTimeUz?: string | null;
  estimatedTimeEn?: string | null;
  minPrice?: number | null;
  isActive?: boolean;
}

interface CatalogSubcategory {
  id: string;
  slug: string;
  name: string;
  nameUz?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  tasks?: CatalogTask[];
  _count?: { tasks: number };
}

interface CatalogCategory {
  id: string;
  slug: string;
  name: string;
  nameUz?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  parentId?: string | null;
  children?: CatalogCategory[];
  subcategories?: CatalogSubcategory[];
  _count?: { subcategories: number };
}

const CATALOG_QUERY_KEY = ['catalog', 'full'];

/** Загрузить плоский каталог и собрать иерархию parent→children→subcategories→tasks */
export function useCatalogFull() {
  return useQuery<CatalogCategory[]>({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: async () => {
      const res = await catalogApi.getFullCatalog();
      const flat: CatalogCategory[] = res.data.data || [];
      // Собираем дерево: parents (parentId=null) → children (parentId!=null)
      const parents = flat.filter((c) => !c.parentId);
      const childMap = new Map<string, CatalogCategory[]>();
      for (const c of flat) {
        if (c.parentId) {
          const arr = childMap.get(c.parentId) || [];
          arr.push(c);
          childMap.set(c.parentId, arr);
        }
      }
      for (const p of parents) {
        p.children = childMap.get(p.id) || [];
      }
      return parents;
    },
    staleTime: 5 * 60 * 1000, // 5 минут — не рефетчим
    gcTime: 30 * 60 * 1000,   // 30 минут в кеше
    refetchOnWindowFocus: false,
  });
}

/** Найти родительскую категорию по slug */
export function useParentCategory(slug: string | undefined) {
  const { data: catalog, isLoading } = useCatalogFull();

  const category = slug && catalog
    ? catalog.find((c) => c.slug === slug && !c.parentId)
    : null;

  return { category, isLoading, catalog };
}

/** Найти дочернюю категорию по slug (с subcategories и tasks) */
export function useChildCategory(slug: string | undefined) {
  const { data: catalog, isLoading } = useCatalogFull();

  let category: CatalogCategory | null = null;
  if (slug && catalog) {
    for (const parent of catalog) {
      if (parent.slug === slug && parent.subcategories?.length) {
        category = parent;
        break;
      }
      const child = parent.children?.find((c) => c.slug === slug);
      if (child) {
        category = child;
        break;
      }
    }
  }

  return { category, isLoading, catalog };
}

/** Найти подкатегорию по slug внутри категории */
export function useSubcategory(categorySlug: string | undefined, subcategorySlug: string | undefined) {
  const { category, isLoading, catalog } = useChildCategory(categorySlug);

  const subcategory = subcategorySlug && category?.subcategories
    ? category.subcategories.find((s) => s.slug === subcategorySlug)
    : null;

  return {
    subcategory,
    tasks: subcategory?.tasks || [],
    categoryMeta: category ? {
      name: category.name,
      nameUz: category.nameUz,
      nameEn: category.nameEn,
      icon: category.icon,
    } : null,
    isLoading,
    catalog,
  };
}

/** Поиск по каталогу — ищет по названиям задач, подкатегорий, категорий */
export function useCatalogSearch(query: string) {
  const { data: catalog, isLoading } = useCatalogFull();

  if (!query || query.length < 2 || !catalog) {
    return { results: [], isLoading };
  }

  const q = query.toLowerCase().trim();
  const results: {
    type: 'task' | 'subcategory' | 'category';
    name: string;
    nameUz?: string | null;
    nameEn?: string | null;
    slug: string;
    parentSlug?: string;
    categorySlug?: string;
    icon?: string | null;
    minPrice?: number | null;
    description?: string | null;
  }[] = [];

  const seen = new Set<string>();

  for (const parent of catalog) {
    // Поиск по родительским
    if (matchName(parent, q) && !seen.has(parent.slug)) {
      seen.add(parent.slug);
      results.push({ type: 'category', name: parent.name, nameUz: parent.nameUz, nameEn: parent.nameEn, slug: parent.slug, icon: parent.icon });
    }

    for (const child of parent.children || []) {
      // Поиск по дочерним категориям
      if (matchName(child, q) && !seen.has(child.slug)) {
        seen.add(child.slug);
        results.push({ type: 'category', name: child.name, nameUz: child.nameUz, nameEn: child.nameEn, slug: child.slug, parentSlug: parent.slug, icon: child.icon });
      }

      for (const sub of child.subcategories || []) {
        // Поиск по подкатегориям
        if (matchName(sub, q) && !seen.has(sub.slug)) {
          seen.add(sub.slug);
          results.push({ type: 'subcategory', name: sub.name, nameUz: sub.nameUz, nameEn: sub.nameEn, slug: sub.slug, categorySlug: child.slug, icon: sub.icon });
        }

        for (const task of sub.tasks || []) {
          // Поиск по задачам
          if (matchTask(task, q) && !seen.has(task.slug)) {
            seen.add(task.slug);
            results.push({
              type: 'task',
              name: task.name,
              nameUz: task.nameUz,
              nameEn: task.nameEn,
              slug: sub.slug,
              categorySlug: child.slug,
              icon: sub.icon,
              minPrice: task.minPrice,
              description: task.description,
            });
          }
        }
      }
    }
  }

  return { results: results.slice(0, 20), isLoading };
}

/** Проверяет, содержатся ли все слова запроса в тексте (с учётом русских корней) */
function matchesAllWords(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.every((w) => {
    // Прямое совпадение
    if (lower.includes(w)) return true;
    // Совпадение по корню (первые 3 символа — кух→кухонн, сбор→сборка)
    if (w.length >= 3) {
      const stem = w.slice(0, 3);
      return lower.includes(stem);
    }
    return false;
  });
}

function matchName(item: { name: string; nameUz?: string | null; nameEn?: string | null }, q: string): boolean {
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return item.name.toLowerCase().includes(q)
      || (item.nameUz?.toLowerCase().includes(q) ?? false)
      || (item.nameEn?.toLowerCase().includes(q) ?? false);
  }
  // Многословный запрос — все слова должны быть в тексте
  return matchesAllWords(item.name, words)
    || matchesAllWords(item.nameUz || '', words)
    || matchesAllWords(item.nameEn || '', words);
}

function matchTask(task: CatalogTask, q: string): boolean {
  if (matchName(task, q)) return true;
  const words = q.split(/\s+/).filter(Boolean);
  // Для задач проверяем также описание
  const allText = [task.name, task.description, task.nameUz, task.descriptionUz, task.nameEn, task.descriptionEn]
    .filter(Boolean).join(' ');
  return matchesAllWords(allText, words);
}

export type { CatalogCategory, CatalogSubcategory, CatalogTask };
