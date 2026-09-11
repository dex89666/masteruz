// ============================================
// MasterUz — Кандидаты позиций прайса для Vision
// ============================================
// Векторный поиск видит только проблемы с посчитанным эмбеддингом. Когда в
// каталог добавили «Сборку кухни», у соседних проблем векторы уже были, а у
// новой — нет. Подбор «вектор, а если пусто — слова» находил соседей и не
// находил её никогда: модель не получала в списке ни одной кухонной позиции.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const prisma: any = {
    $queryRawUnsafe: vi.fn(),
    priceProblem: { findMany: vi.fn() },
    priceSolutionLine: { findMany: vi.fn() },
    priceItem: { findMany: vi.fn() },
  };
  return { prisma };
});
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/embeddingService.js', () => ({
  getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
  toVectorLiteral: vi.fn(() => '[0.1,0.2]'),
}));

import { prisma } from '../../src/config/database.js';
import {
  findCandidateWorkItems,
  mergeProblemHits,
} from '../../src/modules/instant-order/pricebook.candidates.js';

const db = prisma as any;

const KITCHEN_CODE = 'furniture.w.sborka-kuhonnogo-modulya';

const hit = (id: string) => ({ id, slug: `furniture.${id}`, name: id, similarity: 1 });

/** Реестр мебели: у «Сборки кухни» вектора нет, у «Ремонта мебели» есть. */
function mockFurnitureBook() {
  db.priceProblem.findMany.mockResolvedValue([
    { id: 'kitchen', slug: 'furniture.sborka-kuhni', name: 'Сборка кухни (по модулям)', keywords: ['собрать', 'кухонный модуль'] },
    { id: 'repair', slug: 'furniture.remont', name: 'Ремонт мебели', keywords: ['петля', 'ящик'] },
  ]);
  db.priceSolutionLine.findMany.mockImplementation(async ({ where }: any) => {
    const ids: string[] = where.solution.problemId.in;
    const lines = [
      {
        sortOrder: 0,
        item: { code: KITCHEN_CODE, name: 'Сборка кухонного модуля', unit: 'модуль', categorySlug: 'furniture' },
        solution: { problemId: 'kitchen', problem: { name: 'Сборка кухни (по модулям)' } },
      },
      {
        sortOrder: 0,
        item: { code: 'furniture.w.zamena-petel', name: 'Замена петель', unit: 'шт.', categorySlug: 'furniture' },
        solution: { problemId: 'repair', problem: { name: 'Ремонт мебели' } },
      },
    ];
    return lines.filter((l) => ids.includes(l.solution.problemId));
  });
  db.priceItem.findMany.mockResolvedValue([]);
}

describe('объединение совпадений', () => {
  it('ключевые совпадения идут первыми, повторы убираются', () => {
    const merged = mergeProblemHits([hit('kitchen'), hit('small')], [hit('repair'), hit('kitchen')], 5);
    expect(merged.map((p) => p.id)).toEqual(['kitchen', 'small', 'repair']);
  });

  it('соблюдает лимит', () => {
    expect(mergeProblemHits([hit('a'), hit('b')], [hit('c'), hit('d')], 3)).toHaveLength(3);
  });
});

describe('кандидаты для Vision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFurnitureBook();
  });

  it('находит новую проблему без вектора, даже когда у соседей векторы есть', async () => {
    // Вектор вернул только «Ремонт мебели» — «Сборку кухни» он не видит.
    db.$queryRawUnsafe.mockResolvedValue([
      { id: 'repair', slug: 'furniture.remont', name: 'Ремонт мебели', distance: 0.3 },
    ]);

    const codes = (
      await findCandidateWorkItems({ text: 'собрать кухонный модуль', categorySlugs: ['furniture'] })
    ).map((c) => c.code);

    expect(codes).toContain(KITCHEN_CODE);
    // Точное совпадение по словам клиента — первым в списке для модели
    expect(codes[0]).toBe(KITCHEN_CODE);
  });

  it('работает, когда векторный поиск недоступен вовсе', async () => {
    db.$queryRawUnsafe.mockRejectedValue(new Error('vector недоступен'));

    const codes = (
      await findCandidateWorkItems({ text: 'собрать кухонный модуль', categorySlugs: ['furniture'] })
    ).map((c) => c.code);

    expect(codes).toContain(KITCHEN_CODE);
  });

  it('добавляет перефразировки, найденные вектором', async () => {
    // Слова клиента не совпали ни с одним ключом, но по смыслу это ремонт.
    db.$queryRawUnsafe.mockResolvedValue([
      { id: 'repair', slug: 'furniture.remont', name: 'Ремонт мебели', distance: 0.2 },
    ]);

    const codes = (
      await findCandidateWorkItems({ text: 'дверца отвисла и не закрывается', categorySlugs: ['furniture'] })
    ).map((c) => c.code);

    expect(codes).toContain('furniture.w.zamena-petel');
  });
});
