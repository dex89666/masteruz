// ============================================
// MasterUz — Прайс-реестр: перенос и подбор
// ============================================
// Проверяется то, что нельзя увидеть глазами в 600 позициях: коды стабильны
// и не конфликтуют, одинаковые строки схлопываются в одну запись, а подбор
// проблемы перестал зависеть от длины ключевого слова.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({ prisma: {} }));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  buildPriceBookSeed,
  findPriceConflicts,
  slugifyRu,
  parseEstimatedMinutes,
  DEFAULT_MODIFIERS,
} from '../../src/modules/instant-order/pricebook.mapping.js';
import { scoreProblemMatch } from '../../src/modules/instant-order/pricebook.service.js';

describe('slugifyRu', () => {
  it('делает читаемый латинский код из русского названия', () => {
    expect(slugifyRu('Замена смесителя')).toBe('zamena-smesitelya');
    expect(slugifyRu('Пайка ПП-трубы Ø20-25 мм')).toMatch(/^payka-pp-truby/);
  });

  it('никогда не возвращает пустую строку', () => {
    expect(slugifyRu('Ø±§')).toBe('item');
    expect(slugifyRu('')).toBe('item');
  });

  it('ограничивает длину и не оставляет висящий дефис', () => {
    const s = slugifyRu('Очень длинное название работы, которое точно не влезет в лимит кода', 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('parseEstimatedMinutes', () => {
  it('берёт середину диапазона', () => {
    expect(parseEstimatedMinutes('30-60 мин')).toBe(45);
    expect(parseEstimatedMinutes('1-3 часа')).toBe(120);
    expect(parseEstimatedMinutes('1 час')).toBe(60);
  });

  it('на непонятной строке возвращает час', () => {
    expect(parseEstimatedMinutes('когда-нибудь')).toBe(60);
    expect(parseEstimatedMinutes(undefined)).toBe(60);
  });
});

describe('перенос каталогов в реестр', () => {
  const seed = buildPriceBookSeed();

  it('коды позиций уникальны', () => {
    const codes = seed.items.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('повторяющаяся строка становится одной позицией реестра', () => {
    // «Диагностика и выезд мастера» встречается в десятках решений одной
    // категории. Если бы каждая копия стала отдельной записью, калибровщику
    // пришлось бы двигать полсотни одинаковых цен.
    const same = seed.items.filter(
      (i) => i.categorySlug === 'plumbing' && i.name === 'Диагностика и выезд мастера',
    );
    expect(same.length).toBe(1);
  });

  it('расхождения в исходных данных остаются видимыми, а не «чинятся» молча', () => {
    // Импорт переносит каталог как есть и НЕ придумывает цену за людей.
    // Но выезд мастера стоит от 30 000 до 80 000 под разными названиями —
    // это реальная ошибка данных, и отчёт обязан её показать.
    const conflicts = findPriceConflicts(seed);
    const visitFee = conflicts.find((c) => c.reason === 'VISIT_FEE');

    expect(visitFee).toBeDefined();
    expect(visitFee!.max).toBeGreaterThan(visitFee!.min);
    expect(visitFee!.items.length).toBeGreaterThan(1);
  });

  it('одноимённые работы с разной ценой попадают в отчёт', () => {
    const sameName = findPriceConflicts(seed).filter((c) => c.reason === 'SAME_NAME');
    expect(sameName.length).toBeGreaterThan(0);
    for (const conflict of sameName) {
      // В группе действительно одно название и действительно разные цены
      const names = new Set(conflict.items.map((i) => i.name.toLowerCase()));
      expect(names.size).toBe(1);
      expect(conflict.max).toBeGreaterThan(conflict.min);
    }
  });

  it('разная цена за разные работы конфликтом не считается', () => {
    // Покос газона за 500 сум и ремонт коттеджа за 80 млн — обе «услуга».
    // Группировка по единице измерения дала бы здесь ложную тревогу.
    const conflicts = findPriceConflicts(seed);
    const bogus = conflicts.find((c) => c.items.length > 100);
    expect(bogus).toBeUndefined();
  });

  it('переносит и работы, и материалы', () => {
    expect(seed.items.some((i) => i.kind === 'LABOR')).toBe(true);
    expect(seed.items.some((i) => i.kind === 'MATERIAL')).toBe(true);
  });

  it('у материалов нет трудозатрат', () => {
    for (const item of seed.items.filter((i) => i.kind === 'MATERIAL')) {
      expect(item.laborMinutes).toBe(0);
    }
  });

  it('задачи каталога услуг попадают в реестр со ссылкой на slug', () => {
    const linked = seed.items.filter((i) => i.taskSlug);
    expect(linked.length).toBeGreaterThan(300);
    for (const item of linked.slice(0, 20)) {
      expect(item.code).toBe(`task.${item.taskSlug}`);
    }
  });

  it('у каждой проблемы есть решения и хотя бы одна строка', () => {
    expect(seed.problems.length).toBeGreaterThan(20);
    for (const problem of seed.problems) {
      expect(problem.solutions.length).toBeGreaterThan(0);
      for (const solution of problem.solutions) {
        expect(solution.lines.length).toBeGreaterThan(0);
      }
    }
  });

  it('каждая строка решения ссылается на существующую позицию', () => {
    const codes = new Set(seed.items.map((i) => i.code));
    for (const problem of seed.problems) {
      for (const solution of problem.solutions) {
        for (const line of solution.lines) {
          expect(codes.has(line.itemCode)).toBe(true);
        }
      }
    }
  });

  it('уровни решения различаются классом комплектующих', () => {
    const withAllTiers = seed.problems.find((p) => p.solutions.length === 3);
    expect(withAllTiers).toBeDefined();
    const classes = withAllTiers!.solutions.map((s) => s.materialClass);
    expect(new Set(classes).size).toBe(3);
  });

  it('все цены положительные', () => {
    for (const item of seed.items) {
      expect(item.unitPrice).toBeGreaterThan(0);
    }
  });

  it('множители заведены и остаются в разумных пределах', () => {
    expect(DEFAULT_MODIFIERS.length).toBeGreaterThan(5);
    for (const m of DEFAULT_MODIFIERS) {
      expect(m.factor).toBeGreaterThanOrEqual(0.5);
      expect(m.factor).toBeLessThanOrEqual(2);
    }
  });

  it('срочность не начисляется прайс-реестром', () => {
    // Платформа уже берёт наценку за срочность по явному выбору клиента
    // (галочка «срочно» → Order.urgentMultiplier = 1.4). Ненулевой множитель
    // здесь применился бы поверх неё и по догадке модели: «авария» плюс
    // галочка дали бы 1.3 × 1.4 ≈ 1.82 без объяснения в чеке.
    for (const m of DEFAULT_MODIFIERS.filter((x) => x.type === 'URGENCY')) {
      expect(m.factor).toBe(1);
    }
  });
});

describe('подбор проблемы по описанию', () => {
  it('точное совпадение весит больше несовпадения', () => {
    const hit = scoreProblemMatch(['течёт', 'протечка'], 'у меня течёт труба под раковиной');
    const miss = scoreProblemMatch(['засор', 'прочистка'], 'у меня течёт труба под раковиной');
    expect(hit).toBeGreaterThan(miss);
  });

  it('длинная общая фраза не побеждает короткое точное совпадение', () => {
    // Прежний скоринг складывал длину строки ключевого слова, из-за чего
    // многословный ключ выигрывал у точного попадания одним словом.
    const precise = scoreProblemMatch(['засор'], 'засор в раковине');
    const verbose = scoreProblemMatch(
      ['замена повреждённого участка трубопровода с установкой запорной арматуры'],
      'засор в раковине',
    );
    expect(precise).toBeGreaterThan(verbose);
  });

  it('многословный ключ требует совпадения всех значимых слов', () => {
    const full = scoreProblemMatch(['вода на полу'], 'обнаружил воду на полу в ванной');
    const partial = scoreProblemMatch(['вода на полу'], 'нет воды в кране');
    expect(full).toBeGreaterThan(0);
    expect(partial).toBe(0);
  });

  it('пустое описание ничего не набирает', () => {
    expect(scoreProblemMatch(['течёт'], '')).toBe(0);
    expect(scoreProblemMatch(['течёт'], '   ')).toBe(0);
  });

  it('учитывает словоформы', () => {
    expect(scoreProblemMatch(['розетка'], 'не работают розетки в спальне')).toBeGreaterThan(0);
    expect(scoreProblemMatch(['протечка'], 'протечки по всей трубе')).toBeGreaterThan(0);
  });
});
