# ============================================
# MasterUz — Архитектурная документация
# ============================================

## 1. Обзор системы

MasterUz — платформа-посредник, соединяющая клиентов 
с мастерами бытовых/строительных услуг в Узбекистане.

## 2. Диаграмма потоков данных (Flowchart)

```
[Клиент] ──► Авторизация (Telegram) ──► [JWT Token]
    │
    ▼
[Создание заказа]
    │ Выбор категории → Описание → Сумма → Дедлайн
    │
    ▼
[Лот опубликован] ──► Автоматическое начисление комиссии платформы
    │
    ▼
[Алгоритм распределения]
    │ Фильтр: геолокация + рейтинг + специализация
    │
    ▼
[Мастера видят лот] ──► [Мастер принимает]
    │                         │
    │                    [Оплата комиссии]
    │                         │
    │                    [Получение контактов]
    │                         │
    ▼                         ▼
[Выполнение работы] ◄────────┘
    │
    ▼
[Клиент оценивает] ──► [Обновление рейтинга]
    │
    ▼
[Завершение заказа] ──► [Аналитика в админ-панели]
```

## 3. ER-диаграмма базы данных

```
┌──────────────────┐     ┌──────────────────┐
│      users       │     │   user_profiles  │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │────►│ id (PK)          │
│ telegram_id      │     │ user_id (FK)     │
│ role             │     │ first_name       │
│ phone            │     │ last_name        │
│ email            │     │ avatar_url       │
│ is_active        │     │ bio              │
│ is_verified      │     │ latitude         │
│ referral_code    │     │ longitude        │
│ referred_by (FK) │     │ address          │
│ created_at       │     │ city             │
│ updated_at       │     │ district         │
└──────────────────┘     └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐     ┌──────────────────┐
│  master_profiles │     │   certificates   │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │────►│ id (PK)          │
│ user_id (FK)     │     │ master_id (FK)   │
│ specializations  │     │ title            │
│ experience_years │     │ file_url         │
│ rating           │     │ verified         │
│ completed_orders │     │ verified_at      │
│ is_available     │     │ created_at       │
│ max_distance_km  │     └──────────────────┘
│ hourly_rate      │
│ school_completed │
│ created_at       │
└──────────────────┘
         │
         │ N:M
         ▼
┌──────────────────┐     ┌──────────────────┐
│     orders       │     │  order_responses │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │────►│ id (PK)          │
│ client_id (FK)   │     │ order_id (FK)    │
│ master_id (FK)   │     │ master_id (FK)   │
│ category_id (FK) │     │ price_offer      │
│ title            │     │ message          │
│ description      │     │ status           │
│ price            │     │ created_at       │
│ commission_rate  │     └──────────────────┘
│ commission_amount│
│ status           │
│ latitude         │     ┌──────────────────┐
│ longitude        │     │    categories    │
│ address          │     ├──────────────────┤
│ deadline         │     │ id (PK)          │
│ created_at       │     │ name             │
│ completed_at     │     │ slug             │
│ cancelled_at     │     │ icon             │
└──────────────────┘     │ parent_id (FK)   │
         │               │ sort_order       │
         │ 1:N           │ is_active        │
         ▼               └──────────────────┘
┌──────────────────┐
│     reviews      │     ┌──────────────────┐
├──────────────────┤     │    payments      │
│ id (PK)          │     ├──────────────────┤
│ order_id (FK)    │     │ id (PK)          │
│ reviewer_id (FK) │     │ order_id (FK)    │
│ reviewee_id (FK) │     │ user_id (FK)     │
│ rating (1-5)     │     │ amount           │
│ comment          │     │ type             │
│ created_at       │     │ provider         │
└──────────────────┘     │ provider_tx_id   │
                         │ status           │
┌──────────────────┐     │ metadata (JSON)  │
│    referrals     │     │ created_at       │
├──────────────────┤     └──────────────────┘
│ id (PK)          │
│ referrer_id (FK) │     ┌──────────────────┐
│ referred_id (FK) │     │  school_courses  │
│ type             │     ├──────────────────┤
│ bonus_amount     │     │ id (PK)          │
│ bonus_rate       │     │ category_id (FK) │
│ status           │     │ title            │
│ created_at       │     │ description      │
└──────────────────┘     │ video_url        │
                         │ duration_minutes │
┌──────────────────┐     │ sort_order       │
│  platform_config │     │ is_required      │
├──────────────────┤     │ created_at       │
│ id (PK)          │     └──────────────────┘
│ key              │
│ value            │     ┌──────────────────┐
│ description      │     │ course_progress  │
│ updated_by (FK)  │     ├──────────────────┤
│ updated_at       │     │ id (PK)          │
└──────────────────┘     │ user_id (FK)     │
                         │ course_id (FK)   │
┌──────────────────┐     │ completed        │
│   blacklist      │     │ completed_at     │
├──────────────────┤     └──────────────────┘
│ id (PK)          │
│ user_id (FK)     │     ┌──────────────────┐
│ reason           │     │  notifications   │
│ blocked_by (FK)  │     ├──────────────────┤
│ created_at       │     │ id (PK)          │
│ expires_at       │     │ user_id (FK)     │
└──────────────────┘     │ type             │
                         │ title            │
                         │ message          │
                         │ data (JSON)      │
                         │ is_read          │
                         │ created_at       │
                         └──────────────────┘
```

