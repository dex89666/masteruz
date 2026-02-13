# 🚀 MasterUz — Деплой на Vercel (БЕСПЛАТНО)

> **Стоимость**: $0/мес (кроме домена ~$15-30/год)
> **Стек**: Vercel (Hobby) + Neon PostgreSQL (Free) + Upstash Redis (Free) + Vercel Blob (Free)
> **Время**: ~30 минут от начала до рабочего сайта

---

## 📋 Содержание

1. [Что получаем бесплатно](#1--что-получаем-бесплатно)
2. [Шаг 1 — Создание Telegram бота](#2--шаг-1--создание-telegram-бота)
3. [Шаг 2 — Создание бесплатной БД (Neon)](#3--шаг-2--создание-бесплатной-бд-neon)
4. [Шаг 3 — Создание бесплатного Redis (Upstash)](#4--шаг-3--создание-бесплатного-redis-upstash)
5. [Шаг 4 — Загрузка кода на GitHub](#5--шаг-4--загрузка-кода-на-github)
6. [Шаг 5 — Деплой на Vercel](#6--шаг-5--деплой-на-vercel)
7. [Шаг 6 — Переменные окружения](#7--шаг-6--переменные-окружения)
8. [Шаг 7 — Миграция БД и seed](#8--шаг-7--миграция-бд-и-seed)
9. [Шаг 8 — Подключение домена](#9--шаг-8--подключение-домена)
10. [Шаг 9 — Telegram Mini App](#10--шаг-9--telegram-mini-app)
11. [Шаг 10 — Vercel Blob (загрузка файлов)](#11--шаг-10--vercel-blob)
12. [Справочник всех переменных](#12--справочник-всех-переменных)
13. [Ограничения и когда переходить на VPS](#13--ограничения-и-переход-на-vps)
14. [Полезные команды](#14--полезные-команды)
15. [FAQ](#15--faq)

---

## 1. 💰 Что получаем бесплатно

| Сервис | Бесплатный лимит | Для чего | Хватит на |
|--------|------------------|----------|-----------|
| **Vercel** (Hobby) | 100 GB bandwidth, serverless functions | Frontend + Backend API | ~10,000 пользователей/мес |
| **Neon** (Free) | 0.5 GB storage, 100 CU-hours | PostgreSQL база данных | ~50,000 записей |
| **Upstash** (Free) | 256 MB, 500K commands/мес | Redis (кэш, сессии) | ~16K запросов/день |
| **Vercel Blob** (Free) | 500 MB storage | Загрузка фото/файлов | ~2,500 фото |
| **Let's Encrypt** | ∞ | SSL сертификат | Автоматически |
| **GitHub** (Free) | ∞ private repos | Хранение кода + CI/CD | Без ограничений |

**Итого: $0/мес + домен $15-30/год**

### Когда переходить на VPS?
- Более 10K активных пользователей
- Нужны WebSockets (чат в реальном времени)
- Холодный старт (~1-3 сек) мешает UX
- Больше 0.5 GB данных в БД

> 📁 Файлы для VPS-деплоя сохранены в бэкапе: `D:\MasterUz_BACKUP_13-02-2026`

---

## 2. 🤖 Шаг 1 — Создание Telegram бота

1. Откройте Telegram → найдите **@BotFather**
2. Отправьте `/newbot`
3. Имя: `MasterUz — Муж на час`
4. Username: `MasterUzBot` (или ваш вариант)
5. **Скопируйте токен**: `1234567890:AAF-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

Настройте бота:
```
/setdescription → MasterUz — Платформа бытовых услуг в Узбекистане 🇺🇿
/setabouttext → 🔧 Заказ мастера за 1 минуту
```

**Запишите:**
- `TELEGRAM_BOT_TOKEN` = ваш токен
- `TELEGRAM_BOT_USERNAME` = username бота (без @)

---

## 3. 🐘 Шаг 2 — Создание бесплатной БД (Neon)

### 3.1 Регистрация

1. Зайдите на **[neon.tech](https://neon.tech)** → Sign Up (через GitHub)
2. Создайте проект:
   - **Name**: `masteruz`
   - **Region**: `AWS EU (Frankfurt)` (ближе к Узбекистану)
   - **Postgres version**: 16
3. Нажмите **Create Project**

### 3.2 Получение connection string

1. В dashboard → **Connection Details**
2. Скопируйте строку подключения:

```
postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

3. **Добавьте параметры** для serverless:

```
postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15
```

**Запишите:**
- `DATABASE_URL` = полная строка подключения

### 3.3 Бесплатные лимиты Neon

| Лимит | Значение |
|-------|----------|
| Storage | 0.5 GB на проект |
| Compute | 100 CU-hours/мес (~400 часов на 0.25 CU) |
| Scale to zero | Через 5 мин простоя (автоматически) |
| Branches | 10 на проект |
| Egress | 5 GB/мес |

---

## 4. 🔴 Шаг 3 — Создание бесплатного Redis (Upstash)

### 4.1 Регистрация

1. Зайдите на **[console.upstash.com](https://console.upstash.com)** → Sign Up
2. Создайте Redis database:
   - **Name**: `masteruz`
   - **Region**: `EU West 1 (Ireland)`
   - **Type**: Regional
3. Нажмите **Create**

### 4.2 Получение REST credentials

1. В dashboard базы → вкладка **REST API**
2. Скопируйте:
   - **UPSTASH_REDIS_REST_URL**: `https://eu1-xxx-yyy.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `AXxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Запишите:**
- `UPSTASH_REDIS_REST_URL` = URL
- `UPSTASH_REDIS_REST_TOKEN` = Token

---

## 5. 📤 Шаг 4 — Загрузка кода на GitHub

### 5.1 Создайте репозиторий

1. **[github.com](https://github.com)** → New Repository
2. Имя: `masteruz`
3. Visibility: **Private** ⚠️
4. Не инициализируйте README

### 5.2 Загрузите код

В PowerShell (папка `D:\MasterUz`):

```powershell
git init
git branch -M main
git remote add origin https://github.com/ВАШ_USERNAME/masteruz.git
git add .
git commit -m "🚀 MasterUz v1.0 — Initial release"
git push -u origin main
```

---

## 6. ▲ Шаг 5 — Деплой на Vercel

### 6.1 Подключение проекта

1. Зайдите на **[vercel.com](https://vercel.com)** → Sign Up через GitHub
2. **Add New Project** → Import Git Repository
3. Выберите `masteruz` из списка
4. **Configure Project**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `.` (корень)
   - **Build Command**: оставьте пустым (берётся из vercel.json)
   - **Output Directory**: оставьте пустым (берётся из vercel.json)
5. **НЕ нажимайте Deploy пока!** → сначала добавьте переменные (шаг 6)

### 6.2 Или через CLI

```powershell
# Установка Vercel CLI
npm i -g vercel

# Логин
vercel login

# Первый деплой (из D:\MasterUz)
cd D:\MasterUz
vercel
# Ответьте на вопросы:
# → Set up and deploy? Yes
# → Which scope? (ваш аккаунт)
# → Link to existing project? No
# → Project name? masteruz
# → Directory? ./
```

---

## 7. 🔐 Шаг 6 — Переменные окружения

### В Vercel Dashboard → Settings → Environment Variables

Добавьте **каждую переменную** (Environment: Production + Preview + Development):

| Переменная | Значение | Откуда |
|-----------|----------|--------|
| `DATABASE_URL` | `postgresql://...?sslmode=require&connect_timeout=15` | Neon (шаг 2) |
| `UPSTASH_REDIS_REST_URL` | `https://eu1-xxx.upstash.io` | Upstash (шаг 3) |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxxxxxxxxxxxxxxx` | Upstash (шаг 3) |
| `JWT_SECRET` | *(сгенерируйте)* | см. ниже |
| `JWT_REFRESH_SECRET` | *(сгенерируйте)* | см. ниже |
| `TELEGRAM_BOT_TOKEN` | `1234567890:AAF-xxx` | BotFather (шаг 1) |
| `TELEGRAM_BOT_USERNAME` | `MasterUzBot` | BotFather (шаг 1) |
| `CORS_ORIGIN` | `https://masteruz.vercel.app` | Vercel URL |
| `NODE_ENV` | `production` | Вручную |

### Генерация секретов

В PowerShell:
```powershell
# JWT_SECRET
[System.Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# JWT_REFRESH_SECRET (другой!)
[System.Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Или на Linux/Mac:
```bash
openssl rand -hex 32
openssl rand -hex 32
```

### После добавления переменных

Нажмите **Redeploy** в Vercel Dashboard (Deployments → последний → ⋯ → Redeploy)

---

## 8. 🗄 Шаг 7 — Миграция БД и seed

### 8.1 Запуск миграций (из вашего компьютера)

Вам нужен `DATABASE_URL` из Neon. В PowerShell:

```powershell
cd D:\MasterUz\backend

# Установите переменную
$env:DATABASE_URL="postgresql://neondb_owner:ПАРОЛЬ@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Запустите миграции
npx prisma migrate deploy

# Заполните начальными данными
npx tsx prisma/seed.ts
```

### 8.2 Проверка

```powershell
# Откройте Prisma Studio (GUI для БД)
npx prisma studio
# Браузер откроется → проверьте что таблицы созданы и заполнены
```

---

## 9. 🌐 Шаг 8 — Подключение домена

### 9.1 Бесплатный домен Vercel

Ваш проект уже доступен по адресу:
```
https://masteruz.vercel.app
```

Это бесплатно и с SSL — **можно использовать сразу**!

### 9.2 Свой домен (опционально)

1. Купите домен (masteruz.uz, masteruz.com и т.д.)
2. В Vercel Dashboard → **Settings → Domains**
3. Добавьте домен: `masteruz.uz`
4. Vercel покажет DNS записи для настройки:

| Тип | Имя | Значение |
|-----|-----|----------|
| **CNAME** | `www` | `cname.vercel-dns.com` |
| **A** | `@` | `76.76.21.21` |

5. Добавьте эти записи у вашего регистратора
6. SSL сертификат — **автоматически** от Vercel

### 9.3 Обновите CORS_ORIGIN

В Vercel → Settings → Environment Variables обновите:
```
CORS_ORIGIN=https://masteruz.uz
```

---

## 10. 📱 Шаг 9 — Telegram Mini App

> **Требование**: сайт должен работать по HTTPS (Vercel делает это автоматически)

### 10.1 Настройка через BotFather

```
/newapp
→ Выберите бота (@MasterUzBot)
→ Название: MasterUz
→ Описание: Платформа бытовых услуг
→ Фото: скриншот 640x360
→ URL: https://masteruz.vercel.app  (или ваш домен)
→ Short name: app
```

### 10.2 Кнопка Menu

```
/setmenubutton
→ Выберите бота
→ Тип: Web App
→ URL: https://masteruz.vercel.app
→ Текст: 🔧 Открыть MasterUz
```

### 10.3 Проверка

1. Откройте бота в Telegram
2. Нажмите **🔧 Открыть MasterUz**
3. Приложение откроется внутри Telegram ✅
4. Авторизация через `initData` — автоматически

---

## 11. 📦 Шаг 10 — Vercel Blob (загрузка файлов)

### 11.1 Активация

1. Vercel Dashboard → **Storage** → **Create Database**
2. Выберите **Blob**
3. Имя: `masteruz-uploads`
4. Нажмите **Create**
5. Автоматически добавится переменная `BLOB_READ_WRITE_TOKEN`

### 11.2 Лимиты (бесплатно)

| Лимит | Значение |
|-------|----------|
| Storage | 500 MB |
| Max file size | 500 MB |
| Requests | Без ограничений |
| Bandwidth | 5 GB/мес |

---

## 12. 📋 Справочник всех переменных

| Переменная | Обязательна | Откуда | Пример |
|-----------|-------------|--------|--------|
| `DATABASE_URL` | ✅ | Neon dashboard | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash dashboard | `https://eu1-xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash dashboard | `AXxxxxxxxxxx` |
| `JWT_SECRET` | ✅ | Самостоятельно | 32+ символов |
| `JWT_REFRESH_SECRET` | ✅ | Самостоятельно | 32+ символов |
| `TELEGRAM_BOT_TOKEN` | ✅ | @BotFather | `123456:AAF-xxx` |
| `TELEGRAM_BOT_USERNAME` | ✅ | @BotFather | `MasterUzBot` |
| `CORS_ORIGIN` | ✅ | Ваш URL | `https://masteruz.vercel.app` |
| `NODE_ENV` | ✅ | Вручную | `production` |
| `BLOB_READ_WRITE_TOKEN` | ⬜ | Vercel Blob | Авто |
| `YANDEX_MAPS_API_KEY` | ⬜ | Yandex developer | UUID |
| `CLICK_*` / `PAYME_*` | ⬜ | Платёжные системы | По договору |

---

## 13. ⚠️ Ограничения и переход на VPS

### Ограничения Vercel (Hobby)

| Ограничение | Значение | Влияние |
|-------------|----------|---------|
| Cold start | 1-3 сек | Первый запрос после простоя медленный |
| Max duration | 5 мин | Длинные запросы упадут по таймауту |
| Request body | 4.5 MB | Ограничение на загрузку файлов |
| No WebSocket | — | Чат только через polling |
| No cron | — | Нет фоновых задач |
| No file system | Read-only | Файлы через Vercel Blob |

### Когда переходить на VPS

| Сигнал | Действие |
|--------|----------|
| > 10K MAU | Купить VPS ($10/мес) |
| Нужен realtime чат | WebSocket → VPS |
| Cold start мешает | Always-on → VPS |
| > 0.5 GB данных | Neon Launch ($7+) или VPS |
| > 500 MB файлов | S3 или VPS |

### Как перейти на VPS

1. Файлы для VPS уже готовы в бэкапе: `D:\MasterUz_BACKUP_13-02-2026`
2. Все Docker/Nginx/CI-CD конфиги сохранены
3. См. файл `DEPLOY.md` в бэкапе — полная инструкция для VPS
4. Миграция: экспорт Neon → импорт в PostgreSQL на VPS

---

## 14. 🛠 Полезные команды

```powershell
# ─── Vercel CLI ─────────────────────────────────
vercel                    # Деплой в preview
vercel --prod             # Деплой в production
vercel env pull           # Скачать переменные в .env.local
vercel logs               # Логи функций
vercel domains ls         # Список доменов

# ─── База данных (локально) ─────────────────────
# Установите DATABASE_URL перед запуском:
$env:DATABASE_URL="postgresql://..."

npx prisma migrate deploy     # Применить миграции
npx tsx prisma/seed.ts        # Заполнить данными
npx prisma studio             # GUI для БД
npx prisma db pull            # Обновить schema из БД

# ─── Локальная разработка ───────────────────────
cd D:\MasterUz\backend
npm run dev                    # Backend на :3001

cd D:\MasterUz\frontend
npm run dev                    # Frontend на :5173
```

---

## 15. ❓ FAQ

### Сайт не открывается после деплоя
```
1. Vercel → Deployments → проверьте статус (✅ или ❌)
2. Если ❌ — откройте Build Logs и найдите ошибку
3. Частая причина: не указаны Environment Variables
```

### API возвращает 500
```
1. Vercel → Logs (Functions) → найдите ошибку
2. Частая причина: неправильный DATABASE_URL
3. Проверьте что миграции выполнены (шаг 7)
```

### Cold start слишком долгий
```
На Hobby плане cold start = 1-3 сек — это нормально.
Для уменьшения: уменьшите количество зависимостей.
Для устранения: переходите на VPS (always-on).
```

### Telegram Mini App не открывается
```
1. Убедитесь что URL в BotFather = https:// (не http)
2. URL должен точно совпадать с вашим доменом/vercel URL
3. Vercel автоматически даёт SSL — это ОК для Telegram
```

### Как обновить код?
```powershell
git add .
git commit -m "fix: описание изменения"
git push origin main
# Vercel автоматически задеплоит через 1-2 мин
```

---

## 🏗 Архитектура на Vercel

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Free)                     │
│                                                     │
│   ┌──────────────┐    ┌──────────────────────────┐ │
│   │   Frontend    │    │   Backend API             │ │
│   │   React SPA   │    │   Express → Serverless    │ │
│   │   (Static)    │    │   1 catch-all function    │ │
│   └──────────────┘    └──────────┬───────────────┘ │
│                                  │                   │
│   ┌──────────────┐              │                   │
│   │ Vercel Blob   │              │                   │
│   │ (файлы)       │              │                   │
│   └──────────────┘              │                   │
└─────────────────────────────────┼───────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
               ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
               │  Neon    │  │ Upstash │  │Telegram │
               │PostgreSQL│  │  Redis  │  │  Bot    │
               │ (Free)   │  │ (Free)  │  │ (Free)  │
               └──────────┘  └─────────┘  └─────────┘
```

---

**Готово! 🎉** Следуйте шагам 1–10 и ваш MasterUz будет работать бесплатно на Vercel.
Единственная оплата — домен (~$15-30/год), и то можно начать с бесплатного `masteruz.vercel.app`.
