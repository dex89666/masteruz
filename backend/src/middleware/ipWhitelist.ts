import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Нормализует IP: убирает IPv4-mapped IPv6 префикс (::ffff:185.234.113.1 → 185.234.113.1)
 * и обрезает пробелы. Без этого Payme-вебхуки могут получить 403, т.к. Node на
 * dual-stack сокете отдаёт адреса в IPv4-mapped форме.
 */
function normalizeIp(ip: string): string {
  const trimmed = (ip || '').trim();
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : trimmed;
}

// Ожидается переменная PAYME_WEBHOOK_WHITELIST = "ip1,ip2,ip3"
export function ipWhitelist(req: Request, res: Response, next: NextFunction) {
  const raw = process.env.PAYME_WEBHOOK_WHITELIST || '';
  if (!raw) return next(); // не настроено — пропускаем

  const list = raw.split(',').map((s) => normalizeIp(s)).filter(Boolean);
  const rawIp = req.ip || (req.socket && req.socket.remoteAddress) || '';
  const ip = normalizeIp(rawIp);

  if (!list.includes(ip)) {
    logger.warn({ ip, rawIp, allowed: list }, '🚨 SECURITY: request from non-whitelisted IP');
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}
