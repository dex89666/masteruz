// ============================================
// MasterUz — Главная точка входа (Express App)
// Агент 10 (Интегратор)
// ============================================

// BigInt сериализация для JSON (telegramId в Prisma = BigInt)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// Sentry — должен быть инициализирован максимально рано
import { Sentry, sentryEnabled } from './services/sentry.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { Options as RateLimitOptions, Store } from 'express-rate-limit';
import path from 'path';

import { config } from './config/index.js';
import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { checkUserActive } from './middleware/auth.js';
import { betaGate } from './middleware/betaGate.js';
import { startAutoCancellationJob, stopAutoCancellationJob } from './services/orderAutoCancellation.js';
import { startCleanupJob, stopCleanupJob } from './services/cleanupJob.js';

// Импорт маршрутов модулей
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import referralsRoutes from './modules/referrals/referrals.routes.js';
import ratingsRoutes from './modules/ratings/ratings.routes.js';
import riskRoutes from './modules/risk/risk.routes.js';
import geoRoutes from './modules/geo/geo.routes.js';
import schoolRoutes from './modules/school/school.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import photosRoutes from './modules/photos/photos.routes.js';
import favoritesRoutes from './modules/favorites/favorites.routes.js';
import promoRoutes from './modules/promo/promo.routes.js';
import guaranteesRoutes from './modules/guarantees/guarantees.routes.js';
import portfolioRoutes from './modules/portfolio/portfolio.routes.js';
import balanceRoutes from './modules/balance/balance.routes.js';
import onlineStatusRoutes from './modules/users/onlineStatus.routes.js';
import storesRoutes from './modules/stores/stores.routes.js';
import turnkeyRoutes from './modules/turnkey/turnkey.routes.js';
import estimationRoutes from './modules/estimation/estimation.routes.js';
import instantOrderRoutes from './modules/instant-order/instant-order.routes.js';
import supportChatRoutes from './modules/support/support.routes.js';
import forumRoutes from './modules/forum/forum.routes.js';
import cardsRoutes from './modules/cards/cards.routes.js';
import localRegistryRoutes from './modules/local-registry/local-registry.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';
import complaintsRoutes from './modules/complaints/complaints.routes.js';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes.js';
import appVersionRoutes from './modules/app-version/app-version.routes.js';

const app = express();

// ─── Глобальные Middleware ─────────────────────

// Доверие к прокси Railway/Nginx — иначе req.ip = адрес прокси,
// и rate-limiter забанит ВСЕХ пользователей разом. 'loopback, linklocal, uniquelocal'
// доверяет только internal-адресам Railway, не подделке X-Forwarded-For извне.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

