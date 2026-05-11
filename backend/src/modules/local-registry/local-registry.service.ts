// ============================================
// MasterUz — Local Registry Service
// Локальная файловая БД на JSON: clients, masters, consents
// Используется до подключения PostgreSQL.
// ============================================

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

// ─── Папка хранения ───
// На serverless (Vercel) /var/task read-only — пишем в /tmp (ephemeral, но
// хотя бы не падаем 500). На VPS/Railway — рядом с backend/data.
// TODO: вынести в Postgres, чтобы данные не терялись на холодном старте Vercel.
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = isServerless
  ? path.join('/tmp', 'masteruz-data')
  : path.resolve(process.cwd(), 'data');

const FILES = {
  clients: path.join(DATA_DIR, 'clients.json'),
  masters: path.join(DATA_DIR, 'masters.json'),
  consents: path.join(DATA_DIR, 'consents.json'),
} as const;

type RegistryName = keyof typeof FILES;

// ─── Доменные модели (только то, что просили) ──────

export interface ClientRecord {
  id: string;
  fullName: string;
  phone: string;
  serviceType: string;
  paidAmount: number;
  note?: string;
  createdAt: string;
}

export interface MasterRecord {
  id: string;
  pinfl: string;          // 14 цифр — персональный идентификатор РУз
  fullName: string;       // Фамилия Имя Отчество
  phone: string;
  address: string;
  workTypes: string[];    // виды работ (категории)
  completedWork?: string; // что сделал (краткое описание последней работы)
  createdAt: string;
}

export interface ConsentRecord {
  id: string;
  identityKey: string;        // хеш(IP + User-Agent), чтобы не хранить сырой fingerprint
  acceptedOffer: boolean;
  acceptedPrivacy: boolean;
  acceptedDataProcessing: boolean;
  documentsVersion: string;   // версия принятой редакции
  ip: string;
  userAgent: string;
  acceptedAt: string;
}

// ─── Сериализация: атомарная запись с глобальной мьютекс-цепочкой ──

