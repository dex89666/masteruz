# 🔧 MasterUz — Экосистема "Муж на час"

> Платформа-посредник для соединения клиентов с мастерами бытовых и строительных услуг в Узбекистане.

## 📋 Содержание

- [Архитектура](#архитектура)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [API документация](#api-документация)
- [Деплой](#деплой)

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────┐
│                    КЛИЕНТЫ                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Веб-сайт    │  │ Telegram     │  │  Админ-   │  │
│  │  (React)     │  │ Mini App     │  │  панель   │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
└─────────┼─────────────────┼────────────────┼────────┘
          │                 │                │
          ▼                 ▼                ▼
┌─────────────────────────────────────────────────────┐
│              API Gateway (Nginx)                     │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Backend (Node.js + Express)              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Auth  │ │ Orders │ │Payment │ │  Referral     │  │
│  │Module  │ │Module  │ │Module  │ │  Module       │  │
│  └────────┘ └────────┘ └────────┘ └──────────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Rating │ │  Geo   │ │ Admin  │ │  School      │  │
│  │Module  │ │Module  │ │Module  │ │  Module       │  │
│  └────────┘ └────────┘ └────────┘ └──────────────┘  │
└─────────────────────┬───────────────────────────────┘
                      │
     ┌────────────────┼────────────────┐
     ▼                ▼                ▼
┌─────────┐   ┌──────────┐   ┌──────────────┐
│PostgreSQL│   │  Redis   │   │ File Storage │
│  (БД)   │   │ (Кэш)   │   │  (Uploads)   │
└─────────┘   └──────────┘   └──────────────┘
```

## 🛠 Технологический стек

| Компонент | Технология |
|-----------|------------|
| Фронтенд | React 18 + TypeScript + Vite |
| Бэкенд | Node.js + Express + TypeScript |
| БД | PostgreSQL 15 + Prisma ORM |
| Кэш | Redis 7 |
| Карты | Yandex Maps API |
| Платежи | Click, Payme, Telegram Stars |
| Авторизация | Telegram Login + JWT |
| Деплой | Docker + Docker Compose + Nginx |

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (опционально)

### Запуск через Docker

```bash
# Клонируйте репозиторий
git clone <repo-url>
cd MasterUz

# Скопируйте env-файлы
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Отредактируйте .env — укажите TELEGRAM_BOT_TOKEN и другие ключи

# Запустите через Docker Compose
docker-compose up -d

# Система автоматически применит миграции при старте
# Для заполнения начальных данных:
docker exec masteruz-backend npx prisma db seed
```

### Запуск вручную

```bash
# 1. Запустите PostgreSQL и Redis (через Docker или локально)
docker-compose up -d postgres redis

# 2. Backend
cd backend
cp .env.example .env   # Отредактируйте: DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed     # Заполнение категорий, курсов, конфигурации
npm run dev

# 3. Frontend (в новом терминале)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Приложение будет доступно:
- Фронтенд: http://localhost:5173
- Бэкенд API: http://localhost:3000/api
- API Health: http://localhost:3000/api/health
- Админ-панель: http://localhost:5173/admin

### i18n (Мультиязычность)

Платформа поддерживает 3 языка:
- 🇷🇺 Русский (по умолчанию)
- 🇺🇿 O'zbek
- 🇬🇧 English

Переключатель языков находится в шапке приложения.

## 📁 Структура проекта

```
MasterUz/
├── backend/                 # Серверная часть
│   ├── prisma/             # Схема и миграции БД
│   ├── src/
│   │   ├── config/         # Конфигурация
│   │   ├── middleware/     # Express middleware
│   │   ├── modules/        # Бизнес-модули
│   │   │   ├── auth/       # Авторизация
│   │   │   ├── users/      # Пользователи
│   │   │   ├── orders/     # Заказы (лоты)
│   │   │   ├── payments/   # Платежи
│   │   │   ├── referrals/  # Реферальная система
│   │   │   ├── ratings/    # Рейтинги и отзывы
│   │   │   ├── geo/        # Геолокация
│   │   │   ├── school/     # Школа мастеров
│   │   │   └── admin/      # Админ-панель
│   │   ├── utils/          # Утилиты
│   │   └── app.ts          # Точка входа
│   └── package.json
├── frontend/                # Клиентская часть
│   ├── src/
│   │   ├── components/     # UI-компоненты
│   │   ├── pages/          # Страницы
│   │   ├── hooks/          # React-хуки
│   │   ├── store/          # Состояние (Zustand)
│   │   ├── api/            # API-клиент
│   │   ├── i18n/           # Мультиязычность (ru/uz/en)
│   │   ├── types/          # TypeScript типы
│   │   └── App.tsx         # Роутинг
│   └── package.json
├── docs/                    # Документация
├── docker-compose.yml       # Docker конфигурация
└── README.md
```

## 📄 Лицензия

Проприетарное ПО. Все права защищены.
