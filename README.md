# 🔧 MasterUz — Платформа бытовых и строительных услуг

> Полнофункциональная экосистема-посредник для соединения клиентов с мастерами ремонтно-строительных услуг в Узбекистане. Включает веб-приложение, Telegram Mini App, админ-панель, эскроу-платежи, систему оценки, партнёрские магазины и ремонт под ключ.

**Продакшен:** [masteruz-ecru.vercel.app](https://masteruz-ecru.vercel.app) · **Telegram Bot:** [@Handymanuzbot](https://t.me/Handymanuzbot)

---

## 📋 Содержание

- [Обзор платформы](#-обзор-платформы)
- [Архитектура](#-архитектура)
- [Технологический стек](#-технологический-стек)
- [Модули бэкенда (22 модуля, 110+ API)](#-модули-бэкенда-22-модуля-110-api)
- [База данных (35 моделей, 13 enum)](#-база-данных-35-моделей-13-enum)
- [Фронтенд (39 страниц, 35 компонентов)](#-фронтенд-39-страниц-35-компонентов)
- [Безопасность](#-безопасность)
- [Внешние интеграции](#-внешние-интеграции)
- [Инфраструктура и деплой](#-инфраструктура-и-деплой)
- [Быстрый старт](#-быстрый-старт)
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
- 📸 **ФотоЗаказ за 30 секунд (AI)** — загрузка фото + голос/текст → AI-анализ → 3 варианта (Good/Better/Best) → мгновенное создание заказа
- 📊 **Система оценки (Estimation)** — выезд мастера на осмотр → составление сметы → модерация → создание заказа
- 🏗️ **Ремонт под ключ (Turnkey)** — комплексные проекты с этапами, калькулятором, дизайн-проектом
- 🏪 **Партнёрские магазины** — маркетплейс стройматериалов со скидками для мастеров
- 🎓 **Школа мастеров** — обучающие курсы, сертификация, обязательные курсы для активации
- 💬 **Чат с авто-модерацией** — 40+ regex-правил, фильтрация контактов, мата, обхода комиссии
- 🛡️ **Гарантия** — конфигурируемый гарантийный срок после завершения заказа
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
│  Vercel Edge / Nginx Reverse Proxy (SSL, Gzip, Rate Limit)  │
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
│ (Neon / 16)  │ │(Upstash/  │  │ (Disk / Vercel Blob)│
│ Prisma ORM   │ │ ioredis)  │  │                     │
│ 35 моделей   │ │ JWT revoke│  │ JPEG/PNG/WebP/PDF   │
│ 12 enum      │ │ + cache   │  │ до 5MB × 5 файлов   │
└──────────────┘ └───────────┘  └─────────────────────┘
```

---

## 🛠 Технологический стек

### Backend

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **Node.js** | 20+ | Runtime |
| **Express** | 4.18 | HTTP-фреймворк |
| **TypeScript** | 5.3 | Типизация |
| **Prisma ORM** | 5.10 | ORM + миграции + seed |
| **PostgreSQL** | 15/16 | Основная БД |
| **Redis** | 7 | Кеш + JWT blacklist (Upstash REST / ioredis TCP / in-memory) |
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
| **Vercel** | Основной продакшен-деплой (Serverless) |
| **Docker + Docker Compose** | Альтернативный деплой (VPS) |
| **Nginx** | Reverse proxy + SSL (VPS) |
| **Let's Encrypt + Certbot** | SSL-сертификаты (VPS) |
| **GitHub Actions** | CI/CD: тесты → Docker build → деплой |
| **Neon PostgreSQL** | Serverless PostgreSQL (Vercel) |
| **Upstash Redis** | Serverless Redis (Vercel) |

---

## 📦 Модули бэкенда (22 модуля, 110+ API)

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

---

## 🗄 База данных (35 моделей, 13 enum)

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
| **Order** | `orders` | Заказ | 40+ полей: эскроу, комиссия, geo, estimation, AI instant |
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

## 🖥 Фронтенд (39 страниц, 35 компонентов)

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

## 🔒 Безопасность

| Функция | Описание |
|---------|----------|
| **Helmet** | Защитные HTTP-заголовки (XSS, CSP, HSTS) |
| **CORS** | Конфигурируемые origins, credentials |
| **CSP** | frame-ancestors для Telegram Mini App (`web.telegram.org`) |
| **JWT** | Access 7d + Refresh 30d, отзыв через Redis blacklist |
| **Telegram HMAC** | SHA-256 верификация Login Widget + WebAppData |
| **Rate Limiting** | 4 уровня: глобальный (200/15мин), auth (10/15мин), заказы (20/час), партнёры (3/час) |
| **Zod** | Валидация всех входных данных |
| **Чат-модерация** | 40+ regex-правил (обход комиссии, контакты, мат рус/узб) |
| **Контактная изоляция** | Телефон/email скрыты до оплаты комиссии |
| **Эскроу** | Средства блокируются — защита от неоплаты |
| **Штрафы** | 0/20 000/30 000 сум при отмене в зависимости от статуса |
| **Ограничение новичков** | Мастера < 5 заказов: макс 70% от цены |
| **Чёрный список** | Блокировка с доказательствами, гео, типом нарушения |
| **Click webhook** | MD5-подпись |
| **Payme webhook** | JSON-RPC протокол |
| **Загрузка файлов** | 5MB лимит, только JPEG/PNG/WebP/PDF, макс 5 файлов |
| **Body limit** | 10MB для JSON |
| **BigInt safety** | JSON-сериализация для Telegram ID |

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
| **Neon PostgreSQL** | Serverless PostgreSQL для Vercel |
| **Upstash Redis** | Serverless Redis для Vercel (REST API) |
| **Vercel Blob** | Загрузка файлов в serverless |
| **GitHub Actions** | CI/CD пайплайн |
| **GHCR** | Docker-образы (ghcr.io) |
| **Let's Encrypt** | SSL-сертификаты (VPS) |

---

## 🚀 Инфраструктура и деплой

### Два режима деплоя

#### 1. Vercel (Serverless) — основной продакшен

```
vercel.json → api/index.ts (serverless function)
├── Frontend: статика из frontend/dist
├── Backend: Express в serverless function (maxDuration: 30s)
├── БД: Neon PostgreSQL (serverless)
├── Redis: Upstash (REST API)
└── Файлы: Vercel Blob
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

## 🏁 Быстрый старт

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
├── api/                         # Vercel serverless entry
│   └── index.ts                 # Express → serverless adapter
├── backend/                     # Серверная часть
│   ├── prisma/
│   │   ├── schema.prisma        # 35 моделей, 13 enum
│   │   ├── migrations/          # 3 миграции (init + estimation + instant-photo-order)
│   │   └── seed.ts              # Начальные данные
│   ├── src/
│   │   ├── app.ts               # Express entry: routes, middleware, CORS
│   │   ├── config/
│   │   │   ├── database.ts      # Prisma singleton + Neon adapter
│   │   │   ├── redis.ts         # Upstash REST / ioredis / in-memory
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
├── vercel.json                  # Vercel serverless конфигурация
├── DEPLOY.md                    # Инструкция деплоя (VPS)
├── DEPLOY-VERCEL.md             # Инструкция деплоя (Vercel)
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
| `REDIS_URL` | — | Redis (Upstash или ioredis) |
| `REDIS_PASSWORD` | — | Пароль Redis (prod) |
| `YANDEX_MAPS_API_KEY` | — | Yandex Maps |
| `UPLOAD_DIR` | `/app/uploads` | Директория загрузок |
| `MAX_FILE_SIZE` | `5242880` | Макс. размер файла (5MB) |
| `LOG_LEVEL` | `info` | Уровень логов |
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
| Бэкенд-модулей | **22** |
| API-эндпоинтов | **110+** |
| Frontend API-методов | **142** |
| Моделей БД (Prisma) | **34** |
| Enum'ов | **12** |
| Страниц фронтенда | **39** |
| UI-компонентов | **35** |
| Маршрутов | **33** |
| Кастомных хуков | **8** |
| Языков i18n | **3** (ru/uz/en, ~1300+ ключей) |
| Категорий каталога | **15** |
| Подкатегорий | **55+** |
| Задач/услуг | **200+** |
| Docker-сервисов (prod) | **6** |
| CI/CD job'ов | **3** (test → build → deploy) |

---

## 📄 Лицензия

Проприетарное ПО. Все права защищены. © 2024–2026 MasterUz
