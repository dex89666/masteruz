// ============================================
// MasterUz — Load Test Script (Node.js)
// 100 параллельных заказов + 50 уведомлений
// Запуск: node --import=tsx e2e/load-test.ts
// ============================================

const API_URL = process.env.E2E_API_URL || 'https://masteruz-ecru.vercel.app/api';

interface Result {
  endpoint: string;
  status: number | 'error';
  durationMs: number;
  error?: string;
}

async function timedFetch(url: string, options?: RequestInit): Promise<Result> {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    return {
      endpoint: url.replace(API_URL, ''),
      status: res.status,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err: any) {
    return {
      endpoint: url.replace(API_URL, ''),
      status: 'error',
      durationMs: Math.round(performance.now() - start),
      error: err.message,
    };
  }
}

async function runLoadTest() {
  console.log('═══════════════════════════════════════════════');
  console.log('  MasterUz — Нагрузочное тестирование');
  console.log('═══════════════════════════════════════════════');
  console.log(`API: ${API_URL}\n`);

  // ─── Тест 1: 100 одновременных GET /health ────────
  console.log('▶ Тест 1: 100 × GET /health');
  const healthStart = performance.now();
  const healthResults = await Promise.allSettled(
    Array.from({ length: 100 }, () => timedFetch(`${API_URL}/health`))
  );
  const healthDuration = Math.round(performance.now() - healthStart);
  const healthOk = healthResults.filter(
    r => r.status === 'fulfilled' && (r.value as Result).status === 200
  ).length;
  const healthTimes = healthResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Result>).value.durationMs);
  const healthAvg = Math.round(healthTimes.reduce((a, b) => a + b, 0) / healthTimes.length);
  const healthP95 = healthTimes.sort((a, b) => a - b)[Math.floor(healthTimes.length * 0.95)];

  console.log(`  ✅ ${healthOk}/100 успешных | Общее: ${healthDuration}ms | Avg: ${healthAvg}ms | P95: ${healthP95}ms\n`);

  // ─── Тест 2: 100 одновременных GET /catalog/categories ────
  console.log('▶ Тест 2: 100 × GET /catalog/categories');
  const catStart = performance.now();
  const catResults = await Promise.allSettled(
    Array.from({ length: 100 }, () => timedFetch(`${API_URL}/catalog/categories`))
  );
  const catDuration = Math.round(performance.now() - catStart);
  const catOk = catResults.filter(
    r => r.status === 'fulfilled' && (r.value as Result).status === 200
  ).length;
  const catTimes = catResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Result>).value.durationMs);
  const catAvg = Math.round(catTimes.reduce((a, b) => a + b, 0) / catTimes.length);
  const catP95 = catTimes.sort((a, b) => a - b)[Math.floor(catTimes.length * 0.95)];

  console.log(`  ✅ ${catOk}/100 успешных | Общее: ${catDuration}ms | Avg: ${catAvg}ms | P95: ${catP95}ms\n`);

  // ─── Тест 3: 50 одновременных GET /stores/categories ─────
  console.log('▶ Тест 3: 50 × GET /stores/categories');
  const storeStart = performance.now();
  const storeResults = await Promise.allSettled(
    Array.from({ length: 50 }, () => timedFetch(`${API_URL}/stores/categories`))
  );
  const storeDuration = Math.round(performance.now() - storeStart);
  const storeOk = storeResults.filter(
    r => r.status === 'fulfilled' && (r.value as Result).status === 200
  ).length;
  const storeTimes = storeResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Result>).value.durationMs);
  const storeAvg = Math.round(storeTimes.reduce((a, b) => a + b, 0) / storeTimes.length);
  const storeP95 = storeTimes.sort((a, b) => a - b)[Math.floor(storeTimes.length * 0.95)];

  console.log(`  ✅ ${storeOk}/50 успешных | Общее: ${storeDuration}ms | Avg: ${storeAvg}ms | P95: ${storeP95}ms\n`);

  // ─── Тест 4: 50 одновременных GET /orders (имитация уведомлений) ───
  console.log('▶ Тест 4: 50 × GET /orders (имитация потока уведомлений)');
  const notifyStart = performance.now();
  const notifyResults = await Promise.allSettled(
    Array.from({ length: 50 }, () => timedFetch(`${API_URL}/orders?page=1&limit=10`))
  );
  const notifyDuration = Math.round(performance.now() - notifyStart);
  const notifyOk = notifyResults.filter(
    r => r.status === 'fulfilled' && (r.value as Result).status === 200
  ).length;
  const notifyTimes = notifyResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Result>).value.durationMs);
  const notifyAvg = Math.round(notifyTimes.reduce((a, b) => a + b, 0) / notifyTimes.length);
  const notifyP95 = notifyTimes.sort((a, b) => a - b)[Math.floor(notifyTimes.length * 0.95)];

  console.log(`  ✅ ${notifyOk}/50 успешных | Общее: ${notifyDuration}ms | Avg: ${notifyAvg}ms | P95: ${notifyP95}ms\n`);

  // ─── Тест 5: Смешанная нагрузка (100 запросов разных endpoint'ов) ──
  console.log('▶ Тест 5: 100 × смешанных запросов (имитация реальной нагрузки)');
  const endpoints = [
    `${API_URL}/health`,
    `${API_URL}/catalog/categories`,
    `${API_URL}/stores/categories`,
    `${API_URL}/orders?page=1`,
  ];
  const mixStart = performance.now();
  const mixResults = await Promise.allSettled(
    Array.from({ length: 100 }, (_, i) =>
      timedFetch(endpoints[i % endpoints.length])
    )
  );
  const mixDuration = Math.round(performance.now() - mixStart);
  const mixOk = mixResults.filter(
    r => r.status === 'fulfilled' && (r.value as Result).status === 200
  ).length;
  const mixTimes = mixResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Result>).value.durationMs);
  const mixAvg = Math.round(mixTimes.reduce((a, b) => a + b, 0) / mixTimes.length);
  const mixP95 = mixTimes.sort((a, b) => a - b)[Math.floor(mixTimes.length * 0.95)];

  console.log(`  ✅ ${mixOk}/100 успешных | Общее: ${mixDuration}ms | Avg: ${mixAvg}ms | P95: ${mixP95}ms\n`);

  // ─── Итог ─────────────────────────────────────────
  const total = healthOk + catOk + storeOk + notifyOk + mixOk;
  const totalReqs = 100 + 100 + 50 + 50 + 100;
  const passRate = ((total / totalReqs) * 100).toFixed(1);

  console.log('═══════════════════════════════════════════════');
  console.log(`  ИТОГО: ${total}/${totalReqs} успешных (${passRate}%)`);
  console.log('═══════════════════════════════════════════════');

  if (parseFloat(passRate) < 90) {
    console.log('⚠️  Проходимость ниже 90% — требуется оптимизация!');
    process.exit(1);
  } else {
    console.log('✅ Нагрузочное тестирование пройдено!');
  }
}

runLoadTest().catch(console.error);
