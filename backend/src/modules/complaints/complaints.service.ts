// ============================================
// MasterUz — Complaints Service
// Юридические жалобы и обращения. Хранение в JSON + уведомление в Telegram.
// ============================================

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { sendTelegramMessage } from '../../utils/telegramBot.js';
import { alertRouter } from '../../services/alertRouter.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'complaints.json');

export type ComplaintStatus = 'new' | 'in_review' | 'resolved' | 'rejected';

export interface ComplaintRecord {
  id: string;
  subject: string;
  description: string;
  contact: string;       // телефон или email заявителя
  fullName?: string;
  orderId?: string;
  ip: string;
  userAgent: string;
  status: ComplaintStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

let writeChain: Promise<void> = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<ComplaintRecord[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(records: ComplaintRecord[]): Promise<void> {
  await ensureDir();
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), 'utf-8');
  await fs.rename(tmp, FILE);
}

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(() => undefined, () => undefined);
  return next;
}

function validateNonEmpty(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ApiError(400, `${field}: обязательное строковое поле`);
  const trimmed = value.trim();
  if (!trimmed) throw new ApiError(400, `${field}: не должно быть пустым`);
  if (trimmed.length > max) throw new ApiError(400, `${field}: максимум ${max} символов`);
  return trimmed;
}

export const complaintsService = {
  async create(input: {
    subject: string;
    description: string;
    contact: string;
    fullName?: string;
    orderId?: string;
    ip: string;
    userAgent: string;
  }): Promise<ComplaintRecord> {
    const record: ComplaintRecord = {
      id: crypto.randomUUID(),
      subject: validateNonEmpty(input.subject, 'subject', 200),
      description: validateNonEmpty(input.description, 'description', 5000),
      contact: validateNonEmpty(input.contact, 'contact', 200),
      fullName: input.fullName ? input.fullName.trim().slice(0, 200) : undefined,
      orderId: input.orderId ? input.orderId.trim().slice(0, 100) : undefined,
      ip: input.ip,
      userAgent: input.userAgent.slice(0, 500),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await withWriteLock(async () => {
      const all = await readAll();
      all.push(record);
      await writeAll(all);
    });

    // Уведомление администратора (best-effort)
    void this.notifyAdmin(record).catch((err) => {
      logger.warn('Не удалось отправить уведомление о жалобе в Telegram', { err: err?.message });
    });

    logger.info('Получена новая жалоба', { id: record.id, subject: record.subject });
    return record;
  },

  async list(filter?: { status?: ComplaintStatus }): Promise<ComplaintRecord[]> {
    const all = await readAll();
    const filtered = filter?.status ? all.filter((c) => c.status === filter.status) : all;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async update(id: string, patch: { status?: ComplaintStatus; adminNote?: string }): Promise<ComplaintRecord> {
    return withWriteLock(async () => {
      const all = await readAll();
      const idx = all.findIndex((c) => c.id === id);
      if (idx === -1) throw new ApiError(404, 'Жалоба не найдена');
      const current = all[idx];
      const updated: ComplaintRecord = {
        ...current,
        status: patch.status ?? current.status,
        adminNote: patch.adminNote !== undefined ? patch.adminNote.trim().slice(0, 2000) : current.adminNote,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      await writeAll(all);
      return updated;
    });
  },

  async notifyAdmin(record: ComplaintRecord): Promise<void> {
    // Маршрутизация через alertRouter → команда SUPPORT.
    // Legacy TELEGRAM_ADMIN_CHAT_ID оставлен как «канал последней надежды»
    // (одно общее уведомление в админ-чат), если он задан в ENV.
    await alertRouter.dispatch({
      type: 'complaint_new',
      title: '⚠️ Новая жалоба MasterUz',
      message: [
        `Тема: ${record.subject}`,
        `Контакт: ${record.contact}`,
        record.fullName ? `ФИО: ${record.fullName}` : '',
        record.orderId ? `Заказ: ${record.orderId}` : '',
        '',
        record.description.slice(0, 1500),
        '',
        `id: ${record.id}`,
      ].filter(Boolean).join('\n'),
      data: {
        complaintId: record.id,
        subject: record.subject,
        orderId: record.orderId,
        contact: record.contact,
      },
    });

    // Legacy: общий админ-чат (если настроен) — для обратной совместимости.
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId) return;
    const text = [
      '⚠️ <b>Новая жалоба MasterUz</b>',
      '',
      `<b>Тема:</b> ${escapeHtml(record.subject)}`,
      `<b>Контакт:</b> ${escapeHtml(record.contact)}`,
      record.fullName ? `<b>ФИО:</b> ${escapeHtml(record.fullName)}` : '',
      record.orderId ? `<b>Заказ:</b> ${escapeHtml(record.orderId)}` : '',
      '',
      `<b>Описание:</b>`,
      escapeHtml(record.description).slice(0, 3500),
      '',
      `<i>id: ${record.id}</i>`,
    ].filter(Boolean).join('\n');

    await sendTelegramMessage({ chatId: adminChatId, text, parseMode: 'HTML' });
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
