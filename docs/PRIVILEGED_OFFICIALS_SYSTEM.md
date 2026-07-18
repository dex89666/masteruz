# Система привилегированных должностных лиц и мотивации (MasterUz)

## Обзор

Система позволяет предоставлять особые статусы и привилегии чиновникам, начальникам жилого комплекса, директорам предприятий и другим высокопоставленным лицам. Это создаёт у них **материальный интерес** в быстрооргании решения проблем через платформу MasterUz.

### Ключевые возможности

1. **Назначение привилегированного статуса** — на основе верифицированного документа
2. **Ускорение заказов** — приоритизация в очереди  
3. **Переопределение SLA** — управление сроками  
4. **KPI и метрики** — отслеживание качества (SLA%, CSAT, скорость решения)
5. **Бонусные программы** — материальное вознаграждение за достижение целей  
6. **Аудит всех действий** — полная прозрачность и безопасность

---

## Архитектура

### Структура БД

#### 1. `PrivilegedOfficialProfile` — профиль привилегированного лица

```sql
privileged_official_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE,            -- ссылка на User
  organization_name VARCHAR,      -- "ТОО ЖЭК №3"
  position VARCHAR,               -- "Начальник"
  privilege_type ENUM,            -- BUILDING_HEAD | OFFICIAL | BUSINESS_OWNER | DISTRICT_HEAD
  status ENUM,                    -- PENDING | ACTIVE | SUSPENDED | REVOKED
  can_fast_track BOOLEAN,         -- может ускорять
  can_assign_master BOOLEAN,      -- может назначать мастеров
  can_override_sla BOOLEAN,       -- может менять SLA
  monthly_bonus_pool DECIMAL,     -- пул бонусов на месяц
  bonus_percentage FLOAT,         -- % бонуса от сэкономленной суммы
  daily_fast_track_limit INT,     -- лимит ускорений в день
  daily_fast_track_used INT,      -- использовано сегодня
  expires_at TIMESTAMP,           -- дата истечения привилегии
  approved_by UUID,               -- кто одобрил (admin)
)
```

#### 2. `PrivilegedAction` — аудит действий

Каждое действие привилегированного лица логируется:
- `PROFILE_CREATED`, `STATUS_CHANGED`  
- `FAST_TRACKED`, `PRIORITY_SET`, `ASSIGNED_MASTER`  
- Содержит: IP, User-Agent, причину, метаданные

#### 3. `KPIRecord` — показатели за период

```sql
kpi_records (
  official_id UUID,
  period VARCHAR(7),              -- '2024-06'
  total_orders INT,               -- всего заказов
  on_time_orders INT,             -- выполнено в срок
  sla_score FLOAT,                -- % выполнения SLA
  avg_rating FLOAT,               -- средняя оценка клиентов
  bonus_earned DECIMAL,           -- заработано бонусов
  status ENUM                     -- PRELIMINARY | FINAL | VOIDED
)
```

#### 4. `MotivationSetting` — настройки мотивации по типам

```sql
motivation_settings (
  privilege_type ENUM UNIQUE,     -- BUILDING_HEAD, OFFICIAL, etc.
  sla_threshold_pct FLOAT DEFAULT 85.0,      -- порог SLA для бонуса
  satisfaction_min FLOAT DEFAULT 4.0,        -- минимально рейтинг
  base_bonus_percentage FLOAT DEFAULT 5.0,   -- базовый % бонуса
  sla_bonus_boost FLOAT DEFAULT 1.5,         -- множитель за хороший SLA
  fast_track_limit INT DEFAULT 5,
  max_custom_sla_hours INT DEFAULT 4
)
```

#### 5. `OfficialOrderPriority` — приоритет к заказу

```sql
official_order_priorities (
  order_id UUID,
  official_id UUID,
  priority_level INT (1..3),      -- 1 = критично, 2 = высокий, 3 = нормальный
  custom_sla_hours INT,           -- переопределённый срок
  bonus_amount DECIMAL            -- доп. награда
)
```

---

## API Routes

### Создание и управление профилями

#### `POST /api/admin/privileged-officials`
Создать профиль привилегированного лица.

**Request:**
```json
{
  "userId": "uuid",
  "organizationName": "ТОО ЖЭК №3",
  "position": "Начальник",
  "privilegeType": "BUILDING_HEAD",
  "documentNumber": "№123456",
  "documentUrl": "https://...",
  "expiresAt": "2025-06-30T23:59:59Z"
}
```

#### `GET /api/admin/privileged-officials`
Список привилегированных лиц с фильтрацией.

**Query params:**
- `status` — PENDING, ACTIVE, SUSPENDED, REVOKED
- `privilegeType` — BUILDING_HEAD, OFFICIAL, etc.
- `search` — поиск по организации или юзеру
- `page`, `limit`

#### `PUT /api/admin/privileged-officials/:officialId/status`
Изменить статус (одобрить/отклонить/приостановить).

**Request:**
```json
{
  "status": "ACTIVE",
  "statusReason": "Документы верифицированы"
}
```

---

### Операции с заказами

#### `POST /api/admin/privileged-officials/:officialId/fast-track`
Ускорить заказ в очереди.

**Request:**
```json
{
  "orderId": "uuid",
  "reason": "Срочный ремонт в жилом комплексе"
}
```

#### `POST /api/admin/privileged-officials/:officialId/set-priority`
Назначить приоритет и SLA заказу.

**Request:**
```json
{
  "orderId": "uuid",
  "priorityLevel": 1,  // "Критично"
  "customSlaHours": 4,
  "bonusAmount": "50000"
}
```

---

### KPI и метрики

#### `POST /api/admin/privileged-officials/:officialId/calculate-kpi`
Рассчитать KPI за период.

