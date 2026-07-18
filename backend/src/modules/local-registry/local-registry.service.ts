// ============================================
// MasterUz — Local Registry Service
// Реестр клиентов, мастеров и согласий с офертой.
// ============================================
//
// Раньше данные лежали в data/*.json относительно cwd — то есть в /app/data
// внутри контейнера. Volume Railway смонтирован в /app/uploads, поэтому
// /app/data был эфемерной ФС: каждый деплой стирал реестр вместе с ПИНФЛ
// мастеров и юридическими согласиями. Пользователям это выглядело как
// повторный запрос принять оферту после каждого релиза.
//
// Теперь всё в Postgres. Внешний контракт функций сохранён — маршруты и
// фронтенд не менялись.

import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { ApiError } from '../../utils/ApiError.js';
import { toNum } from '../../utils/helpers.js';

// ─── Доменные модели ──────────────────────────────

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
  fullName: string;
  phone: string;
  address: string;
  workTypes: string[];
  completedWork?: string;
  createdAt: string;
}

export interface ConsentRecord {
  id: string;
  identityKey: string;        // хеш(tg id | IP+UA) — сырой отпечаток не храним
  acceptedOffer: boolean;
  acceptedPrivacy: boolean;
  acceptedDataProcessing: boolean;
  documentsVersion: string;
  ip: string;
  userAgent: string;
  acceptedAt: string;
}

const PHONE_RE = /^\+998\d{9}$/;          // +998XXXXXXXXX
const PINFL_RE = /^\d{14}$/;              // 14 цифр

// ─── Валидаторы (перенесены из файловой версии без изменений) ─────

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

/** Ключ личности: в Mini App у всех одинаковые IP и UA, поэтому при наличии
 *  Telegram id опираемся на него. Хешируем, чтобы не хранить отпечаток. */
function buildIdentityKey(ip: string, userAgent: string, telegramId?: string): string {
  const source = telegramId ? `tg:${telegramId}` : `${ip}|${userAgent}`;
  return crypto.createHash('sha256').update(source).digest('hex');
}

// ─── Мапперы: Prisma → доменная модель (даты строками, как раньше) ───

function toClient(r: any): ClientRecord {
  return {
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    serviceType: r.serviceType,
    paidAmount: toNum(r.paidAmount),
    note: r.note ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

function toMaster(r: any): MasterRecord {
  return {
    id: r.id,
    pinfl: r.pinfl,
    fullName: r.fullName,
    phone: r.phone,
    address: r.address,
    workTypes: r.workTypes ?? [],
    completedWork: r.completedWork ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

function toConsent(r: any): ConsentRecord {
  return {
    id: r.id,
    identityKey: r.identityKey,
    acceptedOffer: r.acceptedOffer,
    acceptedPrivacy: r.acceptedPrivacy,
    acceptedDataProcessing: r.acceptedDataProcessing,
    documentsVersion: r.documentsVersion,
    ip: r.ip,
    userAgent: r.userAgent,
    acceptedAt: r.acceptedAt.toISOString(),
  };
}

// ─── Публичный API сервиса ────────────────────────

export const localRegistry = {
  // ── Clients ──
  async createClient(input: Omit<ClientRecord, 'id' | 'createdAt'>): Promise<ClientRecord> {
    const created = await prisma.localClient.create({
      data: {
        fullName: requireString(input.fullName, 'fullName'),
        phone: requirePhone(input.phone),
        serviceType: requireString(input.serviceType, 'serviceType'),
        paidAmount: requirePositiveAmount(input.paidAmount),
        note: input.note ? requireString(input.note, 'note', 1000) : null,
      },
    });
    return toClient(created);
  },

  async listClients(): Promise<ClientRecord[]> {
    const rows = await prisma.localClient.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toClient);
  },

  // ── Masters ──
  async createMaster(input: Omit<MasterRecord, 'id' | 'createdAt'>): Promise<MasterRecord> {
    const data = {
      pinfl: requirePinfl(input.pinfl),
      fullName: requireString(input.fullName, 'fullName'),
      phone: requirePhone(input.phone),
      address: requireString(input.address, 'address', 500),
      workTypes: requireWorkTypes(input.workTypes),
      completedWork: input.completedWork
        ? requireString(input.completedWork, 'completedWork', 1000)
        : null,
    };

    try {
      return toMaster(await prisma.localMaster.create({ data }));
    } catch (err: any) {
      // Уникальность ПИНФЛ теперь гарантирует БД. Прежняя проверка
      // «сначала прочитать всё, потом записать» пропускала дубли при
      // параллельных запросах.
      if (err?.code === 'P2002') {
        throw ApiError.conflict('Мастер с таким ПИНФЛ уже зарегистрирован');
      }
      throw err;
    }
  },

  async listMasters(): Promise<MasterRecord[]> {
    const rows = await prisma.localMaster.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toMaster);
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

    const created = await prisma.consentRecord.create({
      data: {
        identityKey: buildIdentityKey(input.ip, input.userAgent, input.telegramId),
        acceptedOffer: true,
        acceptedPrivacy: true,
        acceptedDataProcessing: true,
        documentsVersion: requireString(input.documentsVersion, 'documentsVersion', 32),
        ip: input.ip.slice(0, 45),
        userAgent: input.userAgent.slice(0, 500),
      },
    });
    return toConsent(created);
  },

  async hasConsent(
    ip: string,
    userAgent: string,
    documentsVersion: string,
    telegramId?: string,
  ): Promise<boolean> {
    const identityKey = buildIdentityKey(ip, userAgent, telegramId);
    // Раньше читался и перебирался весь файл согласий; теперь — точечный
    // запрос по индексу (identity_key, documents_version).
    const found = await prisma.consentRecord.findFirst({
      where: { identityKey, documentsVersion },
      select: { id: true },
    });
    return found !== null;
  },

  async listConsents(): Promise<ConsentRecord[]> {
    const rows = await prisma.consentRecord.findMany({ orderBy: { acceptedAt: 'desc' } });
    return rows.map(toConsent);
  },
};
