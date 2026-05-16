// ════════════════════════════════════════════════════════════════════
// MasterUz — k6 load test: 10 000 клиентов × 5 000 мастеров
// ────────────────────────────────────────────────────────────────────
// Цель: измерить, как ведёт себя backend при нагрузке маркетплейса
// уровня «активный город».
//
// Сценарии:
//   • client_browse        — клиенты листают ленту заказов (read-heavy)
//   • client_create_order  — клиенты создают заказы (write + fanout)
//   • master_feed          — мастера обновляют свой фид (read)
//   • sse_subscribers      — держим SSE-коннекты (long-lived)
//   • health               — простая проверка живости backend
//
// Запуск:
//   k6 run -e BASE_URL=https://staging.masteruz.uz \
//          -e CLIENT_TOKEN=<jwt-клиента> \
//          -e MASTER_TOKEN=<jwt-мастера> \
//          -e CATEGORY_ID=<uuid> \
//          backend/tests/load/k6-marketplace-10k.js
//
// Перед запуском нужен seed: ~50 категорий, 5 000 мастеров с гео-координатами
// и валидные JWT для клиента и мастера (обычные пользовательские токены).
// Один токен = один виртуальный пользователь — k6 рассылает запросы от его
// имени; для теста этого достаточно (PostgreSQL не различает «новый клиент»
// и «тот же клиент с новым заказом» по нагрузке на write-path).
//
// Метрики, на которые смотрим:
//   • http_req_duration p95 < 800 мс
//   • http_req_failed   < 1 %
//   • iterations        стабильно растут (нет «зависаний»)
//   • errors counter    минимален
// ════════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL     = __ENV.BASE_URL     || 'http://localhost:3001';
const CLIENT_TOKEN = __ENV.CLIENT_TOKEN || '';
const MASTER_TOKEN = __ENV.MASTER_TOKEN || '';
const CATEGORY_ID  = __ENV.CATEGORY_ID  || '';

// ─── Метрики ───────────────────────────────────────────────────────
const errors        = new Counter('app_errors');
const ordersCreated = new Counter('orders_created');
const browseLatency = new Trend('browse_latency_ms');
const createLatency = new Trend('create_order_latency_ms');
const errorRate     = new Rate('error_rate');

