# 💳 Payme Integration Guide for MasterUz

> Полная документация по интеграции платёжной системы Payme в MasterUz приложение

## 📚 Содержание

1. [Обзор](#обзор)
2. [Быстрый старт (Sandbox)](#быстрый-старт-sandbox)
3. [Архитектура](#архитектура)
4. [API Reference](#api-reference)
5. [Тестирование](#тестирование)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Обзор

MasterUz поддерживает две платёжные модели от Payme:

### 1. Merchant API (webhook-модель) ✅ Готово

Payme инициирует запросы к вашему серверу для проверки и подтверждения платежей.

**Методы** (все 6 методов протокола реализованы):
- `CheckPerformTransaction` — проверка возможности проведения (+ фискальный `detail`)
- `CreateTransaction` — регистрация транзакции (идемпотентна, таймаут 12ч)
- `PerformTransaction` — проведение платежа (с автоматической фискализацией)
- `CancelTransaction` — отмена (state `-1`) / возврат после проведения (state `-2`)
- `CheckTransaction` — проверка состояния транзакции
- `GetStatement` — выписка транзакций за период (сверка)

Состояние транзакций Payme хранится в отдельной таблице `payment_transactions`
(стабильные `create_time`/`perform_time`/`cancel_time`, машина состояний 1/2/-1/-2).

**Где используется**: Основной способ приёма платежей, webhook-based flow.

### 2. Subscribe API (Cards + Receipts) ✅ Готово

Ваше приложение инициирует JSON-RPC запросы к Payme для привязки карт и оплаты
в один клик. Используются **реальные** методы протокола Payme:

**Cards**:
- `cards.create` — создать токен карты `{ card: { number, expire }, save }` (БЕЗ CVV)
- `cards.get_verify_code` — отправить SMS-код владельцу карты `{ token }`
- `cards.verify` — подтвердить карту SMS-кодом `{ token, code }`
- `cards.check` — проверить состояние токена `{ token }`
- `cards.remove` — удалить токен `{ token }`

**Receipts**:
- `receipts.create` — создать чек `{ amount, account, detail }`
- `receipts.pay` — оплатить чек привязанной картой `{ id, token }`

> ⚠️ Payme Subscribe API **не принимает CVV**. `expire` — строка `"MMYY"`.
> Карта подтверждается по SMS. Оплата: `receipts.create` → `receipts.pay(token)`.

**Где используется**: Быстрая оплата сохранённой картой (one-click), рекуррентные платежи.

---

## Быстрый старт (Sandbox)

### 1. Установить переменные окружения

```bash
# .env.local или .env.development
export PAYME_USE_SANDBOX=true
export PAYME_SANDBOX_MERCHANT_ID=test_merchant
export PAYME_SANDBOX_MERCHANT_KEY=test_key
export PAYME_WEBHOOK_WHITELIST=127.0.0.1,::1
```

### 2. Запустить dev сервер

```bash
npm install
npm run dev
```

### 3. Expose локального сервера в интернет

Payme требует публично доступный URL для отправки webhook'ов.

```bash
# Вариант A: ngrok
ngrok http 3000
# → https://abcd-1234.ngrok.io

# Вариант B: локальный tunnel (если используете Railway/Docker)
# Уже имеет публичный URL через dev server
```

### 4. Тестировать Merchant API

```bash
# CheckPerformTransaction
curl -X POST http://localhost:3000/api/payments/webhook/payme \
  -H "Authorization: Basic dGVzdF9tZXJjaGFudDp0ZXN0X2tleQ==" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "CheckPerformTransaction",
    "params": {
      "account": { "payment_id": "pay-123" },
      "amount": 5000000
    },
    "id": "1",
    "jsonrpc": "2.0"
  }'
```

### 5. Тестировать Subscribe API (привязка карты)

```bash
# Frontend: откройте http://localhost:3000 и используйте SubscribeCardForm

# Или через curl:
curl -X POST http://localhost:3000/api/payments/subscribe/rpc \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "subscribe.bind",
    "params": {
      "pan": "8600969801234567",
      "expiry": "0325",
      "cvv": "123"
    }
  }'
```

---

## Архитектура

### Backend структура

```
backend/src/
├── modules/
│   ├── payments/
│   │   ├── payments.service.ts      ← обработка Merchant API
│   │   ├── payments.routes.ts       ← POST /webhook/payme
│   │   └── payments.schema.ts       ← Zod валидация
│   │
│   └── subscribe/
│       ├── subscribe.service.ts     ← RPC форвард к Payme
│       ├── subscribe.routes.ts      ← POST /subscribe/rpc
│       ├── subscribe.schema.ts      ← allowlist методов
│       └── SUBSCRIBE_EXAMPLES.ts    ← примеры использования
│
├── middleware/
│   └── ipWhitelist.ts               ← IP фильтр для webhook'ов
│
└── config/
    └── index.ts                     ← PAYME_* env переменные
```

### Flow diagrams

**Merchant API (Checkout форма на Payme)**:
```
User заполняет форму на Payme
         ↓
Payme отправляет CheckPerformTransaction webhook
         ↓
Backend проверяет платёж в БД
         ↓
Payme создаёт транзакцию
         ↓
User подтверждает платёж
         ↓
Payme отправляет PerformTransaction webhook
         ↓
Backend меняет статус платежа на COMPLETED
  + автоматически вызывает receipts.create
         ↓
Backend отправляет callback пользователю
```

**Subscribe API (Привязка карты + One-click платёж)**:
```
Frontend показывает SubscribeCardForm
         ↓
User вводит PAN, expiry, CVV
         ↓
Frontend отправляет POST /subscribe/rpc (subscribe.bind)
         ↓
Backend форвардит к Payme Subscribe API
         ↓
Payme возвращает cardToken
         ↓
Frontend сохраняет token в localStorage или отправляет на backend
         ↓
Для оплаты: Frontend отправляет POST /subscribe/rpc (subscribe.charge)
         ↓
Backend списывает средства с карты
         ↓
Frontend показывает success/error уведомление
```

---

## API Reference

### `/api/payments/webhook/payme` (POST)

Webhook для Merchant API. Payme отправляет JSON-RPC запросы.

**Headers**:
```
Authorization: Basic <base64(merchantId:merchantKey)>
Content-Type: application/json
X-Forwarded-For: <payme-ip> (проверяется против PAYME_WEBHOOK_WHITELIST)
```

**Методы**:

#### CheckPerformTransaction
```json
{
  "method": "CheckPerformTransaction",
  "params": {
    "account": { "payment_id": "pay-123" },
    "amount": 5000000,  // в тийинах (50,000 сўм)
    "time": 1234567890000
  },
  "id": "1",
  "jsonrpc": "2.0"
}
```

Ответ успеха:
```json
{
  "result": {
    "allow": true
  }
}
```

Ошибка (платёж не найден):
```json
{
  "error": {
    "code": -31050,
    "message": "Payment not found"
  }
}
```

#### CreateTransaction
```json
{
  "method": "CreateTransaction",
  "params": {
    "account": { "payment_id": "pay-123" },
    "amount": 5000000,
    "time": 1234567890000
  },
  "id": "2",
  "jsonrpc": "2.0"
}
```

#### PerformTransaction
```json
{
  "method": "PerformTransaction",
  "params": {
    "id": "payme-tx-1",  // transaction ID от Payme
    "time": 1234567890000,
    "reason": 0
  },
  "id": "3",
  "jsonrpc": "2.0"
}
```

Ответ:
```json
{
  "result": {
    "state": 2,  // 0=cancelled, 1=processing, 2=completed
    "perform_time": 1234567890,
    "transaction": "payme-tx-1"
  }
}
```

#### CancelTransaction
```json
{
  "method": "CancelTransaction",
  "params": {
    "id": "payme-tx-1",
    "reason": 1,
    "time": 1234567890000
  },
  "id": "4",
  "jsonrpc": "2.0"
}
```

---

### `/api/payments/subscribe/rpc` (POST)

RPC endpoint Subscribe API. Требует аутентификация (JWT).

**Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Методы** (реальные методы Payme, БЕЗ CVV):

#### cards.create (создание токена карты)
```json
{
  "method": "cards.create",
  "params": {
    "card": { "number": "8600069195406311", "expire": "0399" },
    "save": true
  }
}
```

Ответ (токен ещё не подтверждён — `verify: false`):
```json
{
  "result": {
    "card": {
      "number": "860006******6311",
      "expire": "0399",
      "token": "681f...c0d",
      "recurrent": true,
      "verify": false
    }
  }
}
```

#### cards.get_verify_code → cards.verify (подтверждение по SMS)
```json
{ "method": "cards.get_verify_code", "params": { "token": "681f...c0d" } }
```
```json
{ "method": "cards.verify", "params": { "token": "681f...c0d", "code": "666666" } }
```

#### Оплата: receipts.create → receipts.pay
```json
{
  "method": "receipts.create",
  "params": {
    "amount": 5000000,
    "account": { "order_id": "pay-123" },
    "detail": { "receipt_type": 0, "items": [ /* … */ ] }
  }
}
```
```json
{
  "method": "receipts.pay",
  "params": { "id": "<receipt._id>", "token": "681f...c0d" }
}
```

Ответ `receipts.pay` (успех — `state: 4`):
```json
{ "result": { "receipt": { "_id": "...", "state": 4 } } }
```

> Внутри приложения оплата в один клик доступна через
> `POST /api/payments/subscribe/charge` с `{ paymentId, cardToken }`,
> которая сама выполняет `receipts.create` → `receipts.pay`.

---

## Тестирование

### Sandbox тестовые карты

| Карта | PAN | Expiry | CVV | Статус |
| --- | --- | --- | --- | --- |
| MasterCard | 5105105105105100 | 12/25 | 123 | ✅ OK |
| Visa | 4111111111111111 | 12/25 | 123 | ✅ OK |

### Unit тесты

```bash
npm run test -- tests/unit/payments-receipts.test.ts
```

Тестирует:
- `createReceipt()` успешно отправляет receipts.create
- Обработка ошибок фискализации (non-fatal)
- Sandbox vs Production URL переключение

### Integration тесты

```bash
npm run test -- tests/integration/payme-merchant-api.test.ts
```

Тестирует:
- CheckPerformTransaction (успех, ошибки)
- CreateTransaction (дублирование, успех)
- PerformTransaction (успех, double-submit)
- CancelTransaction (успех, запрет на completed платежи)
- Error handling (неверный метод, DB ошибки)

---

## Production Deployment

### Шаг 1 — Контакт с Payme

Отправьте письмо на `partner@payme.uz`:

```
Тема: Integracao MasterUz - Production Deployment

Содержание:
- Ваш merchantId (получите в ответе)
- Ваш merchantKey (получите в ответе)
- Webhook URL: https://your-domain.uz/api/payments/webhook/payme
- IP адреса вашего сервера для whitelist'а

Они ответят с production credentials.
```

### Шаг 2 — Настроить переменные

```bash
# .env.production
PAYME_MERCHANT_ID=xxxxxx-prod
PAYME_MERCHANT_KEY=xxxxxx-prod-key
PAYME_USE_SANDBOX=false  # ← ВАЖНО!
PAYME_WEBHOOK_WHITELIST=185.222.126.0/24,185.222.127.0/24  # IPs от Payme
```

### Шаг 3 — Deploy

```bash
# На production сервере
docker compose -f docker-compose.prod.yml up -d

# Проверить логи
docker compose -f docker-compose.prod.yml logs -f backend | grep payme
```

### Шаг 4 — Тестирование

Payme team отправит тестовый платёж на ваш webhook. Убедитесь что:
- Webhook получен ✅
- Статус платежа обновлён ✅
- Чек фискализирован ✅
- Callback отправлен пользователю ✅

---

## Troubleshooting

### 401 Unauthorized

```
Ошибка: Authorization header missing or invalid

Решение:
1. Проверьте что merchantId и merchantKey верны
2. Basic Auth должен быть base64(merchantId:merchantKey)
3. Header формат: Authorization: Basic <base64>
```

### 403 Forbidden

```
Ошибка: IP адрес не в whitelist

Решение:
1. Проверьте PAYME_WEBHOOK_WHITELIST в .env
2. Убедитесь что это IP адрес Payme, не ваш сервер
3. Для sandbox используйте: 127.0.0.1, ::1, 10.0.0.0/8
```

### receipts.create failed

```
Ошибка: Фискализация чека не удалась (но платёж завершен)

Это нормально — фискализация не блокирует основной платёж.
Решение: проверьте логи и переправьте receipts.create вручную.
```

### subscribe.bind отклоняет карту

```
Ошибка: "Card declined" или "Invalid CVV"

Решение:
1. Используйте тестовые карты выше в документе
2. Убедитесь что формат правильный (PAN=16 цифр, expiry=MMYY, cvv=3 цифры)
3. Проверьте что используете sandbox среду (PAYME_USE_SANDBOX=true)
```

### Webhook не приходит

```
Ошибка: Webhook не получен на backend

Решение:
1. Убедитесь что PAYME_CALLBACK_URL = https://your-domain.uz/api/payments/webhook/payme
2. Доступен ли URL из интернета? (используйте curl как тест)
3. Есть ли в логах попытки webhook'ов?
4. Для локального dev используйте ngrok: ngrok http 3000
```

---

## Дополнительные ресурсы

- **Payme Merchant API документация**: https://apidoc.paycom.uz
- **Payme Subscribe API документация**: https://apidoc.paycom.uz/subscribe
- **Примеры кода**: `backend/src/modules/subscribe/SUBSCRIBE_EXAMPLES.ts`
- **Тесты**: `backend/tests/integration/payme-merchant-api.test.ts`
- **Полный гайд**: `DEPLOY.md` → раздел 15

---

**Готово!** 🎉 Ваша Payme интеграция готова к тестированию и production deployment.

Если есть вопросы:
1. Проверьте `backend/src/modules/subscribe/SUBSCRIBE_EXAMPLES.ts` для примеров
2. Посмотрите логи: `docker compose logs -f backend | grep payme`
3. Проверьте `.env` переменные
4. Контактируйте Payme team: `support@payme.uz` (sandbox) или `partner@payme.uz` (production)
