// ============================================
// MasterUz — Beta Access Middleware
// Закрытое тестирование: только пользователи из whitelist (по district / phone / userId)
// могут создавать заказы и регистрироваться как мастера.
// Конфиг — через PlatformConfig.beta_* (без хардкода).
// ============================================

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';
import { isSuperAdmin } from '../utils/helpers.js';

interface BetaConfig {
  enabled: boolean;
  allowedDistricts: string[];
  allowedPhones: string[];
  allowedUserIds: string[];
}

let cache: { config: BetaConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function loadConfig(): Promise<BetaConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.config;

  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: ['beta_enabled', 'beta_districts', 'beta_phones', 'beta_user_ids'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const config: BetaConfig = {
    enabled: map.get('beta_enabled') === 'true',
    allowedDistricts: (map.get('beta_districts') || '').split(',').map((s) => s.trim()).filter(Boolean),
    allowedPhones: (map.get('beta_phones') || '').split(',').map((s) => s.trim()).filter(Boolean),
    allowedUserIds: (map.get('beta_user_ids') || '').split(',').map((s) => s.trim()).filter(Boolean),
  };

  cache = { config, expiresAt: Date.now() + CACHE_TTL_MS };
  return config;
}

/**
 * Гейт закрытого тестирования. Если beta_enabled=false — пропускает всех.
 * Если включено — пропускает только админов / суперадминов / whitelisted.
 *
 * Использование: app.use('/api/orders', betaGate, ordersRoutes);
 */
export async function betaGate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const cfg = await loadConfig();
    if (!cfg.enabled) return next();

    const userId = req.user?.userId;
    // Анонимных пропускаем — их зарежет authenticate в защищённых роутах.
    // Гейт реагирует только на залогиненных пользователей.
    if (!userId) return next();

    // 1) явный whitelist по userId
    if (cfg.allowedUserIds.includes(userId)) return next();

    // 2) админы и менеджеры — всегда
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true, phone: true, profile: { select: { city: true } } },
    });
    if (!user) return next(ApiError.forbidden('Пользователь не найден'));
    if (user.role === 'ADMIN' || user.role === 'MANAGER') return next();
    if (isSuperAdmin(user.username)) return next();

    // 3) whitelist по телефону
    if (user.phone && cfg.allowedPhones.includes(user.phone)) return next();

    // 4) whitelist по району/городу — beta_districts хранит подстроки (Ташкент/Чиланзар/…)
    if (cfg.allowedDistricts.length && user.profile?.city) {
      const cityLower = user.profile.city.toLowerCase();
      const matched = cfg.allowedDistricts.some((d) => cityLower.includes(d.toLowerCase()));
      if (matched) return next();
    }

    return next(
      ApiError.forbidden(
        'Сейчас идёт закрытое тестирование. Свяжитесь с поддержкой, чтобы получить ранний доступ.',
      ),
    );
  } catch (err) {
    next(err);
  }
}

export function clearBetaCache() {
  cache = null;
}