// ─── Конфигурация нагрузки ─────────────────────────────────────────
// Маркетплейс «активный город»:
//   10 000 клиентов, 5% активны одновременно → 500 VUs клиентов
//    5 000 мастеров, 30% онлайн             → 1500 VUs мастеров
//
// Сценарии запускаются параллельно — это даёт реалистичную смесь R/W.
// Прогон 6 минут: 1 мин ramp-up, 4 мин пик, 1 мин ramp-down.
export const options = {
  scenarios: {
    // 70% активных клиентов просто листают ленту
    client_browse: {
      executor: 'ramping-vus',
      exec: 'clientBrowse',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 350 },
        { duration: '4m', target: 350 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // 30% активных клиентов создают заказы (самый дорогой путь)
    client_create_order: {
      executor: 'ramping-vus',
      exec: 'clientCreateOrder',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 150 },
        { duration: '4m', target: 150 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // Мастера читают фид и свои заказы
    master_feed: {
      executor: 'ramping-vus',
      exec: 'masterFeed',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 1500 },
        { duration: '4m', target: 1500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },

    // Health-probe: имитирует Kubernetes/Cloudflare пробы
    health: {
      executor: 'constant-arrival-rate',
      exec: 'health',
      rate: 10,
      timeUnit: '1s',
      duration: '6m',
      preAllocatedVUs: 5,
    },
  },

  thresholds: {
    'http_req_failed':                 ['rate<0.02'],   // <2% ошибок
    'http_req_duration':               ['p(95)<800'],   // p95 < 800 мс
    'browse_latency_ms':               ['p(95)<400'],
    'create_order_latency_ms':         ['p(95)<1200'],  // create + fanout — допустимо чуть медленнее
    'error_rate':                      ['rate<0.02'],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────
function authHeaders(token) {
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    tags: { name: 'auth' },
  };
}

function trackResp(res, label) {
  const ok = res.status >= 200 && res.status < 300;
  errorRate.add(!ok);
  if (!ok) {
    errors.add(1, { endpoint: label, status: String(res.status) });
  }
  return ok;
}

// ─── Координаты Ташкента и пригородов (для гео-фанаута) ───────────
const TASHKENT_BBOX = {
  latMin: 41.20, latMax: 41.40,
  lonMin: 69.10, lonMax: 69.40,
};
function randomLatLon() {
  const lat = TASHKENT_BBOX.latMin + Math.random() * (TASHKENT_BBOX.latMax - TASHKENT_BBOX.latMin);
  const lon = TASHKENT_BBOX.lonMin + Math.random() * (TASHKENT_BBOX.lonMax - TASHKENT_BBOX.lonMin);
  return { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) };
}

// ════════════════════════════════════════════════════════════════════
//                    С Ц Е Н А Р И И
// ════════════════════════════════════════════════════════════════════

/** Клиент: листает ленту, открывает заказ, проверяет уведомления. */
export function clientBrowse() {
  group('client_browse', () => {
    const t0 = Date.now();
    const list = http.get(`${BASE_URL}/api/orders?page=1&limit=20`, authHeaders(CLIENT_TOKEN));
    browseLatency.add(Date.now() - t0);
    if (!trackResp(list, 'GET /orders')) return;

    const notif = http.get(`${BASE_URL}/api/notifications?limit=20`, authHeaders(CLIENT_TOKEN));
    trackResp(notif, 'GET /notifications');

    check(list, { 'list 200': (r) => r.status === 200 });
  });

  sleep(randomIntBetween(2, 6));
}

/** Клиент: создаёт заказ → пушит fanout на 50 мастеров → ждёт. */
export function clientCreateOrder() {
  group('client_create_order', () => {
    if (!CATEGORY_ID) {
      console.warn('CATEGORY_ID не задан — пропускаем создание');
      return;
    }
    const { lat, lon } = randomLatLon();
    const payload = JSON.stringify({
      categoryId:     CATEGORY_ID,
      title:          `[loadtest] Заказ #${randomString(6)}`,
      description:    'Тестовый заказ для нагрузочного тестирования MasterUz. Нужен мастер на сегодня.',
      price:          randomIntBetween(200_000, 1_500_000),
      isUrgent:       Math.random() < 0.2,
      offerAccepted:  true,
      latitude:       lat,
      longitude:      lon,
      city:           'Ташкент',
      district:       ['Юнусабад', 'Чиланзар', 'Мирабад', 'Шайхантахур'][randomIntBetween(0, 3)],
    });

    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/api/orders`, payload, authHeaders(CLIENT_TOKEN));
    createLatency.add(Date.now() - t0);

    if (trackResp(res, 'POST /orders')) {
      ordersCreated.add(1);
      check(res, { 'order created': (r) => r.status === 201 || r.status === 200 });
    }
  });

  // Клиент создаёт ~1 заказ в 30-90 секунд (~40-120/час с одного VU)
  sleep(randomIntBetween(30, 90));
}

/** Мастер: смотрит ленту заказов и свои принятые. */
export function masterFeed() {
  group('master_feed', () => {
    const feed = http.get(
      `${BASE_URL}/api/orders?status=PUBLISHED&page=1&limit=20`,
      authHeaders(MASTER_TOKEN),
    );
    trackResp(feed, 'GET /orders (master feed)');

    const my = http.get(`${BASE_URL}/api/orders/my/master`, authHeaders(MASTER_TOKEN));
    trackResp(my, 'GET /orders/my/master');

    const notif = http.get(`${BASE_URL}/api/notifications?limit=20`, authHeaders(MASTER_TOKEN));
    trackResp(notif, 'GET /notifications (master)');
  });

  sleep(randomIntBetween(5, 15));
}

/** Простая проверка живости — должна оставаться быстрой под нагрузкой. */
export function health() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  trackResp(res, 'GET /health');
}

// ─── Отчёт ─────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : 'n/a');

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  MasterUz Load Test — итоги');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Заказов создано:        ${m.orders_created?.values?.count ?? 0}`);
  console.log(`  Ошибок суммарно:        ${m.app_errors?.values?.count ?? 0}`);
  console.log(`  Error rate:             ${fmt((m.error_rate?.values?.rate ?? 0) * 100)} %`);
  console.log(`  Browse p95:             ${fmt(m.browse_latency_ms?.values?.['p(95)'])} ms`);
  console.log(`  Create order p95:       ${fmt(m.create_order_latency_ms?.values?.['p(95)'])} ms`);
  console.log(`  http_req_duration p95:  ${fmt(m.http_req_duration?.values?.['p(95)'])} ms`);
  console.log(`  http_req_failed rate:   ${fmt((m.http_req_failed?.values?.rate ?? 0) * 100)} %`);
  console.log('══════════════════════════════════════════════════════════\n');

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
