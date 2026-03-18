/**
 * Тест ценообразования по всем категориям pricing-catalog.ts
 * Запуск: npx tsx scripts/test-pricing.ts
 */

import { PRICING_CATALOG, findProblemByDescription, buildSmartVariants, calculateSolutionPrice } from '../src/modules/instant-order/pricing-catalog.js';

// ─── Тестовые описания для каждой категории ──
const TEST_CASES: { desc: string; expectedSlug: string; label: string }[] = [
  // Сантехника
  { desc: 'течёт кран на кухне', expectedSlug: 'plumbing', label: 'Сантехника: течь крана' },
  { desc: 'засорилась раковина, вода не уходит', expectedSlug: 'plumbing', label: 'Сантехника: засор' },
  { desc: 'нужно заменить смеситель в ванной', expectedSlug: 'plumbing', label: 'Сантехника: смеситель' },
  { desc: 'сломался унитаз, не сливает воду', expectedSlug: 'plumbing', label: 'Сантехника: унитаз' },
  { desc: 'установить бойлер 80 литров', expectedSlug: 'plumbing', label: 'Сантехника: бойлер' },
  { desc: 'нужно заменить трубу, протечка', expectedSlug: 'plumbing', label: 'Сантехника: протечка трубы' },
  { desc: 'течёт батарея отопления', expectedSlug: 'plumbing', label: 'Сантехника: батарея' },

  // Электрика
  { desc: 'нужно заменить 1 розетку', expectedSlug: 'electrical', label: 'Электрика: розетка' },
  { desc: 'заменить розетки в комнате', expectedSlug: 'electrical', label: 'Электрика: розетки (мн.ч.)' },
  { desc: 'не горит свет, повесить люстру', expectedSlug: 'electrical', label: 'Электрика: люстра' },
  { desc: 'выбивает автомат в щитке', expectedSlug: 'electrical', label: 'Электрика: автомат' },
  { desc: 'установить кондиционер в спальню', expectedSlug: 'electrical', label: 'Электрика: кондиционер' },
  { desc: 'нужно заменить выключатель', expectedSlug: 'electrical', label: 'Электрика: выключатель' },
  { desc: 'проводка искрит, короткое замыкание', expectedSlug: 'electrical', label: 'Электрика: проводка' },

  // Мебель
  { desc: 'собрать шкаф купе', expectedSlug: 'furniture', label: 'Мебель: шкаф' },
  { desc: 'сломалась петля на шкафу, дверца провисла', expectedSlug: 'furniture', label: 'Мебель: ремонт петли' },
  { desc: 'собрать комод из IKEA', expectedSlug: 'furniture', label: 'Мебель: сборка IKEA' },
  { desc: 'нужно починить ящик в комоде, направляющие сломались', expectedSlug: 'furniture', label: 'Мебель: направляющие' },

  // Строительство
  { desc: 'трещина на стене, нужно заделать', expectedSlug: 'construction', label: 'Строительство: стена' },
  { desc: 'нужно положить ламинат в комнате', expectedSlug: 'construction', label: 'Строительство: ламинат' },
  { desc: 'трещина на потолке', expectedSlug: 'construction', label: 'Строительство: потолок' },
  { desc: 'нужна стяжка пола в комнате', expectedSlug: 'construction', label: 'Строительство: стяжка' },
  { desc: 'выровнять стены штукатуркой', expectedSlug: 'construction', label: 'Строительство: штукатурка' },

  // Малярные работы
  { desc: 'покрасить стены в комнате', expectedSlug: 'painting', label: 'Малярка: покраска' },
  { desc: 'поклеить обои в спальне', expectedSlug: 'painting', label: 'Малярка: обои' },
  { desc: 'отвалилась плитка в ванной', expectedSlug: 'painting', label: 'Малярка: плитка' },
  { desc: 'нужно переклеить обои, отходят от стены', expectedSlug: 'painting', label: 'Малярка: обои отклеились' },

  // Окна и двери
  { desc: 'продувает из пластикового окна', expectedSlug: 'windows-doors', label: 'Окна: продувает' },
  { desc: 'установить межкомнатную дверь', expectedSlug: 'windows-doors', label: 'Двери: установка' },
  { desc: 'сломался замок на двери', expectedSlug: 'windows-doors', label: 'Двери: замок' },
  { desc: 'разбился стеклопакет', expectedSlug: 'windows-doors', label: 'Окна: стеклопакет' },

  // Бытовая техника
  { desc: 'подключить стиральную машину', expectedSlug: 'appliance-install', label: 'Техника: стиральная' },
  { desc: 'установить встраиваемую посудомоечную', expectedSlug: 'appliance-install', label: 'Техника: посудомоечная' },

  // Плотник
  { desc: 'починить деревянный забор', expectedSlug: 'carpentry', label: 'Плотник: забор' },
  { desc: 'построить навес из дерева', expectedSlug: 'carpentry', label: 'Плотник: навес' },

  // Клининг
  { desc: 'генеральная уборка квартиры', expectedSlug: 'cleaning', label: 'Клининг: уборка' },
  { desc: 'уборка после ремонта, строительная пыль', expectedSlug: 'cleaning', label: 'Клининг: после ремонта' },

  // Сад
  { desc: 'постричь газон и обрезать деревья', expectedSlug: 'garden-outdoor', label: 'Сад: газон' },
];

