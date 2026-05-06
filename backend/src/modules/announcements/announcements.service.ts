// ============================================
// MasterUz — Announcements Service
// Лента акций / анонсов. Хранение — JSON-файл в backend/data/announcements.json.
// Рассылка — Telegram (через существующий sendTelegramMessage).
// ============================================

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { sendTelegramMessage } from '../../utils/telegramBot.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/ApiError.js';

const FILE = path.resolve(process.cwd(), 'data', 'announcements.json');

export type Audience = 'ALL' | 'CLIENT' | 'MASTER' | 'STORE';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  audience: Audience;
  city?: string;             // фильтр по городу/району
  isActive: boolean;
  publishedAt: string;
  createdBy: string;
  // Статистика рассылки
  broadcastCount: number;
  broadcastFailed: number;
  broadcastedAt?: string;
}

let writeMutex: Promise<void> = Promise.resolve();

async function readAll(): Promise<Announcement[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(items: Announcement[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf-8');
  await fs.rename(tmp, FILE);
}

async function mutate(fn: (items: Announcement[]) => Announcement[]) {
  const next = writeMutex.then(async () => {
    const items = await readAll();
    await writeAll(fn(items));
  });
  writeMutex = next.catch(() => {});
  await next;
}

function requireString(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string') throw ApiError.badRequest(`Поле "${field}" обязательно`);
  const t = v.trim();
  if (!t) throw ApiError.badRequest(`Поле "${field}" не может быть пустым`);
  if (t.length > max) throw ApiError.badRequest(`Поле "${field}" слишком длинное (макс. ${max})`);
  return t;
}

export const announcementsService = {
  async list(opts?: { activeOnly?: boolean; audience?: Audience }): Promise<Announcement[]> {
    let items = await readAll();
    if (opts?.activeOnly) items = items.filter((a) => a.isActive);
    if (opts?.audience && opts.audience !== 'ALL') {
      items = items.filter((a) => a.audience === 'ALL' || a.audience === opts.audience);
    }
    return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },

  async create(input: {
    title: string;
    body: string;
    imageUrl?: string;
    audience?: Audience;
    city?: string;
    createdBy: string;
  }): Promise<Announcement> {
    const record: Announcement = {
      id: crypto.randomUUID(),
      title: requireString(input.title, 'title', 200),
      body: requireString(input.body, 'body', 4000),
      imageUrl: input.imageUrl ? requireString(input.imageUrl, 'imageUrl', 500) : undefined,
      audience: input.audience || 'ALL',
      city: input.city ? requireString(input.city, 'city', 100) : undefined,
      isActive: true,
      publishedAt: new Date().toISOString(),
      createdBy: input.createdBy,
      broadcastCount: 0,
      broadcastFailed: 0,
    };
    await mutate((items) => [...items, record]);
    return record;
  },

  async setActive(id: string, isActive: boolean): Promise<Announcement | null> {
    let updated: Announcement | null = null;
    await mutate((items) =>
      items.map((a) => {
        if (a.id !== id) return a;
        updated = { ...a, isActive };
        return updated;
      }),
    );
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    let removed = false;
    await mutate((items) => {
      const next = items.filter((a) => a.id !== id);
      removed = next.length !== items.length;
      return next;
    });
    return removed;
  },

  /**
   * Рассылка анонса в Telegram целевой аудитории.
   * Не падает целиком, если кому-то не удалось доставить — собирает статистику.
   */
  async broadcast(id: string): Promise<{ sent: number; failed: number; total: number }> {
    const items = await readAll();
    const announcement = items.find((a) => a.id === id);
    if (!announcement) throw ApiError.notFound('Анонс не найден');

    // Подбираем получателей из БД
    const where: any = { isActive: true, telegramId: { not: null } };
    if (announcement.audience === 'CLIENT') where.role = 'CLIENT';
    if (announcement.audience === 'MASTER') where.role = 'MASTER';
    if (announcement.city) {
      where.profile = { city: { contains: announcement.city, mode: 'insensitive' } };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, telegramId: true },
      take: 5000,
    });

    const text = `📢 <b>${escapeHtml(announcement.title)}</b>\n\n${escapeHtml(announcement.body)}`;

    let sent = 0;
    let failed = 0;
    // Telegram лимит ~30 сообщений/сек — батч с паузами
    for (const u of users) {
      if (!u.telegramId) continue;
      const ok = await sendTelegramMessage({
        chatId: u.telegramId,
        text,
        parseMode: 'HTML',
      });
      ok ? sent++ : failed++;
      // 50ms между сообщениями (~20 msg/sec, ниже лимита)
      await sleep(50);
    }

    await mutate((arr) =>
      arr.map((a) =>
        a.id === id
          ? {
              ...a,
              broadcastCount: a.broadcastCount + sent,
              broadcastFailed: a.broadcastFailed + failed,
              broadcastedAt: new Date().toISOString(),
            }
          : a,
      ),
    );

    logger.info({ id, sent, failed, total: users.length }, 'Announcement broadcast завершён');

    return { sent, failed, total: users.length };
  },
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
