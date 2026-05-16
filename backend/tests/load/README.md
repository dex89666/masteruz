# Нагрузочное тестирование MasterUz — k6

Имитация маркетплейса уровня «активный город»:
**10 000 клиентов × 5 000 мастеров**, 6 минут пиковой нагрузки.

## Что проверяем
| Метрика | Цель | Где смотреть |
|---|---|---|
| `http_req_duration` p95 | < 800 мс | summary |
| `http_req_failed` | < 2% | summary |
| `browse_latency_ms` p95 | < 400 мс | k6 dashboard |
| `create_order_latency_ms` p95 | < 1200 мс | k6 dashboard |
| Telegram outbound | 0 ban | логи backend |

## Установка k6
```bash
# Linux
sudo gpg -k && sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Подготовка staging
1. Засеять БД: ≥ 50 категорий, 5 000 мастеров с гео-координатами Ташкента.
2. Создать одного тестового **клиента** и одного тестового **мастера** через обычный Telegram Mini App auth → получить JWT (`access_token`).
3. Узнать `UUID` любой подкатегории.

> Один JWT = один виртуальный пользователь k6. PostgreSQL не различает «новый клиент» и «тот же клиент с новым заказом» по нагрузке на write-path — для теста backend этого достаточно.

## Запуск
```bash
k6 run \
  -e BASE_URL=https://staging.masteruz.uz \
  -e CLIENT_TOKEN=<jwt-клиента> \
  -e MASTER_TOKEN=<jwt-мастера> \
  -e CATEGORY_ID=<uuid-подкатегории> \
  backend/tests/load/k6-marketplace-10k.js
```

## Профиль нагрузки
| Сценарий | VUs | Что делает |
|---|---|---|
| `client_browse` | 0 → **350** → 0 | GET /orders + /notifications, sleep 2-6 сек |
| `client_create_order` | 0 → **150** → 0 | POST /orders + Tashkent geo, sleep 30-90 сек |
| `master_feed` | 0 → **1500** → 0 | GET /orders + /orders/my/master + /notifications |
| `health` | 10 RPS постоянно | GET /health |

Итого пик ≈ **~2000 VUs**, ~150 заказов в минуту = **9 000/час**.
Каждый заказ запускает fanout на 50 мастеров → **~450 000 уведомлений/час** в апогее.

## Что ловим
- **Telegram rate-limit**: смотрим логи на `telegramRateLimiter: redis недоступен` или 429 от Telegram.
- **DB пул**: ожидаемо ~20-30 connections; если выше — `prisma.$pool` слишком жадный.
- **Redis latency**: если SSE пишет p95 > 50 мс, нужен второй Redis под очередь.
- **Memory backend**: при росте RSS > 1.5 GB на ноду — утечка (вероятно EventBus map).

## После теста
1. Проверь Grafana / pino logs за окно теста.
2. Сравни p95 с целями. Если упало — смотри **рекомендации** в `biznes.md`.
3. Открой issue с лейблом `perf`.