## 4. Алгоритм распределения заказов

```
Input: новый заказ (order), список доступных мастеров

1. Фильтрация:
   - Мастер.specializations ВКЛЮЧАЕТ order.category
   - Мастер.is_available = true
   - Мастер НЕ в blacklist
   - Расстояние(Мастер, Order) <= Мастер.max_distance_km

2. Scoring (вес):
   - distance_score = 1 - (distance / max_distance)  [вес: 0.4]
   - rating_score = master.rating / 5.0              [вес: 0.3]
   - completion_score = completed / (completed + 10)  [вес: 0.2]
   - newbie_bonus = is_new ? 0.1 : 0                 [вес: 0.1]

3. Сортировка по total_score DESC

4. Для новичков (< 5 заказов):
   - Показывать только заказы с price < avg_price * 0.7
   - Пометка "Рекомендовано для новичков"

5. Return: отсортированный список мастеров
```

## 5. API Endpoints (Обзор)

### Авторизация
- POST /api/auth/telegram — Telegram авторизация
- POST /api/auth/refresh — Обновление токена
- GET  /api/auth/me — Текущий пользователь

### Пользователи
- GET    /api/users/profile — Профиль
- PUT    /api/users/profile — Обновление профиля
- POST   /api/users/master-profile — Создание профиля мастера
- PUT    /api/users/master-profile — Обновление профиля мастера
- POST   /api/users/certificates — Загрузка сертификата

### Заказы
- POST   /api/orders — Создать заказ
- GET    /api/orders — Список заказов (с фильтрами)
- GET    /api/orders/:id — Детали заказа
- POST   /api/orders/:id/respond — Откликнуться на заказ
- PUT    /api/orders/:id/assign — Назначить мастера
- PUT    /api/orders/:id/complete — Завершить заказ
- PUT    /api/orders/:id/cancel — Отменить заказ

### Рейтинги
- POST   /api/reviews — Оставить отзыв
- GET    /api/reviews/master/:id — Отзывы мастера

### Платежи
- POST   /api/payments/click/create — Click оплата
- POST   /api/payments/payme/create — Payme оплата
- POST   /api/payments/telegram-stars — Telegram Stars
- POST   /api/payments/webhook/click — Click webhook
- POST   /api/payments/webhook/payme — Payme webhook

### Рефералы
- GET    /api/referrals/link — Получить реферальную ссылку
- GET    /api/referrals/stats — Статистика рефералов

### Школа мастеров
- GET    /api/school/courses — Список курсов
- GET    /api/school/courses/:id — Детали курса
- POST   /api/school/courses/:id/complete — Отметить завершение
- GET    /api/school/progress — Прогресс обучения

### Геолокация
- GET    /api/geo/orders-nearby — Заказы рядом
- GET    /api/geo/masters-nearby — Мастера рядом

### Админ-панель
- GET    /api/admin/dashboard — Дашборд (аналитика)
- GET    /api/admin/users — Список пользователей
- PUT    /api/admin/users/:id/block — Блокировка
- PUT    /api/admin/users/:id/verify — Верификация
- GET    /api/admin/orders — Все заказы
- GET    /api/admin/payments — Все платежи
- GET    /api/admin/config — Конфигурация платформы
- PUT    /api/admin/config — Обновить конфигурацию
