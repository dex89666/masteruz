// ============================================
// MasterUz — Резервное копирование базы
// ============================================
// С 18 июля бэкапов не было почти два месяца: GitHub Actions встал из-за
// биллинга, а его pg_dump 16 не выгрузил бы сервер PostgreSQL 18 и после
// починки. Бэкап переехал в бэкенд; здесь проверяется то, что легко
// сломать незаметно: подключение без пароля в аргументах, совместимость
// имён со старыми копиями и срок хранения, не съедающий историю.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({ prisma: {} }));
vi.mock('../../src/config/redis.js', () => ({ getRedis: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  pgEnvFromUrl,
  backupKey,
  selectExpiredBackups,
  MIN_BACKUPS_KEPT,
} from '../../src/services/databaseBackup.js';
import { isBackupDue } from '../../src/services/backupJob.js';

describe('подключение pg_dump', () => {
  it('раскладывает адрес базы в переменные libpq, декодируя пароль', () => {
    const env = pgEnvFromUrl('postgresql://postgres:p%40ss%3Aw0rd@postgres.railway.internal:5432/railway?schema=public');
    expect(env).toEqual({
      PGHOST: 'postgres.railway.internal',
      PGPORT: '5432',
      PGUSER: 'postgres',
      PGPASSWORD: 'p@ss:w0rd',
      PGDATABASE: 'railway',
    });
  });

  it('переносит режим SSL, если он задан', () => {
    expect(pgEnvFromUrl('postgresql://u:p@db.example.com/app?sslmode=require').PGSSLMODE).toBe('require');
  });

  it('без порта берёт стандартный', () => {
    expect(pgEnvFromUrl('postgresql://u:p@db.example.com/app').PGPORT).toBe('5432');
  });
});

describe('имя файла бэкапа', () => {
  it('совпадает с форматом прежних копий — старые и новые лежат в одном ряду', () => {
    expect(backupKey(new Date('2026-09-11T02:03:04Z'))).toBe('masteruz-20260911-020304.sql.gz');
  });
});

describe('срок хранения', () => {
  const day = (d: string) => `masteruz-${d}-020000.sql.gz`;
  const now = new Date('2026-09-11T03:00:00Z');

  it('удаляет копии старше срока, если свежих достаточно', () => {
    const recent = Array.from({ length: 10 }, (_, i) => day(`202609${String(i + 1).padStart(2, '0')}`));
    const expired = selectExpiredBackups([...recent, day('20260701')], now, 30);
    expect(expired).toEqual([day('20260701')]);
  });

  it('после долгого простоя не сносит всю историю', () => {
    // Бэкапов не было два месяца: все прежние копии старше 30 дней. Правило
    // «удалить всё старше срока» оставило бы одну-единственную копию.
    const old = Array.from({ length: 10 }, (_, i) => day(`202607${String(i + 1).padStart(2, '0')}`));
    const expired = selectExpiredBackups(old, now, 30);
    expect(old.length - expired.length).toBe(MIN_BACKUPS_KEPT);
    // Удаляются самые старые, свежие остаются
    expect(expired).toContain(day('20260701'));
    expect(expired).not.toContain(day('20260710'));
  });

  it('чужие файлы в хранилище не трогает', () => {
    const keys = ['notes.txt', 'masteruz-latest.sql.gz', ...Array.from({ length: 9 }, (_, i) => day(`202601${i + 1}0`))];
    const expired = selectExpiredBackups(keys, now, 30);
    expect(expired).not.toContain('notes.txt');
    expect(expired).not.toContain('masteruz-latest.sql.gz');
  });
});

describe('расписание', () => {
  const now = new Date('2026-09-11T12:00:00Z');

  it('если бэкапа не было ни разу — снимать сейчас', () => {
    expect(isBackupDue(null, now)).toBe(true);
  });

  it('свежий бэкап повторно не снимается', () => {
    expect(isBackupDue(new Date('2026-09-11T02:00:00Z'), now)).toBe(false);
  });

  it('просроченный — догоняется сразу, а не следующей ночью', () => {
    expect(isBackupDue(new Date('2026-07-18T20:30:49Z'), now)).toBe(true);
  });
});