const writeChain: Record<RegistryName, Promise<void>> = {
  clients: Promise.resolve(),
  masters: Promise.resolve(),
  consents: Promise.resolve(),
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll<T>(name: RegistryName): Promise<T[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(FILES[name], 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll<T>(name: RegistryName, items: T[]): Promise<void> {
  // Атомарная запись: tmp → rename, чтобы не повредить файл при сбое
  await ensureDir();
  const tmp = `${FILES[name]}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf-8');
  await fs.rename(tmp, FILES[name]);
}

async function append<T extends { id: string }>(name: RegistryName, record: T): Promise<T> {
  // Сериализуем последовательные записи через цепочку Promise — защита от race condition
  const next = writeChain[name].then(async () => {
    const items = await readAll<T>(name);
    items.push(record);
    await writeAll(name, items);
  });
  writeChain[name] = next.catch(() => {});
  await next;
  logger.info({ registry: name, id: record.id }, 'Local registry: запись добавлена');
  return record;
}

// ─── Валидаторы (минималистичные, без zod-зависимости здесь) ──────

const PHONE_RE = /^\+998\d{9}$/;          // +998XXXXXXXXX
const PINFL_RE = /^\d{14}$/;              // 14 цифр

function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string') throw ApiError.badRequest(`Поле "${field}" обязательно`);
  const v = value.trim();
  if (!v) throw ApiError.badRequest(`Поле "${field}" не может быть пустым`);
  if (v.length > max) throw ApiError.badRequest(`Поле "${field}" слишком длинное (макс. ${max})`);
  return v;
}

function requirePhone(value: unknown): string {
  const v = requireString(value, 'phone', 20);
  if (!PHONE_RE.test(v)) throw ApiError.badRequest('Телефон должен быть в формате +998XXXXXXXXX');
  return v;
}

function requirePinfl(value: unknown): string {
  const v = requireString(value, 'pinfl', 14);
  if (!PINFL_RE.test(v)) throw ApiError.badRequest('ПИНФЛ должен содержать ровно 14 цифр');
  return v;
}

function requirePositiveAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw ApiError.badRequest('Поле "paidAmount" должно быть числом ≥ 0');
  if (n > 1_000_000_000) throw ApiError.badRequest('Сумма слишком большая');
  return Math.round(n);
}

function requireWorkTypes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw ApiError.badRequest('Поле "workTypes" должно быть непустым массивом');
  }
  if (value.length > 30) throw ApiError.badRequest('Слишком много видов работ (макс. 30)');
  return value.map((v, i) => requireString(v, `workTypes[${i}]`, 80));
}

// ─── Публичный API сервиса ────────────────────────

export const localRegistry = {
  // ── Clients ──
  async createClient(input: Omit<ClientRecord, 'id' | 'createdAt'>): Promise<ClientRecord> {
    const record: ClientRecord = {
      id: crypto.randomUUID(),
      fullName: requireString(input.fullName, 'fullName'),
      phone: requirePhone(input.phone),
      serviceType: requireString(input.serviceType, 'serviceType'),
      paidAmount: requirePositiveAmount(input.paidAmount),
      note: input.note ? requireString(input.note, 'note', 1000) : undefined,
      createdAt: new Date().toISOString(),
    };
    return append('clients', record);
  },

  listClients() {
    return readAll<ClientRecord>('clients');
  },

  // ── Masters ──
  async createMaster(input: Omit<MasterRecord, 'id' | 'createdAt'>): Promise<MasterRecord> {
    const record: MasterRecord = {
      id: crypto.randomUUID(),
      pinfl: requirePinfl(input.pinfl),
      fullName: requireString(input.fullName, 'fullName'),
      phone: requirePhone(input.phone),
      address: requireString(input.address, 'address', 500),
      workTypes: requireWorkTypes(input.workTypes),
      completedWork: input.completedWork ? requireString(input.completedWork, 'completedWork', 1000) : undefined,
      createdAt: new Date().toISOString(),
    };

    // Уникальность ПИНФЛ
    const existing = await readAll<MasterRecord>('masters');
    if (existing.some((m) => m.pinfl === record.pinfl)) {
      throw ApiError.conflict('Мастер с таким ПИНФЛ уже зарегистрирован');
    }

    return append('masters', record);
  },

  listMasters() {
    return readAll<MasterRecord>('masters');
  },

  // ── Consents (Consent Gate) ──
  async recordConsent(input: {
    acceptedOffer: boolean;
    acceptedPrivacy: boolean;
    acceptedDataProcessing: boolean;
    documentsVersion: string;
    ip: string;
    userAgent: string;
    telegramId?: string;
  }): Promise<ConsentRecord> {
    if (!input.acceptedOffer || !input.acceptedPrivacy || !input.acceptedDataProcessing) {
      throw ApiError.badRequest('Все три согласия обязательны');
    }

    // Если есть Telegram user id — идентифицируем именно по нему (в Mini App IP+UA одинаковые).
    const identitySource = input.telegramId
      ? `tg:${input.telegramId}`
      : `${input.ip}|${input.userAgent}`;
    const identityKey = crypto
      .createHash('sha256')
      .update(identitySource)
      .digest('hex');

    const record: ConsentRecord = {
      id: crypto.randomUUID(),
      identityKey,
      acceptedOffer: true,
      acceptedPrivacy: true,
      acceptedDataProcessing: true,
      documentsVersion: requireString(input.documentsVersion, 'documentsVersion', 32),
      ip: input.ip.slice(0, 45),
      userAgent: input.userAgent.slice(0, 500),
      acceptedAt: new Date().toISOString(),
    };
    return append('consents', record);
  },

  async hasConsent(
    ip: string,
    userAgent: string,
    documentsVersion: string,
    telegramId?: string
  ): Promise<boolean> {
    const identitySource = telegramId ? `tg:${telegramId}` : `${ip}|${userAgent}`;
    const identityKey = crypto.createHash('sha256').update(identitySource).digest('hex');
    const items = await readAll<ConsentRecord>('consents');
    return items.some(
      (c) => c.identityKey === identityKey && c.documentsVersion === documentsVersion
    );
  },

  listConsents() {
    return readAll<ConsentRecord>('consents');
  },
};
