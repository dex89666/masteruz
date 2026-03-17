# 🚀 MasterUz — Полная инструкция по деплою в продакшн

> **Архитектура**: VPS (Ubuntu) → Docker → Nginx (SSL) → Frontend (React SPA) + Backend (Express API) + PostgreSQL + Redis
>
> **Telegram Mini App** встраивается через BotFather → домен вашего сайта

---

## 📋 Содержание

1. [Что вам нужно перед стартом](#1--что-вам-нужно-перед-стартом)
2. [Шаг 1 — Покупка VPS сервера](#2--шаг-1--покупка-vps-сервера)
3. [Шаг 2 — Покупка домена](#3--шаг-2--покупка-домена)
4. [Шаг 3 — Создание Telegram бота](#4--шаг-3--создание-telegram-бота)
5. [Шаг 4 — Загрузка кода на GitHub](#5--шаг-4--загрузка-кода-на-github)
6. [Шаг 5 — Настройка сервера](#6--шаг-5--настройка-сервера)
7. [Шаг 6 — Переменные окружения](#7--шаг-6--переменные-окружения)
8. [Шаг 7 — Первый запуск](#8--шаг-7--первый-запуск)
9. [Шаг 8 — Telegram Mini App](#9--шаг-8--telegram-mini-app)
10. [Шаг 9 — CI/CD автодеплой](#10--шаг-9--cicd-автодеплой)
11. [Шаг 10 — Мониторинг и бэкапы](#11--шаг-10--мониторинг-и-бэкапы)
12. [Справочник переменных](#12--справочник-всех-переменных)
13. [Полезные команды](#13--полезные-команды)
14. [FAQ и решение проблем](#14--faq-и-решение-проблем)

---

## 1. 📦 Что вам нужно перед стартом

| # | Что | Где получить | Стоимость |
|---|-----|-------------|-----------|
| 1 | **VPS сервер** (Ubuntu 22.04, 2 vCPU, 4GB RAM, 40GB SSD) | Aéza, Timeweb, Hetzner, DigitalOcean | ~$10–15/мес |
| 2 | **Домен** (например `masteruz.uz`) | afilias.uz, webname.uz, reg.uz | ~$15–30/год |
| 3 | **Telegram Bot** | @BotFather в Telegram | Бесплатно |
| 4 | **GitHub аккаунт** | github.com | Бесплатно |
| 5 | **Yandex Maps API ключ** (опционально) | developer.tech.yandex.ru | Бесплатно (лимит) |
| 6 | **Click/Payme** ключи (опционально, для платежей) | click.uz / payme.uz | По договору |

### Почему GitHub + VPS, а НЕ Vercel?

| | **GitHub + VPS (наш выбор)** | Vercel |
|---|---|---|
| Backend | ✅ Express + PostgreSQL + Redis — полный контроль | ❌ Только serverless functions, нет WebSockets |
| База данных | ✅ PostgreSQL в Docker на том же сервере | ⚠️ Нужен внешний сервис (Supabase/Neon) +$$ |
| Файлы/загрузки | ✅ Хранение на диске сервера | ❌ Нет persistent storage |
| Telegram Bot | ✅ Полноценный бот + webhook | ⚠️ Ограничения cold start |
| WebSocket/Chat | ✅ Поддерживается | ❌ Не поддерживается |
| Стоимость | 💰 $10–15/мес (всё включено) | 💰 $20+ (Vercel Pro + DB + Storage) |
| Масштабирование | ✅ Docker compose scale | ✅ Авто |

**Вывод**: Для fullstack Telegram Mini App — **VPS + Docker** профессиональнее и дешевле.

---

## 2. 🖥 Шаг 1 — Покупка VPS сервера

### Рекомендуемые провайдеры:

| Провайдер | Локация | Min план | Ссылка |
|-----------|---------|----------|--------|
| **Aéza** (рекомендую) | Москва/Европа | 2 vCPU, 4GB — ~$7/мес | aeza.net |
| **Timeweb Cloud** | Москва | 2 vCPU, 4GB — ~$10/мес | timeweb.cloud |
| **Hetzner** | Европа | CX22 2vCPU, 4GB — €4.5/мес | hetzner.com |
| **DigitalOcean** | Амстердам | 2vCPU, 4GB — $24/мес | digitalocean.com |

### Минимальные требования:
```
ОС:     Ubuntu 22.04 LTS (64-bit)
CPU:    2 vCPU
RAM:    4 GB (минимум 2 GB)
Диск:   40 GB SSD
Трафик: Unlimited или 3+ TB
```

### После покупки вы получите:
```
IP-адрес:     185.xxx.xxx.xxx
Пользователь: root
Пароль:       (или SSH-ключ)
```

**Запишите IP — он понадобится для DNS!**

---

## 3. 🌐 Шаг 2 — Покупка домена

### Для зоны `.uz`:
- **reg.uz** — регистрация .uz доменов
- **webname.uz** — альтернативный регистратор

### Для международных зон (.com, .io):
- **Namecheap** — namecheap.com
- **Cloudflare Registrar** — dash.cloudflare.com

### Настройка DNS (после покупки):

Зайдите в панель управления доменом и добавьте **DNS записи**:

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| **A** | `@` (или `masteruz.uz`) | `185.xxx.xxx.xxx` (IP сервера) | 300 |
| **A** | `www` | `185.xxx.xxx.xxx` (IP сервера) | 300 |

⏳ DNS обновляется за 5–30 минут (иногда до 24ч).

### Проверка DNS:
```bash
# На вашем компьютере:
nslookup masteruz.uz
# Должен показать IP вашего сервера
```

---

## 4. 🤖 Шаг 3 — Создание Telegram бота

### 3.1 Создание бота

1. Откройте Telegram, найдите **@BotFather**
2. Отправьте `/newbot`
3. Введите имя: `MasterUz — Муж на час`
4. Введите username: `MasterUzBot` (или ваш вариант)
5. **Скопируйте токен**: `1234567890:AAF-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 3.2 Настройка бота (пока без Mini App)

Отправьте @BotFather:
```
/setdescription
→ Выберите бота
→ MasterUz — Платформа для заказа бытовых услуг в Узбекистане 🇺🇿
Сантехника, электрика, ремонт, мебель — найди мастера за минуту!

/setabouttext
→ 🔧 MasterUz — сервис "Муж на час"
📱 Заказ мастера за 1 минуту
💰 Честные цены без посредников
⭐ Только проверенные мастера
🇺🇿 Работаем по всему Узбекистану

/setuserpic
→ Загрузите логотип (512x512 PNG)
```

> ⚠️ **Mini App настроим в Шаге 8** (после получения SSL сертификата)

### Запишите:
```
TELEGRAM_BOT_TOKEN=1234567890:AAF-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_BOT_USERNAME=MasterUzBot
```

---

## 5. 📤 Шаг 4 — Загрузка кода на GitHub

### 4.1 Создайте репозиторий

1. Зайдите на **github.com** → **New Repository**
2. Имя: `masteruz` (или `masteruz-platform`)
3. Visibility: **Private** (обязательно!)
4. Не инициализируйте README (у нас уже есть)

### 4.2 Загрузите код

Откройте терминал в папке проекта (`D:\MasterUz`):

```powershell
# Инициализация (если ещё нет)
git init
git branch -M main

# Добавляем remote
git remote add origin https://github.com/ВАШ_USERNAME/masteruz.git

# Первый коммит
git add .
git commit -m "🚀 MasterUz v1.0 — Initial production release"

# Пуш
git push -u origin main
```

### 4.3 Проверьте .gitignore

Убедитесь что **НЕ загружаются**:
- `node_modules/` ✅
- `.env` ✅
- `.env.production` ✅
- `uploads/*` ✅
- `dist/` ✅

---

## 6. 🖥 Шаг 5 — Настройка сервера

### 5.1 Подключение по SSH

```bash
# Windows (PowerShell):
ssh root@185.xxx.xxx.xxx

# Или через PuTTY / Windows Terminal
```

### 5.2 Автоматическая настройка

На сервере выполните:

```bash
# Скачайте и запустите скрипт:
apt update && apt install -y git curl

# Клонируйте проект
cd /opt
git clone https://github.com/ВАШ_USERNAME/masteruz.git masteruz
cd masteruz

# Запустите настройку сервера
chmod +x scripts/server-setup.sh
bash scripts/server-setup.sh
```

Скрипт автоматически:
- ✅ Обновит систему
- ✅ Установит Docker + Docker Compose
- ✅ Настроит файрвол (UFW)
- ✅ Установит fail2ban (защита от брутфорса)
- ✅ Создаст `.env.production` с автогенерированными секретами

### 5.3 Что установится:

```
Docker 24+          → контейнеризация
Docker Compose v2   → оркестрация контейнеров  
UFW                 → файрвол (порты 22, 80, 443)
fail2ban            → защита от брутфорса
Git                 → обновление кода
```

---

## 7. 🔐 Шаг 6 — Переменные окружения

### 6.1 Откройте .env.production

```bash
nano /opt/masteruz/.env.production
```

### 6.2 Заполните ВСЕ переменные:

```env
# ─── ДОМЕН ──────────────────────────────────
DOMAIN=masteruz.uz                    # ← ВАШ домен

# ─── БАЗА ДАННЫХ (автогенерирован) ──────────
DB_PASSWORD=a7f3c...                  # ← Уже заполнен скриптом

# ─── REDIS (автогенерирован) ────────────────
REDIS_PASSWORD=b4e2d...               # ← Уже заполнен скриптом

# ─── JWT (автогенерированы) ─────────────────
JWT_SECRET=e8a1b...                   # ← Уже заполнен скриптом
JWT_REFRESH_SECRET=f2c9d...           # ← Уже заполнен скриптом

# ─── TELEGRAM (заполните вручную!) ──────────
TELEGRAM_BOT_TOKEN=1234567890:AAF...  # ← Из шага 3
TELEGRAM_BOT_USERNAME=MasterUzBot     # ← Из шага 3

# ─── YANDEX MAPS (заполните если нужно) ─────
YANDEX_MAPS_API_KEY=ваш_ключ         # ← С developer.tech.yandex.ru

# ─── ПЛАТЕЖИ (заполните позже) ──────────────
CLICK_MERCHANT_ID=                    # ← Из кабинета Click
CLICK_SERVICE_ID=                     # ← Из кабинета Click
CLICK_SECRET_KEY=                     # ← Из кабинета Click
PAYME_MERCHANT_ID=                    # ← Из кабинета Payme
PAYME_MERCHANT_KEY=                   # ← Из кабинета Payme

# ─── CORS ───────────────────────────────────
CORS_ORIGIN=https://masteruz.uz      # ← Ваш домен с https://
```

Сохраните: `Ctrl+O → Enter → Ctrl+X`

---

## 8. 🚀 Шаг 7 — Первый запуск

### 7.1 Запустите деплой

```bash
cd /opt/masteruz
chmod +x scripts/deploy-init.sh
bash scripts/deploy-init.sh
```

### Скрипт автоматически:

| Шаг | Действие | Время |
|-----|----------|-------|
| 1 | Создаёт SSL директории | 1 сек |
| 2 | Запускает Nginx с временным конфигом (HTTP) | 5 сек |
| 3 | Собирает Docker образы (backend + frontend) | 3–5 мин |
| 4 | Запускает PostgreSQL + Redis | 15 сек |
| 5 | Получает SSL сертификат Let's Encrypt | 30 сек |
| 6 | Переключает Nginx на HTTPS конфиг | 2 сек |
| 7 | Запускает миграции БД | 5 сек |
| 8 | Заполняет БД начальными данными (seed) | 5 сек |
| 9 | Проверяет что всё работает | 5 сек |

### 7.2 Проверка

После успешного деплоя откройте в браузере:

```
https://masteruz.uz            → Главная страница
https://masteruz.uz/api/health → {"status":"ok"}
https://masteruz.uz/stores     → Магазины
https://masteruz.uz/catalog/plumbing → Каталог
```

### 7.3 Если что-то не работает:

```bash
# Посмотреть статус контейнеров:
docker compose -f docker-compose.prod.yml ps

# Логи бэкенда:
docker compose -f docker-compose.prod.yml logs backend

# Логи Nginx:
docker compose -f docker-compose.prod.yml logs nginx

# Перезапуск:
docker compose -f docker-compose.prod.yml restart
```

---

## 9. 📱 Шаг 8 — Telegram Mini App

> **Это делается ПОСЛЕ** получения SSL и проверки что сайт доступен по HTTPS!

### 8.1 Настройка Mini App через BotFather

Откройте @BotFather и отправьте:

```
/newapp
→ Выберите вашего бота (@MasterUzBot)
→ Название: MasterUz
→ Описание: Платформа бытовых услуг
→ Фото: загрузите скриншот 640x360
→ GIF: пропустите (отправьте любое фото)
→ URL: https://masteruz.uz
→ Short name: app
```

### 8.2 Настройка кнопки Menu

```
/setmenubutton
→ Выберите бота
→ Выберите тип: Web App
→ URL: https://masteruz.uz
→ Текст кнопки: 🔧 Открыть MasterUz
```

### 8.3 Настройка inline-кнопки (опционально)

```
/setinline
→ Выберите бота
→ placeholder: Найти мастера...
```

### 8.4 Проверка

1. Откройте вашего бота в Telegram
2. Нажмите кнопку **"🔧 Открыть MasterUz"** внизу
3. Должно открыться ваше приложение внутри Telegram
4. Авторизация произойдёт **автоматически** (через `initData`)

### Что происходит при авторизации:

```
Пользователь открывает Mini App
  → Telegram передаёт initData (зашифрованные данные)
  → Frontend отправляет initData на /api/auth/mini-app
  → Backend верифицирует подпись через Bot Token
  → Создаётся/находится пользователь в БД
  → Возвращается JWT токен
  → Пользователь авторизован ✅
```

---

## 10. 🔄 Шаг 9 — CI/CD автодеплой

### 9.1 SSH ключ для деплоя

На вашем **компьютере**:
```powershell
ssh-keygen -t ed25519 -C "deploy@masteruz" -f $HOME\.ssh\masteruz_deploy
```

На **сервере**:
```bash
# Добавьте публичный ключ
nano ~/.ssh/authorized_keys
# Вставьте содержимое masteruz_deploy.pub
```

### 9.2 GitHub Secrets

Зайдите в **GitHub → Settings → Secrets and variables → Actions** и добавьте:

| Secret Name | Значение | Откуда |
|-------------|----------|--------|
| `SERVER_HOST` | `185.xxx.xxx.xxx` | IP вашего сервера |
| `SERVER_USER` | `root` | Пользователь SSH |
| `SERVER_SSH_KEY` | Содержимое файла `masteruz_deploy` (private key) | Файл из 9.1 |
| `TELEGRAM_BOT_USERNAME` | `MasterUzBot` | Из шага 3 |
| `YANDEX_MAPS_API_KEY` | Ваш ключ | developer.tech.yandex.ru |

### 9.3 Как работает автодеплой

```
git push origin main
  → GitHub Actions запускается
  → Job 1: Тесты (107 тестов) ✅
  → Job 2: Сборка Docker образов + Push в GHCR ✅
  → Job 3: SSH на сервер → pull → restart контейнеров ✅
```

Теперь каждый `git push` в `main` **автоматически** деплоит на сервер!

### 9.4 Ручной деплой (если нужно)

```bash
# На сервере:
cd /opt/masteruz
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
```

---

## 11. 📊 Шаг 10 — Мониторинг и бэкапы

### 10.1 Автоматические бэкапы

```bash
# Настройте ежедневный бэкап в 3:00 AM:
crontab -e

# Добавьте строку:
0 3 * * * /opt/masteruz/scripts/backup.sh >> /var/log/masteruz-backup.log 2>&1
```

### 10.2 Автообновление SSL

Certbot контейнер уже настроен — обновляет сертификаты каждые 12 часов.

### 10.3 Мониторинг (бесплатно)

```bash
# Проверка статуса:
docker compose -f docker-compose.prod.yml ps

# Мониторинг ресурсов:
docker stats

# Логи в реальном времени:
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

### 10.4 Health check эндпоинт

```
GET https://masteruz.uz/api/health
→ {"status":"ok","timestamp":"...","version":"1.0.0"}
```

Можно подключить бесплатный UptimeRobot (uptimerobot.com) для мониторинга 24/7.

---

## 12. 📋 Справочник ВСЕХ переменных

### Файл: `.env.production` (корень проекта, на сервере)

| Переменная | Описание | Пример | Обязательна |
|-----------|----------|--------|-------------|
| `DOMAIN` | Домен сайта | `masteruz.uz` | ✅ |
| `DB_PASSWORD` | Пароль PostgreSQL | `a7f3c9e2...` (32 hex) | ✅ |
| `REDIS_PASSWORD` | Пароль Redis | `b4e2d1f8...` (24 hex) | ✅ |
| `JWT_SECRET` | Секрет JWT токенов | `e8a1b3c4...` (64 hex) | ✅ |
| `JWT_REFRESH_SECRET` | Секрет refresh токенов | `f2c9d5a7...` (64 hex) | ✅ |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота | `1234567890:AAF-xxx` | ✅ |
| `TELEGRAM_BOT_USERNAME` | Username бота | `MasterUzBot` | ✅ |
| `YANDEX_MAPS_API_KEY` | Ключ Yandex Maps | `abcdef12-3456-...` | ⬜ |
| `CLICK_MERCHANT_ID` | Click Merchant ID | `12345` | ⬜ |
| `CLICK_SERVICE_ID` | Click Service ID | `67890` | ⬜ |
| `CLICK_SECRET_KEY` | Click Secret | `secret123` | ⬜ |
| `PAYME_MERCHANT_ID` | Payme Merchant ID | `abc123...` | ⬜ |
| `PAYME_MERCHANT_KEY` | Payme Key | `def456...` | ⬜ |
| `CORS_ORIGIN` | Разрешённый origin | `https://masteruz.uz` | ✅ |

> ✅ = обязательна для запуска, ⬜ = опциональна (платежи, карты)

### Переменные внутри Docker (автоматически)

Эти переменные **НЕ НУЖНО** заполнять вручную — они берутся из `.env.production` и подставляются в `docker-compose.prod.yml`:

| Переменная | Контейнер | Значение |
|-----------|-----------|----------|
| `NODE_ENV` | backend | `production` |
| `PORT` | backend | `3000` |
| `DATABASE_URL` | backend | `postgresql://masteruz:{DB_PASSWORD}@postgres:5432/masteruz` |
| `REDIS_URL` | backend | `redis://:{REDIS_PASSWORD}@redis:6379` |
| `UPLOAD_DIR` | backend | `/app/uploads` |
| `VITE_API_URL` | frontend (build) | `/api` |

### GitHub Secrets (для CI/CD)

| Secret | Значение |
|--------|----------|
| `SERVER_HOST` | IP сервера |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | Private SSH key |
| `TELEGRAM_BOT_USERNAME` | Username бота |
| `YANDEX_MAPS_API_KEY` | Yandex Maps key |

---

## 13. 🛠 Полезные команды

```bash
# ─── Управление ─────────────────────────────
cd /opt/masteruz

# Запуск
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Остановка
docker compose -f docker-compose.prod.yml down

# Перезапуск
docker compose -f docker-compose.prod.yml restart

# Пересборка
docker compose -f docker-compose.prod.yml up -d --build

# ─── Логи ───────────────────────────────────
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres

# ─── База данных ────────────────────────────
# Prisma миграции
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Prisma Studio (GUI для БД)
docker compose -f docker-compose.prod.yml exec backend npx prisma studio

# SQL консоль
docker compose -f docker-compose.prod.yml exec postgres psql -U masteruz masteruz

# ─── Бэкап / Восстановление ────────────────
# Бэкап
bash scripts/backup.sh

# Восстановление
gunzip < backups/masteruz_20260213.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U masteruz masteruz

# ─── Обновление ─────────────────────────────
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
```

---

## 14. ❓ FAQ и решение проблем

### SSL сертификат не выдаётся
```
Причина: DNS ещё не обновился
Решение: Подождите 30 мин, проверьте: nslookup masteruz.uz
```

### Backend не запускается
```bash
docker compose -f docker-compose.prod.yml logs backend
# Частые причины:
# - DATABASE_URL неправильный → проверьте DB_PASSWORD
# - Миграции не выполнены → npx prisma migrate deploy
```

### 502 Bad Gateway
```bash
# Проверьте что backend запущен:
docker compose -f docker-compose.prod.yml ps
# Если backend exited — смотрите логи:
docker compose -f docker-compose.prod.yml logs backend
```

### Telegram Mini App не открывается
```
1. Проверьте что HTTPS работает: https://masteruz.uz
2. Убедитесь что URL в @BotFather точно совпадает с доменом
3. Telegram требует валидный SSL (Let's Encrypt подходит)
```

### Как добавить нового администратора?
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U masteruz masteruz -c \
  "UPDATE users SET role='ADMIN' WHERE username='имя_пользователя';"
```

---

## 🏗 Структура файлов для продакшна

```
MasterUz/
├── .github/workflows/
│   └── deploy.yml              ← CI/CD pipeline
├── backend/
│   ├── Dockerfile              ← Multi-stage Docker build
│   ├── prisma/
│   │   ├── schema.prisma       ← 31 модель базы данных
│   │   ├── migrations/         ← SQL миграции
│   │   └── seed.ts             ← Начальные данные
│   └── src/                    ← Express API (20 модулей)
├── frontend/
│   ├── Dockerfile              ← React build → Nginx
│   ├── nginx.conf              ← SPA routing + API proxy
│   └── src/                    ← React SPA (34 страницы)
├── nginx/
│   ├── nginx.conf              ← Main Nginx config
│   └── conf.d/
│       ├── masteruz.conf       ← SSL + reverse proxy
│       └── masteruz-init-ssl.conf ← Временный (для certbot)
├── scripts/
│   ├── server-setup.sh         ← Установка сервера
│   ├── deploy-init.sh          ← Первый запуск
│   └── backup.sh               ← Бэкап БД
├── docker-compose.yml          ← Development
├── docker-compose.prod.yml     ← Production
├── .env.production.example     ← Шаблон переменных
└── DEPLOY.md                   ← Эта инструкция
```

---

**Готово! 🎉** Следуйте шагам 1–10 последовательно, и ваша платформа MasterUz будет работать в продакшне как Telegram Mini App с SSL, автоматическими бэкапами и CI/CD деплоем.
