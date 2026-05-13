# 🔧 MasterUz — Платформа бытовых и строительных услуг

> Полнофункциональная экосистема-посредник для соединения клиентов с мастерами ремонтно-строительных услуг в Узбекистане. Включает веб-приложение, Telegram Mini App, админ-панель, эскроу-платежи, систему оценки, партнёрские магазины и ремонт под ключ.

**Продакшен:** [masteruz.uz](https://masteruz.uz) · **Telegram Bot:** [@Handymanuzbot](https://t.me/Handymanuzbot)

---

## 📋 Содержание

- [Обзор платформы](#-обзор-платформы)
- [Архитектура](#-архитектура)
- [Взаимодействие сервисов](#-взаимодействие-сервисов)
- [Пропускная способность](#-пропускная-способность)
- [Безопасность и защита от атак](#-безопасность-и-защита-от-атак)
- [Технологический стек](#-технологический-стек)
- [Модули бэкенда (24 модуля, 120+ API)](#-модули-бэкенда-24-модуля-120-api)
- [База данных (37 моделей, 13 enum)](#-база-данных-37-моделей-13-enum)
- [Фронтенд (41 страница, 35 компонентов)](#-фронтенд-41-страница-35-компонентов)
- [Внешние интеграции](#-внешние-интеграции)
- [Инфраструктура и деплой](#-инфраструктура-и-деплой)
- [🚀 PRODUCTION CHECKLIST — точные шаги запуска](#-production-checklist--точные-шаги-запуска)
- [Быстрый старт (разработка)](#-быстрый-старт-разработка)
- [Структура проекта](#-структура-проекта)
- [Переменные окружения](#-переменные-окружения)
- [Лицензия](#-лицензия)

---

## 🌐 Обзор платформы

MasterUz — это маркетплейс бытовых услуг, объединяющий:

| Роль | Возможности |
|------|------------|
| **Клиент** | Заказ услуг из каталога, корзина, выбор мастера, чат, оплата, гарантия, отзывы, избранное |
| **Мастер** | Приём заказов, отклики, портфолио, сертификаты, школа обучения, баланс, онлайн-статус |
| **Менеджер** | Модерация заказов, смет, чата, управление каталогом, аналитика |
| **Админ** | Полный контроль: пользователи, финансы, конфигурация, чёрный список, промо-коды |

### Ключевые бизнес-функции

- 🛒 **Каталог услуг** — 15 категорий, 55+ подкатегорий, 200+ задач с ценами, 3-язычные названия
- 💰 **Эскроу-система** — средства блокируются при создании заказа, переводятся мастеру после двойного подтверждения
- 🎯 **Два режима создания заказа** — пользователь выбирает между быстрым AI-режимом и пошаговым визардом:
  - 📸 **«Заказ за 30 секунд»** (источник `INSTANT_AI`) — фото + голос/текст → AI Vision (GPT-4o) → 3 варианта (Good/Better/Best) → готовый заказ. Для тех, кто **не уверен**, что именно нужно.
  - 🧩 **«Детализированный заказ»** (источник `DETAILED_WIZARD`) — визард из 4 шагов (категория → подкатегория → задачи → детали). Для тех, кто **точно знает**, что нужно.
  - Точка входа `/new-order` — промежуточная страница выбора режима.
  - Поле `Order.source` (enum `OrderSource`) позволяет разделять воронки в аналитике.
- 📊 **Система оценки (Estimation)** — выезд мастера на осмотр → составление сметы → модерация → создание заказа
- 🏗️ **Ремонт под ключ (Turnkey)** — комплексные проекты с этапами, калькулятором, дизайн-проектом
- 🏪 **Партнёрские магазины** — маркетплейс стройматериалов со скидками для мастеров
- 🎓 **Школа мастеров** — обучающие курсы, сертификация, обязательные курсы для активации
- 💬 **Чат с авто-модерацией** — 40+ regex-правил, фильтрация контактов, мата, обхода комиссии
- 🛡️ **Гарантия** — конфигурируемый гарантийный срок после завершения заказа
- 📡 **Real-time SSE** — мгновенные уведомления о смене статуса, подтверждении, назначении мастера
- 📝 **Форум мастеров** — темы, ответы, модерация контента, закрепление/блокировка (админ)
- 🔗 **Реферальная система** — бонусы за приглашение мастеров (5%) и клиентов (3%)
- 🎫 **Промо-коды** — процент или фиксированная скидка, лимиты, минимальная сумма заказа

---

## 🏗 Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│                        КЛИЕНТЫ                                │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Веб-сайт    │  │ Telegram        │  │  Админ-панель   │  │
│  │  (React SPA) │  │ Mini App (TWA)  │  │  (/admin)       │  │
│  └──────┬───────┘  └───────┬─────────┘  └───────┬─────────┘  │
└─────────┼──────────────────┼────────────────────┼────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│  Nginx Reverse Proxy / Railway Edge (SSL, Gzip, Rate Limit) │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│               Backend (Node.js + Express + TypeScript)        │
│                                                               │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Auth   │ │  Orders  │ │ Payments │ │   Estimation     │  │
│  │(TG+JWT) │ │ (Escrow) │ │(Click/PM)│ │  (Сметы/Оценка)  │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Catalog │ │   Chat   │ │  Admin   │ │    Turnkey       │  │
│  │ (CRUD)  │ │(Moderate)│ │(Панель)  │ │ (Под ключ)       │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Ratings │ │   Geo    │ │  School  │ │    Stores        │  │
│  │(Отзывы) │ │(Геопоиск)│ │(Обучение)│ │ (Магазины)       │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Referral │ │ Balance  │ │  Photos  │ │   Portfolio      │  │
│  │(Бонусы) │ │(Кошелёк) │ │(До/Посл.)│ │ (Работы мастера) │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  Promo  │ │Guarantee │ │Favorites │ │  Notifications   │  │
│  │(Скидки) │ │(Гарантия)│ │(Избранн.)│ │ (Push + In-App)  │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│  ┌─────────┐ ┌──────────┐                                     │
│  │  Users  │ │  Photos  │          22 бизнес-модуля            │
│  │(Профили)│ │(Загрузка)│                                     │
│  └─────────┘ └──────────┘                                     │
└────────┬─────────────┬──────────────────┬────────────────────┘
         │             │                  │
         ▼             ▼                  ▼
┌──────────────┐ ┌───────────┐  ┌─────────────────────┐
│ PostgreSQL   │ │   Redis   │  │ File Storage        │
│ (Railway/16) │ │(ioredis)  │  │ (Volume / Disk)     │
│ Prisma ORM   │ │           │  │                     │
│ 35 моделей   │ │ JWT revoke│  │ JPEG/PNG/WebP/PDF   │
│ 12 enum      │ │ + cache   │  │ до 5MB × 5 файлов   │
└──────────────┘ └───────────┘  └─────────────────────┘
```

---

## 🔗 Взаимодействие сервисов

### Граф зависимостей (runtime)

```
┌─────────────────── ВНЕШНИЙ МИР ───────────────────────┐
│                                                        │
│  Браузер/TWA  ──HTTPS──►  Nginx (443)                  │
│                               │                        │
│  Telegram Bot API  ◄──────────┤ ◄──── Backend push     │
│                               │                        │
│  Click / Payme  ──webhook──►  │                        │
│                               │                        │
│  Yandex Maps API  ◄──fetch──  │                        │
└───────────────────────────────┼────────────────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │          Nginx              │
                 │   reverse proxy + SSL       │
                 │  gzip + cache headers       │
                 └──────┬──────────┬───────────┘
                        │          │
              ┌─────────▼──┐  ┌────▼──────────┐
              │  Frontend  │  │   Backend API  │
              │  Nginx SPA │  │  Express+TS    │
              │  :80       │  │  :3000         │
              └────────────┘  └──┬──────┬──────┘
                                 │      │
                    ┌────────────▼┐  ┌──▼──────────┐
                    │ PostgreSQL  │  │    Redis     │
                    │ :5432       │  │    :6379     │
                    │ Prisma ORM  │  │ JWT blacklist│
                    │ 37 моделей  │  │ SSE tickets  │
                    │ SCRAM-SHA256│  │ Rate limit   │
                    └─────────────┘  └─────────────┘
```

### Потоки данных для ключевых сценариев

#### Сценарий 1: Авторизация через Telegram Mini App
```
TWA → /api/auth/telegram-mini-app
  │
  ├─► Verify HMAC-SHA256(initData, BOT_TOKEN)   [crypto, без БД]
  ├─► prisma.user.upsert(telegramId)             [PostgreSQL]
  ├─► generateReferralCode()                     [helpers]
  ├─► jwt.sign(payload, JWT_SECRET, 7d)          [jsonwebtoken]
  ├─► jwt.sign(payload, REFRESH_SECRET, 30d)     [jsonwebtoken]
  └─► Response: { accessToken, refreshToken, user }
```

#### Сценарий 2: Создание заказа с эскроу
```
Client → POST /api/orders
  │
  ├─► authenticate() → checkUserActive()         [middleware]
  ├─► validateBody(CreateOrderSchema)             [Zod]
  ├─► rateLimit: 20 orders/hour per IP            [express-rate-limit]
  ├─► prisma.order.create({ status: PUBLISHED })  [PostgreSQL tx]
  ├─► prisma.balance.update (ESCROW_HOLD)         [atomic tx]
  ├─► eventBus.emit('order_created')              [in-memory SSE]
  ├─► notificationService.notifyNearbyMasters()   [Telegram Bot API]
  │     └─► forEach master: sendTelegramMessage() [up to 50 push]
  └─► Response: { order }
```

#### Сценарий 3: Оплата комиссии через Click
```
Client → POST /api/payments/commission
  │
  ├─► generateClickPaymentUrl(orderId, amount)    [backend]
  └─► Response: { paymentUrl }

Click Server → POST /api/payments/click-webhook
  │
  ├─► Verify MD5 signature                        [crypto]
  ├─► prisma.payment.update(COMPLETED)            [PostgreSQL]
  ├─► prisma.order.update(ACCEPTED)               [PostgreSQL]
  ├─► auditService.log(payment_completed)         [AuditLog]
  ├─► eventBus.emit('status_changed')             [SSE]
  └─► notificationService.notifyMasterAssigned()  [Telegram push]
```

#### Сценарий 4: Real-time SSE обновления заказа
```
Client → POST /api/orders/:id/events-ticket  (JWT auth)
  └─► redis.setex(ticket, 30, userId)            [30-секунд TTL]

Client → GET /api/orders/:id/events?ticket=...
  ├─► redis.get(ticket) → validate once           [одноразовый]
  ├─► redis.del(ticket)                           [самоуничтожение]
  ├─► res.setHeader('Content-Type', 'text/event-stream')
  ├─► eventBus.addClient(orderId, userId, res)    [in-memory Map]
  └─► Keepalive ping каждые 30 сек

Master → PUT /api/orders/:id/status
  └─► eventBus.emit(orderId, 'status_changed', data)  → SSE push to all subscribers
```

#### Сценарий 5: ФотоЗаказ за 30 секунд (AI)
```
Client → POST /api/instant-order/analyze
  │  (multipart: фото + описание)
  │
  ├─► Multer: MIME-check + size limit 5MB         [middleware]
  ├─► AI анализ категории по фото + тексту        [backend logic]
  ├─► Подбор задач из каталога                    [PostgreSQL]
  ├─► Генерация 3 вариантов (GOOD/BETTER/BEST)    [AiTier enum]
  ├─► prisma.aiOrderTemplate.createMany()         [PostgreSQL]
  └─► Response: { templates: [good, better, best] }

Client → POST /api/instant-order/create
  ├─► prisma.order.create(from template)          [PostgreSQL]
  └─► (optional) → Moderation queue → PUBLISHED
```

### Межсервисные зависимости

| Сервис | Зависит от | Используется в |
|--------|-----------|----------------|
| **Backend API** | PostgreSQL, Redis, Telegram Bot API, Click, Payme | Frontend, Nginx |
| **Frontend** | Backend API, Yandex Maps JS API | Nginx |
| **Nginx** | Frontend, Backend | Браузер, Telegram TWA |
| **PostgreSQL** | — | Backend (Prisma ORM) |
| **Redis** | — | Backend (JWT blacklist, SSE tickets, rate limit cache) |
| **Telegram Bot API** | — | Backend (push уведомления, auth) |
| **Click** | — | Backend (payment URL + webhook) |
| **Payme** | — | Backend (JSON-RPC webhook) |
| **Yandex Maps** | — | Frontend (геокодинг, карты) |
| **EventBus (SSE)** | Redis (tickets), Backend memory | Frontend (EventSource) |
| **NotificationService** | PostgreSQL (создание уведомлений), Telegram Bot API | Orders, Payments |
| **AuditService** | PostgreSQL (auditLog table) | Admin, Payments |

---

## ⚡ Пропускная способность

### Теоретические лимиты (VPS: 4 vCPU, 8 GB RAM)

| Компонент | Теоретический предел | Реальный предел | Бутылочное горлышко |
|-----------|---------------------|-----------------|--------------------|
| **Nginx** | ~20 000 req/s (статика) | ~3 000 req/s (proxy) | `worker_connections 1024` |
| **Node.js (1 процесс)** | ~2 000 req/s (без БД) | **100–400 req/s** | Single-thread, нет PM2 cluster |
| **PostgreSQL** | ~5 000 simple queries/s | **200–1 000 req/s** | Pool = 5 + Prisma overhead |
| **Redis** | ~80 000 ops/s | ~15 000 ops/s | 128 MB лимит памяти |
| **SSE соединения** | Неограниченно (TCP) | ~500 concurrent | Память Node.js процесса |

### Текущие Rate Limits (per IP)

| Эндпоинт | Лимит | Окно | Реальная скорость |
|---------|-------|------|-------------------|
| Глобальный `/api/*` | 1 000 req | 15 мин | ~1.1 req/сек |
| Auth `/api/auth` | 10 req | 15 мин | 0.01 req/сек |
| Заказы `/api/orders` | 20 req | 1 час | 0.006 req/сек |
| Платежи `/api/payments` | 30 req | 15 мин | 0.03 req/сек |
| Загрузки `/api/photos` | 30 req | 15 мин | 0.03 req/сек |
| Партнёры `/api/stores/partner-request` | 3 req | 1 час | 0.001 req/сек |

### Расчёт ёмкости для продакшена

```
Целевая аудитория: 10 000 DAU (Узбекистан)
Пик: 1 000 concurrent пользователей
Среднее API-запросов на пользователя: 8–12/мин

Пиковая нагрузка: 1 000 × 10 = 10 000 req/мин = 167 req/сек

Текущая ёмкость Node.js: 100–400 req/сек ✅

Для масштабирования до 100 000 DAU:
→ PM2 cluster (4 воркера) → 400–1 600 req/сек
→ Horizontal scaling (Nginx upstream) → N × 400 req/сек
→ PostgreSQL read replicas → снизить нагрузку на мастер
→ Redis cluster → для SSE и rate limit при масштабировании
```

### Известные узкие места

| Проблема | Влияние | Решение |
|---------|---------|---------|
| **Single Node.js process** | При > 500 RPS падёт перфоманс | PM2 cluster + workers |
| **Prisma connection pool (по умолчанию ~5)** | При > 100 concurrent DB запросов — очередь | `datasource db { url = "...?connection_limit=20" }` |
| **MemoryStore rate limiter** | Сбрасывается при рестарте, не shared между PM2 | Заменить на Redis-backed limiter |
| **SSE in-memory EventBus** | Не работает при multiple instances | Redis Pub/Sub при горизонтальном масштабировании |
| **worker_connections 1024** | Nginx ограничен 2048 conn при 2 CPU | Увеличить до 4096 |
| **PostgreSQL 512 MB** | При > 200 concurrent запросов — swap | Увеличить до 2 GB + pgBouncer |

---

## 🛡️ Безопасность и защита от атак

### Реализованные меры (оценка 7/10)

| Функция | Статус | Описание |
|---------|--------|----------|
| **TLS 1.2/1.3 + HSTS** | ✅ Реализовано | Let's Encrypt, HSTS 1 год + includeSubDomains |
| **Security Headers** | ✅ Реализовано | X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy |
| **Content Security Policy** | ✅ Реализовано | Ограничены источники скриптов, frame-ancestors для Telegram |
| **JWT + Redis blacklist** | ✅ Реализовано | Access 7d + Refresh 30d, отзыв через Redis |
| **Telegram HMAC-SHA256** | ✅ Реализовано | Верификация Login Widget и Mini App initData |
| **Rate Limiting (6 уровней)** | ✅ Реализовано | Global / Auth / Orders / Finance / Uploads / Partner |
| **Zod валидация** | ✅ Реализовано | Все эндпоинты — body, query, params |
| **SQL Injection Protection** | ✅ Реализовано | Prisma ORM параметризованные запросы |
| **File Upload Security** | ✅ Реализовано | MIME + расширение whitelist, 5MB limit, max 5 файлов |
| **CORS restricted** | ✅ Реализовано | Только `https://{DOMAIN}` |
| **Чат-модерация (40+ regex)** | ✅ Реализовано | Блокировка обхода комиссии, контактов, мата |
| **Escrow защита** | ✅ Реализовано | Средства блокируются до двойного подтверждения |
| **Чёрный список пользователей** | ✅ Реализовано | С привязкой к доказательствам и типам нарушений |
| **Click MD5 подпись** | ✅ Реализовано | Верификация webhook |
| **Payme JSON-RPC Basic Auth** | ✅ Реализовано | Верификация webhook |
| **SSE одноразовые тикеты** | ✅ Реализовано | Redis TTL 30 сек, не JWT в URL |
| **Non-root Docker user** | ✅ Реализовано | uid=1001, `masteruz` user |
| **UFW Firewall** | ✅ Реализовано | Только 22/80/443 |
| **fail2ban** | ✅ Реализовано | SSH brute-force защита |
| **PostgreSQL SCRAM-SHA-256** | ✅ Реализовано | Современная аутентификация |
| **Redis requirepass** | ✅ Реализовано | Пароль в продакшене |
| **Audit Log** | ✅ Реализовано | Все финансовые и admin-операции |
| **checkUserActive middleware** | ✅ Реализовано | Заблокированный = 403 на всех запросах |
| **Secrets в env** | ✅ Реализовано | Ничего не захардкожено, генерация openssl |
| **Pagination DoS protection** | ✅ Реализовано | `clampPagination()` — `limit ≤ 100` |

### DDoS-защита: анализ и рекомендации

#### Текущая защита
```
L3/L4 (volumetric):  ❌ НЕТ — зависит от хостинг-провайдера
L7 (application):    ⚠️ ЧАСТИЧНАЯ — rate limiting в Express MemoryStore
Nginx connection:    ❌ НЕТ — нет limit_conn, limit_req на уровне Nginx
WAF:                 ❌ НЕТ — нет ModSecurity, Cloudflare WAF
Bot protection:      ❌ НЕТ
```

#### Рекомендуемые улучшения перед продакшеном

**1. Nginx rate limiting (добавить в `nginx.conf`):**
```nginx
# Добавить в секцию http {}
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=addr:10m;

# Добавить в location /api/
limit_req zone=api burst=20 nodelay;
limit_conn addr 20;
```

**2. Cloudflare (рекомендован для продакшена):**
- Бесплатный план: L3/L4 DDoS защита, Bot Fight Mode
- Pro план ($20/мес): WAF правила, rate limiting на edge
- DNS: masteruz.uz → Cloudflare → VPS IP (скрытый)

**3. Redis-backed Rate Limiter (заменить MemoryStore):**
```bash
npm install rate-limit-redis
# Тогда rate limit не сбрасывается при рестарте
# И shared между воркерами PM2
```

### Фишинг-защита: анализ

| Механизм | Статус | Детали |
|---------|--------|--------|
| **CSP** | ✅ | `default-src 'self'` — блокирует загрузку внешних ресурсов |
| **X-Frame-Options** | ✅ | `SAMEORIGIN` — защита от clickjacking/iframe фишинга |
| **HSTS** | ✅ | 1 год — браузер не разрешает HTTP (SSL-stripping) |
| **Telegram HMAC** | ✅ | Невозможно подделать initData без BOT_TOKEN |
| **Strict CORS** | ✅ | Только официальный домен |
| **`script-src 'self'`** | ✅ | Только собственные скрипты загружаются |
| **SPF/DKIM/DMARC** | ⚠️ | Настроить для email-доменов (если используются) |
| **Мониторинг похожих доменов** | ❌ | Нет защиты от masteruz.com, master-uz.uz и т.д. |

### Известные уязвимости (требуют решения перед продакшеном)

| # | Уязвимость | Риск | Решение |
|---|-----------|------|---------|
| 1 | **JWT в localStorage** (уязвим для XSS) | ВЫСОКИЙ | Перейти на HttpOnly cookies при расширении |
| 2 | **MemoryStore rate limiter** (сбрасывается) | СРЕДНИЙ | `rate-limit-redis` |
| 3 | **Нет CSRF токена** | СРЕДНИЙ | Принято: SameSite strict + JWT Bearer достаточно для API |
| 4 | **`style-src 'unsafe-inline'`** в CSP | СРЕДНИЙ | Tailwind нужен; использовать `nonce` в следующей итерации |
| 5 | **Payme: нет IP whitelist** | СРЕДНИЙ | Добавить список IP Paycom |
| 6 | **Rate limiter не в Redis** | НИЗКИЙ | При горизонтальном масштабировании обязательно |
| 7 | **Нет 2FA для admin** | НИЗКИЙ | TOTP для критичных операций |
| 8 | **worker_connections 1024** | НИЗКИЙ | Увеличить до 4096 для 4 CPU сервера |

---

## 🛠️ Технологический стек

### Backend

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **Node.js** | 20+ | Runtime |
| **Express** | 4.18 | HTTP-фреймворк |
| **TypeScript** | 5.3 | Типизация |
| **Prisma ORM** | 5.10 | ORM + миграции + seed |
| **PostgreSQL** | 15/16 | Основная БД |
| **Redis** | 7 | Кеш + JWT blacklist (ioredis TCP / in-memory) |
| **Zod** | 3.22 | Валидация входных данных |
| **jsonwebtoken** | 9.0 | JWT access + refresh tokens |
| **bcryptjs** | 2.4 | Хеширование паролей |
| **multer** | 1.4 | Загрузка файлов |
| **helmet** | 7.1 | Защитные HTTP-заголовки |
| **express-rate-limit** | 7.1 | Rate limiting |
| **compression** | 1.8 | Gzip-сжатие |
| **pino** | 8.19 | Быстрый JSON-логгер |
| **vitest** | 1.3 | Тесты |

### Frontend

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **React** | 18.3 | UI-библиотека |
| **Vite** | 5.1 | Сборщик + HMR + code splitting |
| **TypeScript** | 5.3 | Типизация |
| **TailwindCSS** | 3.4 | Utility-first CSS |
| **Zustand** | 4.5 | Стейт-менеджмент (3 стора) |
| **TanStack Query** | 5.24 | Серверный стейт + кеширование |
| **React Router** | 6.22 | Клиентский роутинг (33 маршрута) |
| **Axios** | 1.6 | HTTP-клиент (142 API-метода) |
| **Lucide React** | 0.344 | SVG-иконки |
| **React Hot Toast** | 2.4 | Уведомления |

### Инфраструктура

| Технология | Назначение |
|-----------|------------|
| **Railway** | Основной продакшен-деплой (Docker) |
| **Docker + Docker Compose** | Альтернативный деплой (VPS) |
| **Nginx** | Reverse proxy + SSL (VPS) |
| **Let's Encrypt + Certbot** | SSL-сертификаты (VPS) |
| **GitHub Actions** | CI/CD: тесты → Docker build → деплой |
| **Railway PostgreSQL** | Managed PostgreSQL |
| **Railway Redis** | Managed Redis |

---

## 📦 Модули бэкенда (24 модуля, 120+ API)

### 🔑 Auth — Авторизация

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/auth/telegram` | Вход через Telegram Login Widget (HMAC-SHA256) |
| `POST /api/auth/telegram-mini-app` | Вход через Telegram Mini App (WebAppData) |
| `POST /api/auth/refresh` | Обновление JWT пары |
| `GET /api/auth/me` | Текущий пользователь |
| `POST /api/auth/logout` | Выход (отзыв refresh token в Redis) |

- Автоматическая регистрация при первом входе
- JWT Access Token (7 дней) + Refresh Token (30 дней)
- Генерация реферального кода при регистрации

### 👤 Users — Пользователи и мастера

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/users/masters` | Поиск мастеров (город, специализация, рейтинг, текст) |
| `GET /api/users/masters/:id` | Профиль мастера |
| `PUT /api/users/profile` | Обновление профиля |
| `POST /api/users/become-master` | Стать мастером |
| `PUT /api/users/master-profile` | Обновить мастер-профиль |
| `PUT /api/users/categories` | Перезаписать специализации |
| `POST /api/users/certificates` | Загрузить сертификат |
| `POST /api/users/heartbeat` | Heartbeat онлайн-статуса (30 сек) |
| `POST /api/users/go-offline` | Уход в оффлайн |

### 📦 Orders — Заказы с эскроу

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/orders` | Создать заказ (эскроу-блокировка средств) |
| `POST /api/orders/:id/respond` | Отклик мастера |
| `PUT /api/orders/:id/assign` | Клиент назначает мастера |
| `PUT /api/orders/:id/status` | Мастер обновляет статус |
| `PUT /api/orders/:id/master-confirm` | Мастер подтверждает завершение |
| `PUT /api/orders/:id/client-confirm` | Клиент подтверждает (средства → мастеру) |
| `PUT /api/orders/:id/cancel` | Отмена (штрафы 0/20 000/30 000 сум) |
| `PUT /api/orders/:id/dispute` | Открытие спора |
| `PUT /api/orders/:id/resolve-dispute` | Разрешение спора (admin) |

**Жизненный цикл заказа:**
```
PUBLISHED → ACCEPTED → IN_TRANSIT → IN_PROGRESS → (двойное подтверждение) → COMPLETED
                                                  └→ DISPUTED → разрешение (refund/pay/split)
                                         └→ CANCELLED (+ штрафы)
```

- **Эскроу:** средства клиента блокируются → после двойного подтверждения переводятся мастеру (минус комиссия)
- **Комиссия:** 15% от работы + 10% от выезда (конфигурируется)
- **Срочность:** +40% к цене за срочный заказ
- **Авто-завершение:** через 1 час после подтверждения мастером
- **Ограничение новичков:** мастера с < 5 заказов — макс 70% от цены
- **Авто-назначение:** при включённом флаге `auto_assign_master` мастер назначается автоматически при отклике
- **SSE Real-time:** обновления статуса, подтверждений, назначений в реальном времени через EventSource

### 💳 Payments — Платежи

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/payments/commission` | Оплата комиссии |
| `POST /api/payments/registration-fee` | Регистрационный взнос (400 000 сум) |
| `POST /api/payments/click-webhook` | Webhook Click (MD5) |
| `POST /api/payments/payme-webhook` | Webhook Payme (JSON-RPC) |
| `POST /api/payments/telegram-stars` | Оплата через Telegram Stars |
| `GET /api/payments/history` | История платежей |

### 💰 Balance — Кошелёк и эскроу

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/balance` | Текущий баланс |
| `POST /api/balance/topup` | Пополнение |
| `GET /api/balance/transactions` | История транзакций (9 типов) |

Типы транзакций: `TOPUP`, `ESCROW_HOLD`, `ESCROW_RELEASE`, `PENALTY`, `REFUND`, `COMMISSION`, `PAYOUT`, `ESTIMATION_FEE`, `ESTIMATE_PAYOUT`

### 🔍 Estimation — Оценка и сметы

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/estimation` | Создать заказ на выезд (150 000 сум) |
| `POST /api/estimation/:orderId/estimate` | Мастер составляет смету |
| `PUT /api/estimation/estimate/:estimateId/send` | Мастер отправляет смету |
| `GET /api/estimation/admin/moderation` | Сметы на модерации |
| `PUT /api/estimation/admin/moderate/:estimateId` | Модерация сметы |
| `PUT /api/estimation/:estimateId/approve` | Клиент одобряет → создаётся основной заказ |
| `PUT /api/estimation/:estimateId/reject` | Клиент отказывается |

**Жизненный цикл оценки:**
```
Выезд заказан → Мастер оплачивает комиссию (30 000 сум) → Выезд → Составление сметы
→ Модерация админом → Отправка клиенту → Одобрение → Создание основного заказа
```

### 📸 Instant Order — ФотоЗаказ за 30 секунд (AI)

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/instant-order/analyze` | AI-анализ фото + описания → 3 варианта (Good/Better/Best) |
| `POST /api/instant-order/create` | Создать заказ из выбранного AI-варианта |
| `GET /api/instant-order/template/:id` | Получить AI-шаблон по ID |
| `GET /api/instant-order/admin/moderation` | AI-заказы на модерации (для менеджеров) |
| `PUT /api/instant-order/admin/moderate/:orderId` | Одобрить/отклонить AI-заказ |

**Поток работы:**
```
Фото + голос/текст → AI определяет категорию → Подбирает задачи/материалы
→ 3 варианта (⭐ Good / ⚡ Better / 👑 Best) → Фиксированная цена
→ Клиент выбирает → [Доп. пожелания → Модерация] → Заказ опубликован
```

### 📂 Catalog — Каталог услуг

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/catalog/categories` | Все категории (с подкатегориями) |
| `GET /api/catalog/categories/:slug` | Категория + подкатегории + задачи |
| `GET /api/catalog/subcategories/:slug` | Подкатегория + задачи |
| `GET /api/catalog/tasks` | Задачи (фильтр по subcategoryId) |
| `GET /api/catalog/pricelist` | Прайс-лист |
| `POST/PUT/DELETE /api/catalog/admin/*` | Полный CRUD (ADMIN + MANAGER) |

Трёхуровневая иерархия с 3-язычными названиями (ru/uz/en), мягкое удаление.

### 💬 Chat — Чат с авто-модерацией

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/chat/:orderId` | История сообщений |
| `POST /api/chat/:orderId` | Отправить сообщение (проходит модерацию) |
| `GET /api/chat/unread/count` | Непрочитанные |
| `GET /api/chat/admin/flagged` | Помеченные сообщения |
| `PUT /api/chat/admin/:messageId/block` | Блокировка сообщения |

**Авто-модерация (40+ правил):**
- 🚫 Обход комиссии — «напрямую», «без посредника», «обойти комиссию»
- 📞 Обмен контактами — телефоны, email, username, Telegram-ссылки
- 🤬 Мат и оскорбления — русский + узбекский
- ⚠️ 3 уровня: `warning` (флаг), `flag` (подозрительное), `block` (цензура звёздочками)

### 🏗️ Turnkey — Ремонт под ключ

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/turnkey` | Создать заявку (тип объекта, площадь, бюджет) |
| `GET /api/turnkey/my` | Мои проекты |
| `GET /api/turnkey/calculator` | Калькулятор стоимости (расценки за м²) |
| `PUT /api/turnkey/admin/:id/status` | Обновить статус (7 стадий) |
| `PUT /api/turnkey/admin/:id/stage` | Обновить этап |

7 автоматических этапов: INQUIRY → CONSULTATION → DESIGNING → APPROVED → IN_PROGRESS → COMPLETED

### 🏪 Stores — Партнёрские магазины

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/stores` | Каталог магазинов |
| `GET /api/stores/:id/products` | Товары магазина |
| `POST /api/stores/partner-request` | Заявка на партнёрство |
| `POST /api/stores/admin` | CRUD магазинов (admin) |
| `PUT /api/stores/admin/requests/:id/approve` | Одобрение заявки |

7 категорий магазинов, каталог товаров, скидки для мастеров, отзывы.

### ⭐ Ratings — Отзывы

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/reviews` | Оставить отзыв (только после COMPLETED) |
| `GET /api/reviews/master/:id` | Отзывы о мастере |

Взаимные отзывы (клиент ↔ мастер), 1–5 звёзд, авто-пересчёт среднего рейтинга.

### 🔗 Referrals — Реферальная система

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/referrals/link` | Реферальная ссылка (Telegram Deep Link + web) |
| `GET /api/referrals/stats` | Статистика |
| `POST /api/referrals/apply` | Применить реферальный код |

Типы: MASTER_TO_MASTER (5%), CLIENT_TO_CLIENT (3%). Бонус начисляется после выполнения заказа.

### 📍 Geo — Геопоиск

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/geo/orders-nearby` | Заказы поблизости (Haversine формула) |
| `GET /api/geo/masters-nearby` | Мастера поблизости (алгоритм скоринга) |

**Алгоритм скоринга мастеров:** расстояние (40%) + рейтинг (30%) + завершённые заказы (20%) + бонус новичка (10%)

### 🎓 School — Школа мастеров

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/school/courses` | Список курсов (видео, описание, тесты) |
| `POST /api/school/courses/:id/complete` | Завершить курс |
| `GET /api/school/progress` | Прогресс обучения |

Обязательные курсы для активации мастер-профиля. Курсы привязаны к категориям.

### 🛡️ Guarantees — Гарантии

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/guarantees/my` | Мои гарантии |
| `POST /api/guarantees` | Создать гарантию (конфигурируемый срок) |
| `POST /api/guarantees/:orderId/claim` | Заявка на гарантийный ремонт |

### 🖼️ Portfolio — Портфолио мастеров

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/portfolio/master/:id` | Публичное портфолио |
| `POST /api/portfolio` | Создать элемент |
| `GET /api/portfolio/stats` | Статистика (items, likes, categories) |

### 📷 Photos — Фото до/после

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/photos/order/:orderId` | Фото заказа (before/after) |
| `POST /api/photos/order/:orderId` | Добавить фото |

### ❤️ Favorites — Избранные мастера

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/favorites` | Список избранных |
| `POST /api/favorites/:masterId` | Добавить в избранное |
| `DELETE /api/favorites/:masterId` | Удалить |

### 🎫 Promo — Промо-коды

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/promo/validate` | Проверить промокод |
| `POST /api/promo/apply` | Применить к заказу |
| `GET/POST/PUT/DELETE /api/promo` | CRUD (admin) |

### 🔔 Notifications — Уведомления

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/notifications` | Список уведомлений |
| `GET /api/notifications/unread/count` | Непрочитанные |
| `PUT /api/notifications/:id/read` | Прочитать |
| `PUT /api/notifications/read-all` | Прочитать все |

In-app + Telegram Bot push (sendMessage + sendLocation). Уведомление до 50 мастеров в городе о новом заказе.

### 🛠️ Admin — Панель управления

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/admin/stats` | Dashboard (15+ метрик: пользователи, выручка, top мастера) |
| `GET /api/admin/users` | Все пользователи |
| `PUT /api/admin/users/:id/block` | Блокировка / разблокировка |
| `PUT /api/admin/users/:id/verify` | Верификация мастера |
| `PUT /api/admin/users/:id/role` | Изменение роли (ADMIN only) |
| `GET /api/admin/config` | Конфигурация платформы |
| `PUT /api/admin/config` | Обновить конфигурацию |
| `GET/POST/DELETE /api/admin/blacklist` | Чёрный список |
| `GET/PUT /api/admin/certificates` | Сертификаты мастеров |
| `PUT /api/admin/orders/:id/comment` | Комментарий администрации к заказу |

### 📡 SSE — Real-time обновления заказов

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/orders/:id/events-ticket` | Получить одноразовый SSE-тикет (JWT auth через заголовок) |
| `GET /api/orders/:id/events?ticket=...` | SSE-поток событий заказа (одноразовый тикет) |

**События:**
- `status_changed` — смена статуса заказа
- `master_confirmed` — мастер подтвердил завершение
- `client_confirmed` — клиент подтвердил завершение
- `order_completed` — заказ финализирован, средства переведены
- `master_assigned` — назначен мастер

- **Архитектура:** EventBus (in-memory Map) → SSE через EventSource
- **Аутентификация:** Одноразовый Redis-тикет (30с TTL) вместо JWT в URL — безопаснее, не утекает в логи
- **Auto-reconnect:** автоматическое переподключение через 3 секунды
- **Keepalive:** ping каждые 30 секунд с проверкой `res.writableEnded`

### 📝 Forum — Форум мастеров

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/forum/topics` | Список тем (пагинация) |
| `GET /api/forum/topics/:id` | Тема + ответы |
| `POST /api/forum/topics` | Создание темы (мастера/админы) |
| `POST /api/forum/topics/:id/posts` | Ответ в теме |
| `DELETE /api/forum/topics/:id` | Удаление (автор/админ) |
| `PUT /api/forum/topics/:id/moderate` | Закрепить / заблокировать (админ) |

- **Модерация:** переиспользуется `chatModeration.ts` (40+ regex-правил)
- **Доступ:** создание/ответы — только мастера и админы; чтение — все

---

## 🗄 База данных (37 моделей, 13 enum)

### Основные модели

| Модель | Таблица | Описание | Ключевые поля |
|--------|---------|----------|---------------|
| **User** | `users` | Пользователь | telegramId (BigInt), role, balance, referralCode |
| **UserProfile** | `user_profiles` | Профиль | firstName, lastName, avatar, lat/lng, city |
| **MasterProfile** | `master_profiles` | Мастер | rating, completedOrders, isOnline, hourlyRate, registrationPaid |
| **Certificate** | `certificates` | Сертификат | title, fileUrl, verified |
| **Category** | `categories` | Категория | name (ru/uz/en), slug, icon, самореферентная (parent) |
| **Subcategory** | `subcategories` | Подкатегория | categoryId, name (ru/uz/en), slug |
| **Task** | `tasks` | Задача/услуга | minPrice, estimatedTime (ru/uz/en) |
| **Order** | `orders` | Заказ | 40+ полей: эскроу, комиссия, geo, estimation, AI instant, adminComment |
| **ForumTopic** | `forum_topics` | Тема форума | title, content, authorId, isPinned, isLocked |
| **ForumPost** | `forum_posts` | Ответ на форуме | content, authorId, topicId |
| **OrderTask** | `order_tasks` | Связь заказ ↔ задача | orderId, taskId |
| **OrderResponse** | `order_responses` | Отклик мастера | priceOffer, message, status |
| **Review** | `reviews` | Отзыв | rating (1-5), comment |
| **Payment** | `payments` | Платёж | amount, type, provider, status |
| **BalanceTransaction** | `balance_transactions` | Транзакция баланса | 9 типов, balanceBefore/After |
| **Referral** | `referrals` | Реферал | referrerId → referredId, bonusRate |
| **ChatMessage** | `chat_messages` | Сообщение чата | isFlagged, isBlocked, flagReason |
| **Estimate** | `estimates` | Смета | workItems (JSON), materialItems (JSON), totalAmount |
| **AiOrderTemplate** | `ai_order_templates` | AI-вариант заказа | tier (GOOD/BETTER/BEST), taskIds, materials, estimatedPrice, confidence |
| **Notification** | `notifications` | Уведомление | type, title, message, isRead |
| **SchoolCourse** | `school_courses` | Курс | videoUrl, durationMinutes, isRequired |
| **CourseProgress** | `course_progress` | Прогресс | completed, completedAt |
| **Guarantee** | `guarantees` | Гарантия | durationDays, claimedAt, resolvedAt |
| **PortfolioItem** | `portfolio_items` | Элемент портфолио | title, imageUrl, likesCount |
| **PromoCode** | `promo_codes` | Промо-код | code, discountType, maxUses |
| **FavoriteMaster** | `favorite_masters` | Избранное | clientId, masterId |
| **OrderPhoto** | `order_photos` | Фото до/после | url, type (before/after) |
| **Blacklist** | `blacklist` | Чёрный список | violationType, evidence, penaltyAmount |
| **PlatformConfig** | `platform_config` | Конфигурация | key/value (динамическая) |
| **PartnerStore** | `partner_stores` | Магазин | 23 поля: name, geo, rating, storeCategory |
| **StoreProduct** | `store_products` | Товар | price, unit, inStock |
| **StoreReview** | `store_reviews` | Отзыв о магазине | rating, comment |
| **PartnerRequest** | `partner_requests` | Заявка партнёра | status, adminNote |
| **TurnkeyProject** | `turnkey_projects` | Ремонт под ключ | area, rooms, budget, 7 стадий |
| **TurnkeyStage** | `turnkey_stages` | Этап ремонта | progress (0-100), status |
| **MasterCategory** | `master_categories` | Специализация мастера | masterProfileId, categoryId |

### Enum'ы (13 типов)

| Enum | Значения |
|------|----------|
| **UserRole** | `CLIENT` · `MASTER` · `ADMIN` · `MANAGER` |
| **OrderStatus** | 14 значений: `DRAFT` → `PUBLISHED` → `ACCEPTED` → `IN_TRANSIT` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED` / `DISPUTED` + estimation-статусы |
| **EstimateStatus** | `DRAFT` · `SENT` · `APPROVED` · `REJECTED` · `MODERATION` |
| **AiTier** | `GOOD` · `BETTER` · `BEST` — уровни AI-вариантов ФотоЗаказа |
| **PaymentStatus** | `PENDING` · `PROCESSING` · `COMPLETED` · `FAILED` · `REFUNDED` |
| **PaymentType** | 12 значений: `ORDER_COMMISSION` · `ESCROW_HOLD` · `REGISTRATION_FEE` · `ESTIMATION_FEE` и др. |
| **PaymentProvider** | `CLICK` · `PAYME` · `TELEGRAM_STARS` · `INTERNAL` |
| **TransactionType** | 9 значений: `TOPUP` · `ESCROW_HOLD` · `ESCROW_RELEASE` · `PENALTY` и др. |
| **ResponseStatus** | `PENDING` · `ACCEPTED` · `REJECTED` · `WITHDRAWN` |
| **StoreStatus** | `PENDING` · `ACTIVE` · `REJECTED` · `SUSPENDED` |
| **TurnkeyStatus** | 7 значений: `INQUIRY` → `CONSULTATION` → `DESIGNING` → `APPROVED` → `IN_PROGRESS` → `COMPLETED` |
| **ReferralType** | `MASTER_TO_MASTER` · `CLIENT_TO_CLIENT` |
| **ReferralStatus** | `PENDING` · `ACTIVE` · `PAID` |

### Индексы

Все таблицы имеют составные unique constraints и индексы для оптимизации запросов:
- 9 составных `@@unique` (orderId+masterId, clientId+masterId, userId+courseId и др.)
- 12 `@unique` полей (telegramId, slug, referralCode, code и др.)
- 30+ `@@index` по часто запрашиваемым полям (status, city, createdAt, categoryId)

---

## 🖥 Фронтенд (41 страница, 35 компонентов)

### Маршруты (33 маршрута)

#### Публичные страницы
| Путь | Страница | Описание |
|------|----------|----------|
| `/` | HomePage | Главная: CTA, категории, преимущества, блок оценки |
| `/login` | LoginPage | Telegram Login Widget |
| `/catalog/:slug` | CatalogPage | Каталог категории |
| `/catalog/:catSlug/:subSlug` | SubcategoryPage | Подкатегория + задачи |
| `/orders` | OrdersListPage | Список заказов |
| `/orders/:id` | OrderDetailPage | Детали + чат + фото + блок оценки |
| `/masters` | MasterSearchPage | Поиск мастеров |
| `/masters/:id` | MasterProfilePage | Профиль мастера + портфолио |
| `/stores` | StoresPage | Магазины стройматериалов |
| `/stores/:id` | StoreProfilePage | Профиль магазина + товары |
| `/turnkey` | TurnkeyPage | Ремонт под ключ |
| `/map` | MapPage | Карта заказов |
| `/about` | AboutPage | О платформе |
| `/help` | HelpSupportPage | Поддержка |
| `/cart` | CartPage | Корзина услуг |
| `/forum` | ForumPage | Форум мастеров — список тем |
| `/forum/:id` | ForumTopicPage | Тема + ответы |

#### Защищённые страницы (требуют авторизации)
| Путь | Страница | Описание |
|------|----------|----------|
| `/create-order` | CreateOrderPage | Создание заказа |
| `/my-orders` | MyOrdersPage | Мои заказы |
| `/profile` | ProfilePage | Профиль |
| `/profile/settings` | ProfileSettingsPage | Настройки |
| `/balance` | BalancePage | Кошелёк + история |
| `/favorites` | FavoritesPage | Избранные мастера |
| `/notifications` | NotificationsPage | Уведомления |
| `/school` | SchoolPage | Школа мастеров |
| `/estimation/create` | CreateEstimationPage | Заказ оценки |
| `/instant-order` | InstantOrderPage | 📸 ФотоЗаказ за 30 сек (AI) |
| `/reviews/new` | ReviewFormPage | Написать отзыв |
| `/payment-history` | PaymentHistoryPage | История платежей |

#### Страницы мастеров
| Путь | Страница | Описание |
|------|----------|----------|
| `/master/dashboard` | MasterDashboardPage | Панель мастера |
| `/master/portfolio` | MasterPortfolioPage | Управление портфолио |
| `/estimation/:id/form` | EstimateFormPage | Составление сметы |
| `/estimation/:id/view` | EstimateViewPage | Просмотр сметы |

#### Админ-панель
| Путь | Страница | Описание |
|------|----------|----------|
| `/admin` | AdminDashboardPage | 10 вкладок: обзор, пользователи, заказы, платежи, каталог, магазины, ремонт под ключ, модерация, конфигурация |

### Состояние (Zustand, 3 стора)

| Стор | Описание | Persist |
|------|----------|--------|
| **useAuthStore** | user, tokens, isAuthenticated, login/logout/refresh | ✅ localStorage |
| **useAppStore** | categories, geolocation, isTelegram, selectedCategory | ❌ |
| **useCartStore** | items[], add/remove, totals, commission calculation | ✅ localStorage |

### Кастомные хуки (8 хуков)

| Хук | Описание |
|-----|----------|
| `useTelegramApp` | Интеграция Telegram Mini App: initData, haptic, MainButton, BackButton, closingConfirmation |
| `useGeolocation` | Запрос GPS, lat/lng, loading/error |
| `useInitApp` | Восстановление JWT, preload каталога |
| `useFormatPrice` | Форматирование `123 456 UZS` с учётом языка |
| `useTheme` | light / dark / system, localStorage, CSS class `.dark` |
| `useDebounce` | Дебаунс значения |
| `useScrollProgress` | Прогресс скролла (0–1) |
| `useMasterOnlineStatus` | Heartbeat 30сек, offline при закрытии, visibilitychange |
| `useOrderEvents` | SSE-подписка на события заказа (EventSource + auto-reconnect) |

### Ключевые компоненты (35 компонентов)

| Компонент | Описание |
|-----------|----------|
| `Layout` | Header (адаптивный, бургер-меню, TG spacer) + Footer |
| `OrderChat` | Поллинг каждые 5сек, модерация, блокированные сообщения |
| `MasterCard` | Карточка мастера: рейтинг, город, специализации |
| `OrderCard` | Карточка заказа: статус, цена, категория |
| `SearchOverlay` | Глобальный поиск (Ctrl+K / Cmd+K) |
| `NotificationBell` | Колокольчик непрочитанных |
| `LanguageSwitcher` | Переключатель 🇷🇺/🇺🇿/🇬🇧 |
| `ThemeToggle` | Тёмная/светлая/системная тема |
| `ImageUpload` | Загрузка изображений |
| `GuaranteeWidget` | Виджет гарантии на странице заказа |
| `CommissionPaymentModal` | Модал оплаты комиссии |
| `InstallPrompt` | PWA-промпт установки |
| `OfflineIndicator` | Индикатор оффлайна |
| `CookieConsent` | Баннер согласия на cookie |
| `ErrorBoundary` | Отлов ошибок React |
| `PageSkeletons` | Скелетоны загрузки |

### i18n — Мультиязычность

| Язык | Файл | Примечание |
|------|------|------------|
| 🇷🇺 Русский | `i18n/ru.ts` | Основной (по умолчанию) |
| 🇺🇿 O'zbekcha | `i18n/uz.ts` | Узбекский |
| 🇬🇧 English | `i18n/en.ts` | Английский |

~1300+ ключей перевода на каждый язык. 45 секций: nav, home, auth, orders, catalog, master, admin, chat, estimation, turnkey, stores, school, balance, portfolio, guarantees, promo и др.

### Особенности фронтенда

| Фича | Реализация |
|------|------------|
| **PWA** | manifest.json + service worker, промпт установки |
| **Telegram Mini App** | Полная интеграция: initData, HapticFeedback, MainButton/BackButton, тема, viewport |
| **Тёмная тема** | system / light / dark — CSS `.dark` класс + Tailwind dark: |
| **Code splitting** | Lazy-loaded страницы, 3 vendor-чанка (react, query, icons) |
| **Оффлайн** | OfflineIndicator, ServiceWorker cache |
| **Глобальный поиск** | Ctrl+K / Cmd+K → SearchOverlay |
| **Real-time чат** | Поллинг каждые 5 сек |
| **Онлайн-статус** | Heartbeat 30 сек + visibilitychange + beforeunload |
| **Cookie consent** | GDPR-баннер |
| **Auto JWT refresh** | Axios interceptor с очередью запросов |

---

## 🔌 Внешние интеграции

| Сервис | Использование |
|--------|--------------|
| **Telegram Bot API** | Push-уведомления (sendMessage + sendLocation, HTML-формат), рассылка мастерам |
| **Telegram Login Widget** | Авторизация на веб-сайте (HMAC-SHA256) |
| **Telegram Mini App** | Авторизация через WebAppData, HapticFeedback, MainButton, viewport, тема |
| **Telegram Stars** | Оплата через Stars |
| **Click** | Платёжная система Узбекистана: генерация URL + webhook (MD5 подпись) |
| **Payme** | Платёжная система Узбекистана: JSON-RPC (CheckPerform, Create, Perform, Cancel) |
| **Yandex Maps API** | Геокодинг, карты |
| **Railway** | Hosting + Managed PostgreSQL + Redis |
| **GitHub Actions** | CI/CD пайплайн |
| **GHCR** | Docker-образы (ghcr.io) |
| **Let's Encrypt** | SSL-сертификаты (VPS) |

---

## 🚀 Инфраструктура и деплой

### Два режима деплоя

#### 1. Railway (Docker) — основной продакшен

```
Railway Project
├── Backend service (Docker, Node.js + Express, persistent volume)
├── Frontend service (Nginx статика)
├── PostgreSQL 16 (managed)
└── Redis 7 (managed)
```

#### 2. Docker + VPS (Self-hosted)

```
docker-compose.prod.yml → 6 сервисов
├── PostgreSQL 16 (scram-sha-256, 512MB)
├── Redis 7 (requirepass, 128MB)
├── Backend (Express, 512MB)
├── Frontend (Nginx SPA)
├── Nginx (reverse proxy, SSL 443+80)
└── Certbot (авто-обновление SSL каждые 12ч)
```

### CI/CD Pipeline (GitHub Actions)

```
Push/PR → main
  ├── 🧪 Test
  │   ├── PostgreSQL 16 + Redis 7 (GitHub Services)
  │   ├── npm ci → prisma generate → migrate deploy → seed
  │   ├── vitest run (backend)
  │   └── tsc --noEmit (backend + frontend)
  │
  ├── 🏗️ Build (только push main)
  │   ├── Docker build backend + frontend
  │   └── Push → ghcr.io/owner/masteruz-*:latest
  │
  └── 🚀 Deploy (SSH)
      ├── git pull → docker compose pull → up -d
      ├── prisma migrate deploy
      └── docker image prune
```

### Скрипты сервера

| Скрипт | Назначение |
|--------|------------|
| `scripts/server-setup.sh` | Настройка VPS: Docker, UFW (22/80/443), fail2ban, генерация секретов |
| `scripts/deploy-init.sh` | Первый деплой: SSL через certbot, запуск всех сервисов, миграции, seed |
| `scripts/backup.sh` | pg_dump → gzip, ротация 7 дней, рекомендуемый cron 03:00 |

### Nginx (VPS)

- HTTP → HTTPS redirect (301)
- SSL: TLSv1.2 + TLSv1.3, HSTS 1 год
- Gzip level 6 (text, JS, JSON, SVG, WOFF2)
- Security headers: X-Frame-Options, CSP, X-XSS-Protection
- CSP: разрешает `telegram.org` (scripts, frames)
- Кеш uploads: 30 дней, immutable
- `server_tokens off`

---

## 🚀 PRODUCTION CHECKLIST — точные шаги запуска

> Точный порядок действий для запуска MasterUz в продакшен на VPS. Минимальные требования: Ubuntu 22.04 LTS, 4 vCPU, 8 GB RAM, 80 GB SSD NVMe.

---

### Этап 0 — Подготовка (до сервера)

**0.1 Регистрация внешних сервисов:**

| Сервис | Что получить | Где |
|--------|-------------|-----|
| **Домен** | masteruz.uz или ваш домен | reg.uz, nic.uz |
| **Telegram Bot** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | @BotFather → /newbot |
| **Click** | `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY` | merchant.click.uz |
| **Payme** | `PAYME_MERCHANT_ID`, `PAYME_MERCHANT_KEY` | merchant.payme.uz |
| **Yandex Maps** | `YANDEX_MAPS_API_KEY` | developer.tech.yandex.ru |

**0.2 Настройка Telegram Bot:**
```bash
# В @BotFather:
/setdomain → masteruz.uz     # для Login Widget
/setmenubutton               # для Mini App кнопки
/setdescription              # описание бота

# Убедитесь что домен верифицирован в BotFather для Web Apps
```

**0.3 Подготовка репозитория:**
```bash
git clone https://github.com/dex89666/masteruz.git
cd masteruz

# Проверить что все миграции актуальны
ls backend/prisma/migrations/
```

---

### Этап 1 — Настройка VPS

**1.1 Купить VPS:**
- Провайдеры: DigitalOcean, Hetzner, IHOR (для Узбекистана), Linode
- Минимум: Ubuntu 22.04, 4 vCPU, 8 GB RAM, 80 GB SSD
- **Важно:** Включить IPv4 static IP

**1.2 DNS-настройка:**
```dns
A    masteruz.uz          →  <VPS_IP>
A    www.masteruz.uz      →  <VPS_IP>

# Если используете Cloudflare (рекомендуется):
# Установить тип записи "Proxied" (оранжевое облачко)
# Это скроет реальный IP и обеспечит DDoS-защиту L3/L4
```

**1.3 Первоначальная настройка сервера:**
```bash
# Подключиться по SSH
ssh root@<VPS_IP>

# Клонировать репозиторий
git clone https://github.com/dex89666/masteruz.git /opt/masteruz
cd /opt/masteruz

# Запустить скрипт настройки сервера
bash scripts/server-setup.sh
```

Скрипт автоматически выполнит:
- `apt update && upgrade`
- Установку Docker + Docker Compose v2
- Установку `git`, `curl`, `ufw`, `fail2ban`
- Настройку UFW (deny all → allow 22/80/443)
- Клонирование репозитория
- Генерацию секретов (`openssl rand -hex 32`)

---

### Этап 2 — Переменные окружения

**2.1 Создать `.env.production`:**
```bash
cp .env.production.example .env.production
nano /opt/masteruz/.env.production
```

**2.2 Заполнить обязательные переменные:**
```env
# === ОБЯЗАТЕЛЬНЫЕ ===

# Домен (без https://)
DOMAIN=masteruz.uz

# База данных
DB_PASSWORD=<сгенерировано_скриптом>

# Redis
REDIS_PASSWORD=<сгенерировано_скриптом>

# JWT (сгенерированы скриптом setup)
JWT_SECRET=<сгенерировано_скриптом>
JWT_REFRESH_SECRET=<сгенерировано_скриптом>

# Telegram (получить от @BotFather)
TELEGRAM_BOT_TOKEN=<токен_бота>
TELEGRAM_BOT_USERNAME=YourBotName

# Суперадмин (ваш Telegram username без @)
SUPER_ADMIN_USERNAMES=yourusername,otheradmin

# Платежи (Click)
CLICK_MERCHANT_ID=<id>
CLICK_SERVICE_ID=<id>
CLICK_SECRET_KEY=<ключ>

# Платежи (Payme)
PAYME_MERCHANT_ID=<id>
PAYME_MERCHANT_KEY=<ключ>

# Карты (Yandex)
YANDEX_MAPS_API_KEY=<ключ>

# === ОПЦИОНАЛЬНЫЕ ===

# Telegram chat для уведомлений администратору (получить через @userinfobot)
ADMIN_TELEGRAM_CHAT_ID=-1001234567890

LOG_LEVEL=warn
MAX_FILE_SIZE=5242880
```

**2.3 Проверить корректность `.env.production`:**
```bash
# Убедиться что нет незаполненных placeholder'ов
grep -n "СГЕНЕРИРУЙ\|your_\|<" /opt/masteruz/.env.production
# Вывод должен быть пустым
```

---

### Этап 3 — Первый деплой

**3.1 Запустить скрипт первого деплоя:**
```bash
cd /opt/masteruz
bash scripts/deploy-init.sh
```

Скрипт автоматически выполнит:
1. Создание директорий SSL (`certbot/conf`, `certbot/www`)
2. Запуск сервисов в HTTP-режиме (без SSL)
3. Получение SSL-сертификата через Let's Encrypt (certbot)
4. Переключение на HTTPS-конфиг с вашим доменом
5. Рестарт Nginx с SSL
6. Выполнение миграций БД: `prisma migrate deploy`
7. Seed начальных данных: `prisma/seed.ts` (15 категорий, 55+ подкатегорий, 200+ задач)
8. Health check: `https://{DOMAIN}/api/health`

**3.2 Проверить статус сервисов:**
```bash
cd /opt/masteruz
docker compose -f docker-compose.prod.yml ps

# Все 6 сервисов должны быть в состоянии "running":
# masteruz-postgres    → healthy
# masteruz-redis       → healthy
# masteruz-backend     → running
# masteruz-frontend    → running
# masteruz-nginx       → running
# masteruz-certbot     → exited (0) — нормально после получения SSL
```

**3.3 Проверить логи:**
```bash
# API
docker compose -f docker-compose.prod.yml logs backend --tail=50

# Nginx
docker compose -f docker-compose.prod.yml logs nginx --tail=50

# БД
docker compose -f docker-compose.prod.yml logs postgres --tail=30
```

---

### Этап 4 — Создание суперадмина

```bash
# Запустить скрипт создания суперадмина
docker compose -f docker-compose.prod.yml exec backend \
  npx tsx scripts/make-admin.ts <TELEGRAM_USERNAME>

# Или через Prisma Studio (только для dev!)
# npx prisma studio
```

> Также можно указать Telegram username в `SUPER_ADMIN_USERNAMES` в `.env.production` — тогда этот пользователь автоматически получит права при первом входе.

---

### Этап 5 — Настройка платёжных систем

**5.1 Click — настройка webhook:**
```
В личном кабинете Click:
Merchant → Services → Ваш сервис → Webhook URL:
https://masteruz.uz/api/payments/click-webhook
```

**5.2 Payme — настройка webhook:**
```
В личном кабинете Payme:
Merchant → Settings → Callback URL:
https://masteruz.uz/api/payments/payme-webhook
```

**5.3 Проверить webhooks:**
```bash
# Click — test transaction через их sandbox
# Payme — test через TestMode

# Проверяем логи:
docker compose -f docker-compose.prod.yml logs backend | grep -i "payment\|click\|payme"
```

---

### Этап 6 — Настройка CI/CD (GitHub Actions)

**6.1 Добавить GitHub Secrets:**
```
В репозитории: Settings → Secrets and variables → Actions

SERVER_HOST = <IP_VPS>
SERVER_USER = root
SERVER_SSH_KEY = <содержимое ~/.ssh/id_rsa>
```

**6.2 Сгенерировать SSH-ключ для деплоя (если нужно):**
```bash
# На локальной машине:
ssh-keygen -t ed25519 -C "deploy@masteruz" -f ~/.ssh/masteruz_deploy

# Скопировать публичный ключ на сервер:
ssh-copy-id -i ~/.ssh/masteruz_deploy.pub root@<VPS_IP>

# Добавить в GitHub Secret SERVER_SSH_KEY:
cat ~/.ssh/masteruz_deploy
```

**6.3 Проверить CI/CD пайплайн:**
```bash
git tag v1.0.0 && git push origin v1.0.0
# Наблюдать в: GitHub → Actions → Deploy workflow
```

---

### Этап 7 — Бэкапы и мониторинг

**7.1 Настроить автоматические бэкапы БД:**
```bash
# Добавить в crontab (crontab -e):
0 3 * * * /opt/masteruz/scripts/backup.sh >> /var/log/masteruz-backup.log 2>&1

# Проверить скрипт бэкапа:
bash /opt/masteruz/scripts/backup.sh
ls -la /opt/masteruz/backups/  # должен появиться .sql.gz файл
```

**7.2 Настроить cron для обновления SSL:**
```bash
# Certbot auto-renewal (уже настроен в docker-compose.prod.yml как cron)
# Проверить вручную:
docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run
```

**7.3 Базовый мониторинг (minimalный setup):**
```bash
# Healthcheck endpoint:
curl https://masteruz.uz/api/health

# Uptime мониторинг (бесплатно):
# https://uptimerobot.com — мониторинг каждые 5 мин + Telegram алерт

# Логи в реальном времени:
docker compose -f docker-compose.prod.yml logs -f backend
```

---

### Этап 8 — Дополнительные улучшения безопасности (рекомендуется)

**8.1 Cloudflare (настоятельно рекомендуется):**
```
1. Зарегистрироваться на cloudflare.com
2. Добавить домен masteruz.uz
3. Изменить NS-серверы у регистратора на Cloudflare
4. Настроить DNS A-записи в Cloudflare (Proxied — оранжевое облачко)
5. Включить: Security → Bot Fight Mode
6. Включить: SSL/TLS → Full (strict)
7. Настроить: Firewall Rules → Rate Limiting (если Pro план)
```

Преимущества Cloudflare Free:
- L3/L4 DDoS защита (volumetric attacks)
- Скрытие реального IP сервера
- CDN кеш для статики
- Bot Fight Mode
- Automatic HTTPS

**8.2 Redis-backed rate limiter (при горизонтальном масштабировании):**
```bash
cd backend && npm install rate-limit-redis
# Заменить MemoryStore на RedisStore в app.ts
```

**8.3 Nginx connection limiting (добавить в `nginx/nginx.conf`):**
```nginx
# В секцию http {}:
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_conn_zone $binary_remote_addr zone=addr:10m;
```

---

### Этап 9 — Финальная проверка перед открытием

```bash
# 1. HTTPS работает
curl -I https://masteruz.uz
# ← HTTP/2 200

# 2. API Health check
curl https://masteruz.uz/api/health
# ← {"status":"ok","db":"connected","redis":"connected"}

# 3. Rate limiting работает
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" https://masteruz.uz/api/auth/me; done
# ← первые 10 = 401, после 10 = 429

# 4. SSL A+ рейтинг
# Открыть: https://www.ssllabs.com/ssltest/analyze.html?d=masteruz.uz

# 5. Security headers
curl -I https://masteruz.uz | grep -i "strict-transport\|x-frame\|content-security"

# 6. Авторизация через Telegram
# Открыть https://masteruz.uz, войти через Telegram

# 7. Создать тестовый заказ
# Убедиться что эскроу работает, уведомления отправляются

# 8. Проверить платёжные webhook'и
# Click sandbox + Payme TestMode

# 9. Admin панель
# https://masteruz.uz/admin → войти как суперадмин
```

### Чеклист «готово к открытию»

- [ ] HTTPS работает, redirect с HTTP
- [ ] SSL рейтинг A+ на ssllabs.com
- [ ] Health check `/api/health` возвращает `{"status":"ok"}`
- [ ] Telegram авторизация работает (Web + Mini App)
- [ ] Каталог загружен (категории, подкатегории, задачи)
- [ ] Создание заказа — работает с эскроу
- [ ] Click webhook — тест транзакция прошла
- [ ] Payme webhook — тест транзакция прошла
- [ ] Push-уведомления в Telegram — мастера получают
- [ ] Admin панель — суперадмин может войти
- [ ] Резервное копирование — cron настроен
- [ ] SSL auto-renewal — certbot cron настроен
- [ ] Uptime мониторинг (UptimeRobot) — настроен
- [ ] Cloudflare DNS — Proxied (рекомендуется)

---

## 🏁 Быстрый старт (разработка)

### Предварительные требования
- Node.js 20+
- PostgreSQL 15+ (или Docker)
- Redis 7+ (или Docker, или in-memory для dev)

### Запуск через Docker (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/dex89666/masteruz.git
cd masteruz

# Скопируйте env-файлы
cp .env.example .env

# Отредактируйте .env — укажите:
# TELEGRAM_BOT_TOKEN, JWT_SECRET, JWT_REFRESH_SECRET

# Запустите
docker-compose up -d

# Заполнение начальных данных
docker exec masteruz-backend npx prisma db seed
```

### Запуск вручную

```bash
# 1. БД и кеш
docker-compose up -d postgres redis

# 2. Backend
cd backend
cp .env.example .env    # DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
npm install
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev              # → http://localhost:3001/api

# 3. Frontend (новый терминал)
cd frontend
npm install
npm run dev              # → http://localhost:5173
```

### Доступ

| Ресурс | URL |
|--------|-----|
| Фронтенд | http://localhost:5173 |
| API | http://localhost:3001/api |
| Health check | http://localhost:3001/api/health |
| Админ-панель | http://localhost:5173/admin |

---

## 📁 Структура проекта

```
MasterUz/
├── backend/                     # Серверная часть
│   ├── prisma/
│   │   ├── schema.prisma        # 35 моделей, 13 enum
│   │   ├── migrations/          # 3 миграции (init + estimation + instant-photo-order)
│   │   └── seed.ts              # Начальные данные
│   ├── src/
│   │   ├── app.ts               # Express entry: routes, middleware, CORS
│   │   ├── config/
│   │   │   ├── database.ts      # Prisma singleton
│   │   │   ├── redis.ts         # ioredis / in-memory
│   │   │   └── index.ts         # Все переменные окружения
│   │   ├── middleware/
│   │   │   ├── auth.ts          # JWT authenticate, authorize, optionalAuth
│   │   │   ├── errorHandler.ts  # ApiError, Zod, Prisma ошибки
│   │   │   ├── upload.ts        # Multer (disk/memory)
│   │   │   └── validate.ts      # Zod body/query/params
│   │   ├── modules/             # 22 бизнес-модуля
│   │   │   ├── auth/            # Telegram Login + Mini App + JWT
│   │   │   ├── users/           # Профили, мастера, сертификаты
│   │   │   ├── orders/          # Заказы, эскроу, споры
│   │   │   ├── payments/        # Click, Payme, Telegram Stars
│   │   │   ├── balance/         # Кошелёк, транзакции
│   │   │   ├── estimation/      # Оценка, сметы, модерация
│   │   │   ├── instant-order/   # ФотоЗаказ за 30 сек (AI)
│   │   │   ├── catalog/         # Категории, подкатегории, задачи
│   │   │   ├── chat/            # Сообщения + авто-модерация
│   │   │   ├── ratings/         # Отзывы (1-5)
│   │   │   ├── referrals/       # Реферальная система
│   │   │   ├── geo/             # Геопоиск, скоринг мастеров
│   │   │   ├── school/          # Курсы, прогресс
│   │   │   ├── admin/           # Dashboard, управление
│   │   │   ├── stores/          # Партнёрские магазины
│   │   │   ├── turnkey/         # Ремонт под ключ
│   │   │   ├── notifications/   # In-app + Telegram push
│   │   │   ├── photos/          # Фото до/после
│   │   │   ├── favorites/       # Избранные мастера
│   │   │   ├── promo/           # Промо-коды
│   │   │   ├── guarantees/      # Гарантии
│   │   │   └── portfolio/       # Портфолио мастеров
│   │   ├── services/
│   │   │   └── notificationService.ts  # Push через Telegram Bot
│   │   └── utils/
│   │       ├── telegram.ts      # HMAC верификация
│   │       ├── telegramBot.ts   # Bot API (sendMessage, sendLocation)
│   │       ├── logger.ts        # Pino JSON logger
│   │       ├── helpers.ts       # Haversine, pagination, commission
│   │       └── ApiError.ts      # Custom error classes
│   ├── tests/                   # Vitest тесты
│   ├── Dockerfile               # Production Docker image
│   └── package.json
├── frontend/                    # Клиентская часть
│   ├── src/
│   │   ├── main.tsx             # React entry + QueryClient
│   │   ├── App.tsx              # 33 маршрута, lazy loading
│   │   ├── api/
│   │   │   └── client.ts        # 142 API-метода, JWT interceptor
│   │   ├── components/          # 35 UI-компонентов
│   │   ├── pages/               # 39 страниц
│   │   ├── hooks/
│   │   │   └── index.ts         # 8 кастомных хуков
│   │   ├── store/
│   │   │   ├── index.ts         # Auth + App сторы (Zustand)
│   │   │   └── cartStore.ts     # Корзина услуг
│   │   ├── i18n/                # 3 языка × 1300+ ключей
│   │   │   ├── ru.ts            # Русский
│   │   │   ├── uz.ts            # Узбекский
│   │   │   └── en.ts            # Английский
│   │   └── types/
│   │       └── index.ts         # ~685 строк TypeScript типов
│   ├── public/                  # PWA manifest, SW, иконки
│   ├── Dockerfile               # Nginx SPA
│   ├── vite.config.ts           # Code splitting, proxy
│   ├── tailwind.config.js       # Кастомные цвета, тёмная тема
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md          # Техническая архитектура
│   ├── PRIVACY_POLICY.md        # Политика конфиденциальности
│   └── PUBLIC_OFFER.md          # Публичная оферта
├── scripts/
│   ├── server-setup.sh          # Настройка VPS
│   ├── deploy-init.sh           # Первый деплой + SSL
│   └── backup.sh               # Бэкап БД (pg_dump + ротация)
├── nginx/
│   ├── nginx.conf               # Главный конфиг
│   └── conf.d/                  # SSL, reverse proxy
├── shared/
│   └── services-catalog.ts      # Общий каталог услуг
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD: test → build → deploy
├── docker-compose.yml           # Dev: postgres + redis + backend + frontend
├── docker-compose.prod.yml      # Prod: + nginx + certbot + SSL
├── DEPLOY.md                    # Инструкция деплоя (VPS / Railway)
└── README.md                    # Этот файл
```

---

## 🔐 Переменные окружения

### Обязательные

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для access token |
| `JWT_REFRESH_SECRET` | Секрет для refresh token |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_BOT_USERNAME` | Username бота (без @) |
| `CORS_ORIGIN` | Разрешённые origins |
| `SUPER_ADMIN_USERNAMES` | Telegram-username суперадминов через запятую |
| `CLICK_MERCHANT_ID` | ID мерчанта Click |
| `CLICK_SERVICE_ID` | ID сервиса Click |
| `CLICK_SECRET_KEY` | Секрет Click |
| `PAYME_MERCHANT_ID` | ID мерчанта Payme |
| `PAYME_MERCHANT_KEY` | Секрет Payme |

### Опциональные

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT` | `3000` | Порт бэкенда |
| `NODE_ENV` | `production` | Окружение |
| `JWT_EXPIRES_IN` | `7d` | Срок access token |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Срок refresh token |
| `REDIS_URL` | — | Redis (ioredis URL) |
| `REDIS_PASSWORD` | — | Пароль Redis (prod) |
| `YANDEX_MAPS_API_KEY` | — | Yandex Maps |
| `UPLOAD_DIR` | `/app/uploads` | Директория загрузок |
| `MAX_FILE_SIZE` | `5242880` | Макс. размер файла (5MB) |
| `LOG_LEVEL` | `info` | Уровень логов |
| `MASTER_REGISTRATION_FEE` | `400000` | Регистрационный взнос мастера (тийины) |
| `ADMIN_TELEGRAM_CHAT_ID` | — | Chat ID для уведомлений администратору |
| `VITE_API_URL` | `/api` | API URL для фронтенда |

### CI/CD секреты (GitHub)

| Секрет | Описание |
|--------|----------|
| `SERVER_HOST` | IP/домен VPS |
| `SERVER_USER` | SSH пользователь |
| `SERVER_SSH_KEY` | SSH приватный ключ |

---

## 📊 Статистика проекта

| Метрика | Значение |
|---------|----------|
| Бэкенд-модулей | **24** |
| API-эндпоинтов | **120+** |
| Frontend API-методов | **150+** |
| Моделей БД (Prisma) | **37** |
| Enum'ов | **13** |
| Страниц фронтенда | **41** |
| UI-компонентов | **35** |
| Маршрутов | **35** |
| Кастомных хуков | **9** |
| Языков i18n | **3** (ru/uz/en, ~1300+ ключей) |
| Категорий каталога | **15** |
| Подкатегорий | **55+** |
| Задач/услуг | **200+** |
| Docker-сервисов (prod) | **6** |
| Rate limit уровней | **6** |
| Regex-правил чат-модерации | **40+** |
| CI/CD job'ов | **3** (test → build → deploy) |
| Оценка безопасности | **7/10** → после Cloudflare+Redis RL: **9/10** |

---

## 📄 Лицензия

Проприетарное ПО. Все права защищены. © 2024–2026 MasterUz
Last auto-deploy test: 2026-05-13 18:05:58 UTC
