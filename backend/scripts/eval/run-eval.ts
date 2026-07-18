// ============================================
// MasterUz — Eval AI-анализа заказов
// ============================================
//
// Прогоняет набор размеченных кейсов через analyzeOrder и считает метрики:
// точность категории, ошибку цены, долю грубых промахов, стоимость и латентность.
//
// Зачем: без объективных цифр выбор модели и правка промпта — гадание.
// Любое изменение (модель, промпт, число фото) проверяется этим прогоном.
//
// Запуск:
//   npx tsx scripts/eval/run-eval.ts scripts/eval/dataset.json
//   npx tsx scripts/eval/run-eval.ts scripts/eval/dataset.json --model gpt-5.4-mini
//   npx tsx scripts/eval/run-eval.ts scripts/eval/dataset.json --compare gpt-4o,gpt-5.4-mini
//
// Сравнение моделей делает несколько прогонов и печатает таблицу.

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../src/config/index.js';
import { prisma } from '../../src/config/database.js';

interface EvalCase {
  id: string;
  photos: string[];
  text?: string;
  expectCategory?: string;
  expectPrice?: number;
  expectNeedsOnSite?: boolean;
  note?: string;
}

interface CaseOutcome {
  id: string;
  ok: boolean;
  error?: string;
  categoryHit?: boolean;
  predictedCategory?: string;
  confidence?: number;
  predictedPrice?: number | null;
  expectedPrice?: number;
  absError?: number;
  pctError?: number;
  needsOnSiteHit?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
}

/** Локальный файл → data-URL. https-ссылки уходят как есть. */
function toImagePayload(p: string, datasetDir: string): string | null {
  if (/^https?:\/\//i.test(p)) return p;
  const abs = path.isAbsolute(p) ? p : path.resolve(datasetDir, p);
  if (!fs.existsSync(abs)) {
    console.warn(`  ⚠ файл не найден: ${abs}`);
    return null;
  }
  const ext = path.extname(abs).slice(1).toLowerCase() || 'jpeg';
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmt(n: number): string {
  return n.toLocaleString('ru');
}

async function runOnce(cases: EvalCase[], datasetDir: string, model: string) {
  // analyzeOrder читает модель из config — подменяем на время прогона.
  const original = config.openai.model;
  (config.openai as any).model = model;

  // Импорт после подмены: сервис читает config лениво, но так надёжнее.
  const { analyzeOrder } = await import('../../src/services/aiAnalysisService.js');

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
  });
  if (!categories.length) throw new Error('В БД нет активных категорий');

  const outcomes: CaseOutcome[] = [];

  for (const c of cases) {
    process.stdout.write(`  ${c.id} … `);
    const photoUrls = c.photos.map((p) => toImagePayload(p, datasetDir)).filter(Boolean) as string[];

    try {
      const started = Date.now();
      const res = await analyzeOrder({
        photoUrls,
        text: c.text ?? '',
        availableCategories: categories as any,
      });
      const latencyMs = Date.now() - started;

      const top = res.categories[0];
      // Цену сравниваем по середине диапазона — это то, что видит клиент.
      const predictedPrice = res.priceHint
        ? (res.priceHint.min + res.priceHint.max) / 2
        : null;

      const outcome: CaseOutcome = {
        id: c.id,
        ok: true,
        predictedCategory: top?.slug,
        confidence: top?.confidence,
        categoryHit: c.expectCategory ? top?.slug === c.expectCategory : undefined,
        predictedPrice,
        expectedPrice: c.expectPrice,
        needsOnSiteHit:
          c.expectNeedsOnSite === undefined ? undefined : res.needsOnSite === c.expectNeedsOnSite,
        promptTokens: res.raw.promptTokens,
        completionTokens: res.raw.completionTokens,
        latencyMs,
      };

      if (c.expectPrice && predictedPrice != null) {
        outcome.absError = Math.abs(predictedPrice - c.expectPrice);
        outcome.pctError = (outcome.absError / c.expectPrice) * 100;
      }

      outcomes.push(outcome);
      const mark = outcome.categoryHit === false ? '✗ категория' : '✓';
      const priceInfo =
        outcome.pctError != null ? ` цена ±${outcome.pctError.toFixed(0)}%` : ' цена —';
      console.log(`${mark}${priceInfo} (${latencyMs}ms)`);
    } catch (err: any) {
      outcomes.push({ id: c.id, ok: false, error: err?.message ?? String(err) });
      console.log(`✗ ошибка: ${err?.message ?? err}`);
    }
  }

  (config.openai as any).model = original;
  return outcomes;
}