// Безопасность: HSTS на год + усиленные заголовки
app.use(helmet({
  contentSecurityPolicy: false, // SPA + Yandex Maps + Telegram WebApp — отключаем CSP, чтобы не ломать встроенные виджеты
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Сжатие ответов
app.use(compression({
  level: 6,
  threshold: 1024, // Сжимаем ответы > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// CORS
const corsOrigins = config.corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
// Защита: в проде запрещаем wildcard '*' — иначе браузеры с credentials отправят токены кому угодно.
if (config.env === 'production' && (corsOrigins.includes('*') || corsOrigins.length === 0)) {
  throw new Error('FATAL: CORS_ORIGIN не должен быть пустым или "*" в production');
}
// Capacitor Android/iOS webview шлёт Origin: https://localhost, http://localhost, capacitor://localhost
// или вовсе без Origin (file://). Их разрешаем безусловно — это родное приложение MasterUz.
const CAPACITOR_ORIGINS = new Set([
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]);
app.use(cors({
  origin: (origin, callback) => {
    // Запросы без Origin (мобильные webview, server-to-server, curl) — пропускаем
    if (!origin) return callback(null, true);
    if (CAPACITOR_ORIGINS.has(origin)) return callback(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} не разрешён`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Парсинг тела запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiting (в test-окружении отключаем, чтобы интеграционные тесты не били о лимиты)
if (process.env.NODE_ENV !== 'test') {
  // ─── Redis-backed store (общий для всех воркеров, переживает рестарт) ───
  // Если Redis недоступен — fallback на MemoryStore (с предупреждением)
  let redisStoreFactory: ((prefix: string) => Store | undefined) | null = null;
  try {
    // Подключаемся к тому же Redis, что и для бизнес-логики
    const IoRedis = require('ioredis');
    const IoRedisClass = IoRedis.default || IoRedis;
    const rlClient = new IoRedisClass(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });
    rlClient.on('error', (err: Error) => logger.warn({ err: err.message }, 'Rate-limit Redis error'));

    const { default: RedisStore } = require('rate-limit-redis');
    redisStoreFactory = (prefix: string) =>
      new RedisStore({
        sendCommand: (...args: string[]) => rlClient.call(...args),
        prefix: `rl:${prefix}:`,
      });
    logger.info('Rate Limiting: Redis-backed store (production-ready)');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Rate Limiting: fallback to MemoryStore (после рестарта счётчики сбросятся!)');
  }

  const makeLimiter = (prefix: string, opts: Partial<RateLimitOptions>) =>
    rateLimit({
      standardHeaders: true,
      legacyHeaders: false,
      store: redisStoreFactory?.(prefix),
      // Per-user когда возможно (один NAT = тысячи клиентов; IP-only режет всех разом)
      keyGenerator: (req) => {
        const userId = (req as any).user?.userId as string | undefined;
        return userId ? `u:${userId}` : `ip:${req.ip ?? 'unknown'}`;
      },
      ...opts,
    });

  // Rate Limiting — глобальный лимит
  const globalLimiter = makeLimiter('global', {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000, // Максимум 1000 запросов с одного IP (SPA делает 5-10 вызовов/страницу)
    message: {
      success: false,
      error: { message: 'Слишком много запросов, попробуйте позже', statusCode: 429 },
    },
  });
  app.use('/api/', globalLimiter);

  // Rate Limiting — строгий лимит для авторизации (только login-эндпоинты)
  const authLimiter = makeLimiter('auth', {
    windowMs: 15 * 60 * 1000,
    max: 10, // Максимум 10 попыток за 15 минут
    message: {
      success: false,
      error: { message: 'Слишком много попыток входа, попробуйте позже', statusCode: 429 },
    },
    skip: (req) => {
      // /auth/me и /auth/switch-role не считаются login-попытками
      const p = req.path;
      return p === '/me' || p === '/switch-role' || p === '/refresh';
    },
  });
  app.use('/api/auth', authLimiter);

  // Rate Limiting — лимит для создания заказов.
  // Важно: применяется ТОЛЬКО к POST /api/orders (создание),
  // иначе расходуется на чтение, отклики, принятие и любые другие экшены —
  // и мастер не может принять заказ через 20 кликов по странице.
  const createOrderLimiter = makeLimiter('orders', {
    windowMs: 60 * 60 * 1000, // 1 час
    max: 20, // Максимум 20 заказов в час
    message: {
      success: false,
      error: { message: 'Превышен лимит создания заказов', statusCode: 429 },
    },
    // Skip всё, что не является корневым POST (т.е. POST /api/orders/)
    skip: (req) => !(req.method === 'POST' && (req.path === '/' || req.path === '')),
  });
  app.use('/api/orders', createOrderLimiter);

  // Rate Limiting — строгий лимит для финансовых операций (платежи, баланс)
  const financeLimiter = makeLimiter('finance', {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 30, // Максимум 30 запросов за 15 минут
    message: {
      success: false,
      error: { message: 'Превышен лимит финансовых операций', statusCode: 429 },
    },
  });
  app.use('/api/payments', financeLimiter);
  app.use('/api/balance', financeLimiter);

  // Rate Limiting — лимит загрузки файлов (тяжёлые операции)
  const uploadLimiter = makeLimiter('upload', {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 30, // Максимум 30 загрузок за 15 минут
    message: {
      success: false,
      error: { message: 'Превышен лимит загрузки файлов', statusCode: 429 },
    },
  });
  app.use('/api/photos', uploadLimiter);
  app.use('/api/portfolio', uploadLimiter);

  // Rate Limiting — лимит для заявок на партнёрство (антиспам)
  const partnerRequestLimiter = makeLimiter('partner', {
    windowMs: 60 * 60 * 1000, // 1 час
    max: 3, // Максимум 3 заявки в час с одного IP
    message: {
      success: false,
      error: { message: 'Слишком много заявок, попробуйте позже', statusCode: 429 },
    },
  });
  app.use('/api/stores/partner-request', partnerRequestLimiter);
}

// Статические файлы (загрузки)
app.use('/uploads', express.static(path.resolve(config.upload.dir)));

// Request logging (dev only)
if (config.env === 'development') {
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, url: req.url }, '→ Request');
    next();
  });
}

// ─── Глобальная проверка активности пользователя ───
// Применяется ко всем маршрутам кроме /api/auth и /api/health
// Если JWT есть и пользователь заблокирован — 403
app.use('/api', (req, res, next) => {
  // Пропускаем auth-маршруты и healthcheck — они должны работать всегда
  if (req.path.startsWith('/auth') || req.path === '/health') {
    return next();
  }
  // Пропускаем payment webhooks (без JWT, проверяются подписью)
  if (req.path.startsWith('/payments/webhook')) {
    return next();
  }
  // Проверяем только если есть Authorization header (authenticated requests)
  if (req.headers.authorization) {
    return checkUserActive(req, res, next);
  }
  next();
});

// ─── Маршруты API ──────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', betaGate, ordersRoutes);
app.use('/api/payments', betaGate, paymentsRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/reviews', ratingsRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/guarantees', guaranteesRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/users', onlineStatusRoutes); // Heartbeat, go-offline, online-masters
app.use('/api/stores', storesRoutes);
app.use('/api/turnkey', turnkeyRoutes);
app.use('/api/estimation', estimationRoutes);
app.use('/api/instant-order', instantOrderRoutes);
app.use('/api/support-chat', supportChatRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/local-registry', localRegistryRoutes);
app.use('/api/app', appVersionRoutes);

// ─── Healthcheck ───────────────────────────────
// /api/health/live   — лёгкий liveness probe (просто 200, без БД)
// /api/health/ready  — readiness probe (DB+Redis ping; 503 если упало)
// /api/health        — alias на /ready для обратной совместимости

app.get('/api/health/live', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

app.get(['/api/health', '/api/health/ready'], async (_req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  try {
    const { getRedis } = await import('./config/redis.js');
    const redis = getRedis();
    const pong = await redis.ping();
    if (pong !== 'PONG') redisStatus = 'degraded';
  } catch {
    redisStatus = 'unavailable';
  }

  const overallStatus = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(overallStatus === 'ok' ? 200 : 503).json({
    success: overallStatus === 'ok',
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.env,
      runtime: 'node',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
  });
});

// ─── Обработчики ошибок ────────────────────────

app.use(notFoundHandler);

// Sentry — захватывает все необработанные ошибки до errorHandler
if (sentryEnabled) {
  app.use(((err: any, _req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // Игнорируем ожидаемые ошибки клиента (4xx)
    const status = err?.statusCode || err?.status || 500;
    if (status >= 500) Sentry.captureException(err);
    next(err);
  }) as express.ErrorRequestHandler);
}

app.use(errorHandler);

// ─── Запуск сервера ────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  // Обычный запуск (Railway / VPS / Docker / локальная разработка)
  async function bootstrap() {
    try {
      await prisma.$connect();
      logger.info('✅ PostgreSQL подключён');

      // Идемпотентный auto-seed каталога: если категорий нет — посеять.
      // Безопасно повторно: внутри сидера используется upsert.
      try {
        const categoryCount = await prisma.category.count();
        if (categoryCount === 0) {
          logger.warn('⚠️ Категории не найдены в БД — запускаю auto-seed каталога…');
          const { seedCatalog } = await import('./utils/catalogSeeder.js');
          await seedCatalog(prisma);
          logger.info('✅ Каталог посеян автоматически');
        }
      } catch (seedErr) {
        logger.error({ err: seedErr }, '⚠️ Auto-seed каталога не удался — продолжаем запуск');
      }

      const server = app.listen(config.port, config.host, () => {
        logger.info(`🚀 MasterUz Backend запущен на ${config.host}:${config.port}`);
        logger.info(`📝 Среда: ${config.env}`);
        logger.info(`🔗 API: http://${config.host}:${config.port}/api`);
      });
      // KeepAlive за load-balancer'ом Railway/Cloudflare: keepAliveTimeout > idle прокси,
      // headersTimeout > keepAliveTimeout. Иначе клиент получает 502 при reuse соединения.
      server.keepAliveTimeout = 65_000;
      server.headersTimeout = 70_000;
      // Долгие операции (импорт каталога, отчёты) — до 60с, остальное по умолчанию
      server.requestTimeout = 60_000;

      // Фоновая задача: авто-отмена «зависших» заказов с возвратом эскроу
      startAutoCancellationJob();
      // Фоновая задача: уборка устаревших уведомлений/журналов доставки
      startCleanupJob();
    } catch (error) {
      logger.error({ error }, '❌ Ошибка запуска сервера');
      process.exit(1);
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM получен, завершаю...');
    stopAutoCancellationJob();
    stopCleanupJob();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT получен, завершаю...');
    stopAutoCancellationJob();
    stopCleanupJob();
    await prisma.$disconnect();
    process.exit(0);
  });

  bootstrap();
}

export default app;
