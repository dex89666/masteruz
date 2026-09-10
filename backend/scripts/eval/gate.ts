// ============================================
// MasterUz — Гейт качества AI-анализа
// ============================================
//
// Читает результат прогона (run-eval.ts --json) и падает, если качество
// ниже порогов. Смысл простой: промпт и модель меняются часто, а заметить
// ухудшение по глазам невозможно — на восьми кейсах любое изменение
// выглядит как случайность.
//
// Запуск:
//   npx tsx scripts/eval/run-eval.ts scripts/eval/dataset.json --json /tmp/eval.json
//   npx tsx scripts/eval/gate.ts /tmp/eval.json
//   npx tsx scripts/eval/gate.ts /tmp/eval.json --baseline baseline.json
//
// Пороги переопределяются через env — их поднимают по мере роста набора:
//   EVAL_MIN_CASES, EVAL_MIN_CATEGORY_ACC, EVAL_MIN_WITHIN20,
//   EVAL_MAX_GROSS_MISS, EVAL_MIN_REFUSAL_ACC, EVAL_MAX_REGRESSION_PP

import fs from 'node:fs';
import path from 'node:path';

interface EvalRow {
  model: string;
  cases: number;
  failed: number;
  categoryAcc: number | null;
  within20: number | null;
  grossMiss: number | null;
  refusalAcc: number | null;
  refusalN: number;
}

interface EvalFile {
  dataset: string;
  ranAt: string;
  rows: EvalRow[];
}

const num = (name: string, fallback: number) => {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Пороги намеренно умеренные: на маленьком наборе строгий гейт блокирует
// работу шумом, а не ловит регрессии. Поднимайте их вместе с набором.
const THRESHOLDS = {
  minCases: num('EVAL_MIN_CASES', 8),
  minCategoryAcc: num('EVAL_MIN_CATEGORY_ACC', 75),
  minWithin20: num('EVAL_MIN_WITHIN20', 40),
  maxGrossMiss: num('EVAL_MAX_GROSS_MISS', 35),
  minRefusalAcc: num('EVAL_MIN_REFUSAL_ACC', 50),
  // Насколько метрика может просесть относительно базового прогона,
  // в процентных пунктах.
  maxRegressionPp: num('EVAL_MAX_REGRESSION_PP', 5),
};

function read(file: string): EvalFile {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`Файл результата не найден: ${abs}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}

function main() {
  const args = process.argv.slice(2);
  const resultPath = args.find((a) => !a.startsWith('--'));
  if (!resultPath) {
    console.error('Укажите файл результата: npx tsx scripts/eval/gate.ts /tmp/eval.json');
    process.exit(1);
  }

  const result = read(resultPath);
  const baselinePath = args.includes('--baseline') ? args[args.indexOf('--baseline') + 1] : null;
  const baseline = baselinePath && fs.existsSync(path.resolve(baselinePath)) ? read(baselinePath) : null;

  const problems: string[] = [];
  const notes: string[] = [];

  for (const row of result.rows) {
    const label = row.model;

    if (row.cases < THRESHOLDS.minCases) {
      problems.push(`${label}: кейсов ${row.cases} — меньше минимума ${THRESHOLDS.minCases}`);
    }
    if (row.failed > 0) {
      problems.push(`${label}: ${row.failed} кейсов упало с ошибкой`);
    }
    if (row.categoryAcc !== null && row.categoryAcc < THRESHOLDS.minCategoryAcc) {
      problems.push(`${label}: категория угадана ${row.categoryAcc.toFixed(1)}% < ${THRESHOLDS.minCategoryAcc}%`);
    }
    if (row.within20 !== null && row.within20 < THRESHOLDS.minWithin20) {
      problems.push(`${label}: цена в ±20% лишь ${row.within20.toFixed(1)}% < ${THRESHOLDS.minWithin20}%`);
    }
    if (row.grossMiss !== null && row.grossMiss > THRESHOLDS.maxGrossMiss) {
      problems.push(`${label}: грубых промахов ${row.grossMiss.toFixed(1)}% > ${THRESHOLDS.maxGrossMiss}%`);
    }
    // Отказы проверяем, только если в наборе есть мусорные кейсы.
    if (row.refusalN > 0 && row.refusalAcc !== null && row.refusalAcc < THRESHOLDS.minRefusalAcc) {
      problems.push(`${label}: отказы на мусоре ${row.refusalAcc.toFixed(1)}% < ${THRESHOLDS.minRefusalAcc}%`);
    }

    // ─── Сравнение с базовым прогоном ───
    const base = baseline?.rows.find((r) => r.model === row.model);
    if (!base) continue;

    const compare = (name: string, now: number | null, before: number | null, higherIsBetter: boolean) => {
      if (now === null || before === null) return;
      const drop = higherIsBetter ? before - now : now - before;
      if (drop > THRESHOLDS.maxRegressionPp) {
        problems.push(
          `${label}: ${name} ухудшилась на ${drop.toFixed(1)} п.п. ` +
            `(${before.toFixed(1)} → ${now.toFixed(1)}), допуск ${THRESHOLDS.maxRegressionPp}`,
        );
      } else if (drop < -1) {
        notes.push(`${label}: ${name} улучшилась на ${(-drop).toFixed(1)} п.п.`);
      }
    };

    compare('точность категории', row.categoryAcc, base.categoryAcc, true);
    compare('попадание в ±20%', row.within20, base.within20, true);
    compare('доля грубых промахов', row.grossMiss, base.grossMiss, false);
    compare('точность отказов', row.refusalAcc, base.refusalAcc, true);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('ГЕЙТ КАЧЕСТВА AI');
  console.log('═'.repeat(70));
  console.log(`Набор: ${result.dataset}`);
  console.log(`Прогон: ${result.ranAt}`);
  if (baseline) console.log(`База сравнения: ${baseline.ranAt}`);

  for (const note of notes) console.log(`  ↑ ${note}`);

  if (problems.length === 0) {
    console.log('\n✅ Пороги соблюдены\n');
    return;
  }

  console.log('\n❌ Гейт не пройден:');
  for (const problem of problems) console.log(`   • ${problem}`);
  console.log('');
  process.exit(1);
}

main();