function summarize(model: string, outcomes: CaseOutcome[]) {
  const ok = outcomes.filter((o) => o.ok);
  const failed = outcomes.length - ok.length;

  const catJudged = ok.filter((o) => o.categoryHit !== undefined);
  const catHits = catJudged.filter((o) => o.categoryHit).length;

  const priced = ok.filter((o) => o.pctError != null);
  const within20 = priced.filter((o) => o.pctError! <= 20).length;
  const gross = priced.filter((o) => o.pctError! > 50).length;
  const mae = priced.length ? priced.reduce((s, o) => s + o.absError!, 0) / priced.length : 0;

  const onSiteJudged = ok.filter((o) => o.needsOnSiteHit !== undefined);
  const onSiteHits = onSiteJudged.filter((o) => o.needsOnSiteHit).length;

  const promptTokens = ok.reduce((s, o) => s + (o.promptTokens ?? 0), 0);
  const completionTokens = ok.reduce((s, o) => s + (o.completionTokens ?? 0), 0);
  const latencies = ok.map((o) => o.latencyMs ?? 0);

  // Цена за 1M токенов — задаётся через env, чтобы не зашивать прайс в код.
  // Пример: EVAL_PRICE_IN=0.75 EVAL_PRICE_OUT=4.50
  const priceIn = Number(process.env.EVAL_PRICE_IN ?? 0);
  const priceOut = Number(process.env.EVAL_PRICE_OUT ?? 0);
  const cost = (promptTokens * priceIn + completionTokens * priceOut) / 1_000_000;

  return {
    model,
    cases: outcomes.length,
    failed,
    categoryAcc: catJudged.length ? (catHits / catJudged.length) * 100 : null,
    within20: priced.length ? (within20 / priced.length) * 100 : null,
    grossMiss: priced.length ? (gross / priced.length) * 100 : null,
    mae,
    onSiteAcc: onSiteJudged.length ? (onSiteHits / onSiteJudged.length) * 100 : null,
    avgPromptTokens: ok.length ? Math.round(promptTokens / ok.length) : 0,
    avgLatencyMs: ok.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / ok.length) : 0,
    medLatencyMs: Math.round(median(latencies)),
    cost,
  };
}

function printSummary(rows: ReturnType<typeof summarize>[]) {
  console.log('\n' + '═'.repeat(78));
  console.log('РЕЗУЛЬТАТЫ');
  console.log('═'.repeat(78));

  for (const r of rows) {
    console.log(`\nМодель: ${r.model}`);
    console.log(`  кейсов                : ${r.cases}${r.failed ? `  (ошибок: ${r.failed})` : ''}`);
    console.log(`  категория угадана     : ${r.categoryAcc?.toFixed(1) ?? '—'}%`);
    console.log(`  цена в пределах ±20%  : ${r.within20?.toFixed(1) ?? '—'}%`);
    console.log(`  грубые промахи (>50%) : ${r.grossMiss?.toFixed(1) ?? '—'}%`);
    console.log(`  MAE по цене           : ${fmt(Math.round(r.mae))} сум`);
    console.log(`  needsOnSite угадан    : ${r.onSiteAcc?.toFixed(1) ?? '—'}%`);
    console.log(`  вход. токенов/кейс    : ${fmt(r.avgPromptTokens)}`);
    console.log(`  латентность avg/med   : ${r.avgLatencyMs}ms / ${r.medLatencyMs}ms`);
    if (r.cost > 0) {
      console.log(`  стоимость прогона     : $${r.cost.toFixed(4)}  (~$${(r.cost / r.cases).toFixed(5)}/кейс)`);
    }
  }

  if (rows.length > 1) {
    console.log('\n' + '─'.repeat(78));
    console.log('СРАВНЕНИЕ (выбирайте по ±20% и грубым промахам, не по «ощущениям»)');
    console.log('─'.repeat(78));
    console.log('модель'.padEnd(22) + 'катег.'.padEnd(10) + '±20%'.padEnd(10) + 'промахи'.padEnd(10) + 'ток/кейс');
    for (const r of rows) {
      console.log(
        r.model.padEnd(22) +
          `${r.categoryAcc?.toFixed(0) ?? '—'}%`.padEnd(10) +
          `${r.within20?.toFixed(0) ?? '—'}%`.padEnd(10) +
          `${r.grossMiss?.toFixed(0) ?? '—'}%`.padEnd(10) +
          fmt(r.avgPromptTokens),
      );
    }
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const datasetPath = args.find((a) => !a.startsWith('--'));
  if (!datasetPath) {
    console.error('Укажите путь к датасету: npx tsx scripts/eval/run-eval.ts scripts/eval/dataset.json');
    process.exit(1);
  }

  const modelArg = args.includes('--model') ? args[args.indexOf('--model') + 1] : null;
  const compareArg = args.includes('--compare') ? args[args.indexOf('--compare') + 1] : null;
  const models = compareArg ? compareArg.split(',') : [modelArg ?? config.openai.model];

  const abs = path.resolve(datasetPath);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  const cases: EvalCase[] = raw.cases ?? raw;
  if (!Array.isArray(cases) || !cases.length) {
    console.error('Датасет пуст. Заполните cases[] — см. dataset.example.json');
    process.exit(1);
  }

  console.log(`Датасет: ${abs}`);
  console.log(`Кейсов: ${cases.length}`);
  console.log(`Модели: ${models.join(', ')}\n`);

  const rows = [];
  for (const model of models) {
    console.log(`── ${model} ──`);
    const outcomes = await runOnce(cases, path.dirname(abs), model);
    rows.push(summarize(model, outcomes));
  }

  printSummary(rows);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
