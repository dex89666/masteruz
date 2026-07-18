// ============================================
// MasterUz — Локальный реестр (Postgres)
// ============================================
// Реестр хранит ПИНФЛ мастеров и юридические согласия с офертой.
// Раньше он писал в data/*.json на эфемерной ФС контейнера и терялся
// при каждом деплое. После переезда в Postgres проверяем, что контракт
// сохранён, валидация не ослабла и согласия ищутся корректно.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mk = () => ({ create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() });
  return { prisma: { localClient: mk(), localMaster: mk(), consentRecord: mk() } };
});

import { prisma } from '../../src/config/database.js';
import { localRegistry } from '../../src/modules/local-registry/local-registry.service.js';

const db = prisma as any;
const NOW = new Date('2026-07-19T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  db.localClient.create.mockImplementation(async ({ data }: any) => ({ id: 'c1', createdAt: NOW, ...data }));
  db.localMaster.create.mockImplementation(async ({ data }: any) => ({ id: 'm1', createdAt: NOW, ...data }));
  db.consentRecord.create.mockImplementation(async ({ data }: any) => ({ id: 'k1', acceptedAt: NOW, ...data }));
});

describe('клиенты', () => {
  it('создаёт запись и отдаёт дату строкой (контракт сохранён)', async () => {
    const r = await localRegistry.createClient({
      fullName: 'Иванов Иван', phone: '+998901234567',
      serviceType: 'Сантехника', paidAmount: 150000,
    });
    expect(r.id).toBe('c1');
    expect(r.paidAmount).toBe(150000);
    expect(typeof r.createdAt).toBe('string');
  });

  it('отклоняет телефон не в формате +998XXXXXXXXX', async () => {
    await expect(localRegistry.createClient({
      fullName: 'Иванов', phone: '8901234567',
      serviceType: 'Сантехника', paidAmount: 1000,
    })).rejects.toThrow(/\+998/);
  });

  it('отклоняет отрицательную сумму', async () => {
    await expect(localRegistry.createClient({
      fullName: 'Иванов', phone: '+998901234567',
      serviceType: 'Сантехника', paidAmount: -5,
    })).rejects.toThrow();
  });
});

describe('мастера', () => {
  const valid = {
    pinfl: '12345678901234', fullName: 'Петров Пётр',
    phone: '+998901234567', address: 'Ташкент, Чиланзар',
    workTypes: ['Сантехника'],
  };

  it('создаёт запись с ПИНФЛ', async () => {
    const r = await localRegistry.createMaster(valid);
    expect(r.pinfl).toBe('12345678901234');
    expect(r.workTypes).toEqual(['Сантехника']);
  });

  it('требует ровно 14 цифр в ПИНФЛ', async () => {
    await expect(localRegistry.createMaster({ ...valid, pinfl: '123' })).rejects.toThrow(/14 цифр/);
    await expect(localRegistry.createMaster({ ...valid, pinfl: 'abcdefghijklmn' })).rejects.toThrow(/14 цифр/);
  });

  it('дубль ПИНФЛ отклоняется уникальным индексом БД', async () => {
    // P2002 — нарушение unique. Прежняя проверка «сначала SELECT, потом
    // INSERT» пропускала дубли при параллельных запросах.
    db.localMaster.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    await expect(localRegistry.createMaster(valid)).rejects.toThrow(/уже зарегистрирован/);
  });

  it('требует непустой список видов работ', async () => {
    await expect(localRegistry.createMaster({ ...valid, workTypes: [] })).rejects.toThrow(/workTypes/);
  });
});

describe('согласия с офертой', () => {
  const base = {
    acceptedOffer: true, acceptedPrivacy: true, acceptedDataProcessing: true,
    documentsVersion: 'v1', ip: '1.2.3.4', userAgent: 'Mozilla',
  };

  it('фиксирует согласие и не хранит сырой отпечаток', async () => {
    const r = await localRegistry.recordConsent(base);
    // identityKey — sha256, 64 hex-символа
    expect(r.identityKey).toMatch(/^[a-f0-9]{64}$/);
    expect(r.identityKey).not.toContain('1.2.3.4');
  });

  it('требует все три согласия', async () => {
    await expect(localRegistry.recordConsent({ ...base, acceptedPrivacy: false }))
      .rejects.toThrow(/Все три согласия/);
    expect(db.consentRecord.create).not.toHaveBeenCalled();
  });

  it('в Mini App личность определяется по telegramId, а не по IP+UA', async () => {
    // У всех пользователей Mini App одинаковые IP и UA — без tg id
    // согласие одного засчиталось бы всем остальным.
    const a = await localRegistry.recordConsent({ ...base, telegramId: '111' });
    const b = await localRegistry.recordConsent({ ...base, telegramId: '222' });
    expect(a.identityKey).not.toBe(b.identityKey);
  });

  it('hasConsent ищет точечным запросом по ключу и версии документов', async () => {
    db.consentRecord.findFirst.mockResolvedValue({ id: 'k1' });

    const ok = await localRegistry.hasConsent('1.2.3.4', 'Mozilla', 'v1', '111');

    expect(ok).toBe(true);
    const where = db.consentRecord.findFirst.mock.calls[0][0].where;
    expect(where.documentsVersion).toBe('v1');
    expect(where.identityKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('новая версия документов требует нового согласия', async () => {
    db.consentRecord.findFirst.mockResolvedValue(null);
    const ok = await localRegistry.hasConsent('1.2.3.4', 'Mozilla', 'v2', '111');
    expect(ok).toBe(false);
  });
});