// ─── Запуск тестов ──
console.log('═══════════════════════════════════════════════════════════');
console.log('  ТЕСТ ЦЕНООБРАЗОВАНИЯ — pricing-catalog.ts');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;
const issues: string[] = [];

for (const tc of TEST_CASES) {
  const result = buildSmartVariants(tc.expectedSlug, '', tc.desc);

  if (!result) {
    console.log(`❌ ${tc.label}: "${tc.desc}"`);
    console.log(`   Проблема НЕ НАЙДЕНА в каталоге (slug: ${tc.expectedSlug})`);
    issues.push(`${tc.label}: проблема не найдена для "${tc.desc}" в ${tc.expectedSlug}`);
    failed++;
    continue;
  }

  // Проверяем цены
  const good = result.variants.find(v => v.tier === 'GOOD');
  const better = result.variants.find(v => v.tier === 'BETTER');
  const best = result.variants.find(v => v.tier === 'BEST');

  if (!good || !better || !best) {
    console.log(`❌ ${tc.label}: неполные варианты (GOOD/BETTER/BEST)`);
    issues.push(`${tc.label}: неполные варианты`);
    failed++;
    continue;
  }

  // Проверки логики
  const errs: string[] = [];

  if (good.estimatedPrice <= 0) errs.push('GOOD цена ≤ 0');
  if (better.estimatedPrice <= 0) errs.push('BETTER цена ≤ 0');
  if (best.estimatedPrice <= 0) errs.push('BEST цена ≤ 0');

  if (good.estimatedPrice > better.estimatedPrice) errs.push(`GOOD (${good.estimatedPrice}) > BETTER (${better.estimatedPrice})`);
  if (better.estimatedPrice > best.estimatedPrice) errs.push(`BETTER (${better.estimatedPrice}) > BEST (${best.estimatedPrice})`);

  // Цена не должна быть слишком маленькой или слишком большой
  if (good.estimatedPrice < 30_000) errs.push(`GOOD слишком дешёвый: ${good.estimatedPrice}`);
  if (best.estimatedPrice > 5_000_000) errs.push(`BEST слишком дорогой: ${best.estimatedPrice}`);

  // BEST не должен быть > 50x от GOOD (большой разброс допустим: мелкий ремонт vs полная комната)
  if (best.estimatedPrice > good.estimatedPrice * 50) errs.push(`BEST (${best.estimatedPrice}) > 50x GOOD (${good.estimatedPrice})`);

  const fmtP = (n: number) => n.toLocaleString('ru');

  if (errs.length > 0) {
    console.log(`⚠️  ${tc.label}: "${tc.desc}" → ${result.problemName}`);
    console.log(`   GOOD: ${fmtP(good.estimatedPrice)}  BETTER: ${fmtP(better.estimatedPrice)}  BEST: ${fmtP(best.estimatedPrice)}`);
    for (const e of errs) console.log(`   ⛔ ${e}`);
    issues.push(`${tc.label}: ${errs.join('; ')}`);
    failed++;
  } else {
    console.log(`✅ ${tc.label}: ${result.problemName}`);
    console.log(`   GOOD: ${fmtP(good.estimatedPrice)}  BETTER: ${fmtP(better.estimatedPrice)}  BEST: ${fmtP(best.estimatedPrice)}`);
    passed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  ИТОГО: ✅ ${passed} пройдено, ❌ ${failed} проблем`);
if (issues.length > 0) {
  console.log('\n  🔴 ПРОБЛЕМЫ:');
  for (const i of issues) console.log(`    - ${i}`);
}
console.log('═══════════════════════════════════════════════════════════');