**Request:**
```json
{
  "period": "2024-06"  // год-месяц
}
```

**Response:**
```json
{
  "period": "2024-06",
  "totalOrders": 45,
  "onTimeOrders": 42,
  "slaScore": 93.3,
  "avgRating": 4.6,
  "bonusEarned": 125000
}
```

#### `GET /api/admin/motivation-settings`
Получить текущие настройки мотивации.

#### `PUT /api/admin/motivation-settings/:privilegeType`
Обновить пороги и бонусы для типа привилегии.

---

### Аудит и история

#### `GET /api/admin/privileged-officials/:officialId/actions`
История действий привилегированного лица.

**Query params:**
- `limit`, `offset`

**Response:**
```json
{
  "actions": [
    {
      "id": "uuid",
      "action": "FAST_TRACKED",
      "targetEntityType": "ORDER",
      "targetEntityId": "uuid",
      "description": "Заказ ускорен...",
      "metadata": {...},
      "createdAt": "2024-06-15T10:30:00Z"
    }
  ],
  "total": 47
}
```

---

## Бизнес-логика

### Расчёт KPI

Для каждого привилегированного лица каждый месяц рассчитываются:

1. **SLA Score (%)** = (заказы_выполненные_в_срок / всего_заказов) × 100
   - Успех если `>= sla_threshold_pct` (по умолчанию 85%)

2. **Avg Rating** = средняя оценка от клиентов (1-5 звёзд)
   - Бонус начисляется если `>= satisfaction_min` (по умолчанию 4.0)

3. **Bonus Earned** = 
   ```
   IF sla_score >= sla_threshold_pct AND avg_rating >= satisfaction_min:
     monthly_bonus_pool × (bonus_percentage / 100) × sla_boost_multiplier
   ELSE:
     0
   ```

**Пример:**
- monthly_bonus_pool = 1,000,000 сум  
- bonus_percentage = 5%
- sla_boost_multiplier = 1.5 (за хороший SLA)
- **Бонус = 1,000,000 × 5% × 1.5 = 75,000 сум**

### Лимиты и ограничения

- **Ускорения в день**: по умолчанию 5, зависит от типа привилегии
- **Max SLA Override**: 4 часа для начальника ЖЭКа, 2 часа для чиновника
- **Действие привилегии**: обычно 1 год, требует продления

---

## Типы привилегии и их параметры

| Тип | SLA Порог | Min Rating | Бонус % | Множитель SLA | Fast-Track Limit | Max SLA Override |
|-----|-----------|-----------|---------|---------------|-----------------|------------------|
| BUILDING_HEAD | 85% | 4.0 | 5% | 1.5× | 5 | 4 ч |
| OFFICIAL | 90% | 4.2 | 7% | 2.0× | 10 | 2 ч |
| BUSINESS_OWNER | 80% | 3.8 | 8% | 1.8× | 8 | 6 ч |
| DISTRICT_HEAD | 88% | 4.1 | 6% | 1.7× | 7 | 3 ч |

---

## Интеграция с существующей системой

### Связь с заказами

Когда приоритет установлен, заказ:
1. Переместится выше в очереди поиска мастеров
2. Получит специальный флаг в UI ("⚡ Приоритет")
3. Будет пинговать мастеров чаще
4. Может иметь кастомный SLA (если `can_override_sla = true`)

### Связь с балансом

- Бонусы начисляются на баланс привилегированного лица ежемесячно
- Могут быть выплачены наличными или зачислены на баланс

### Уведомления

- Админ получает уведомление когда запрос на привилегию поступил
- Чиновник получает напоминание за 30 дней до истечения
- Система логирует все действия для аудита

---

## Использование в админке

### Пример: Предоставить статус начальнику ЖЭКа

1. **Admin → Privileged Officials → Create**
   - Найти пользователя
   - Ввести организацию: "ТОО ЖЭК №3"
   - Должность: "Начальник"
   - Тип: "BUILDING_HEAD"
   - Загрузить скан приказа
   
2. **Approve Status**
   - Проверить документ
   - Нажать "Approve"
   - Начальник получит письмо

3. **Смотреть KPI ежемесячно**
   - Dashboard → Privileged Officials → Officer Profile
   - Видеть SLA Score, Average Rating, Earned Bonus
   - При необходимости рассчить KPI вручную

4. **Использовать быстрые действия**
   - Начальник может ускорить заказ через UI
   - Каждое действие логируется в "Actions History"

---

## Безопасность

1. **RBAC** — только ADMIN может управлять привилегиями
2. **Аудит** — все действия логируются с IP и User-Agent
3. **Валидация** — документы проверяются вручную перед одобрением
4. **Лимиты** — дневные лимиты ускорений предотвращают абьюз
5. **Соглашение** — администратор должен согласиться на условия использования

---

## Примечания

- **SLA рассчитывается** как время с создания заказа до завершения ≤ 24 часа
- **Процессы длительные** — KPI рассчитывается в конце месяца вручную или по крону
- **Бонусные выплаты** — начисляются только если all условия met, не частично
- **Многоязычность** — UI и коммуникация должны поддерживать узбекский и русский

---

## Дальнейшее развитие

1. **Автоматический расчёт KPI** — cron job в конце месяца  
2. **Интеграция с платёжными системами** — выплаты бонусов напрямую
3. **Система рейтинга** — леaderboard привилегированных лиц
4. **Мобильное приложение** — для начальников
5. **Уведомления в реальном времени** — WebSocket push при ускорении

---

**Полная документация API**: см. [privileged-officials.routes.ts](../../backend/src/modules/admin/privileged-officials.routes.ts)

**Бизнес-логика**: см. [privilegedOfficialService.ts](../../backend/src/services/privilegedOfficialService.ts)
