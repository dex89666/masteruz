// ============================================
// MasterUz — Сторож бэкапов
// ============================================
// Реальный инцидент: бэкапы падали 33 раза подряд с 15 июня и никто
// не узнал — workflow завершался за 3 секунды из-за блокировки аккаунта.
// Сторож ловит именно ТИШИНУ, поэтому тесты проверяют прежде всего
// сценарий «отметок нет вообще» и защиту от спама алертами.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    platformConfig: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/alertRouter.js', () => ({
  alertRouter: { dispatch: vi.fn().mockResolvedValue({ sent: 1 }) },
}));

import { prisma } from '../../src/config/database.js';
import { alertRouter } from '../../src/services/alertRouter.js';
import { checkBackupFreshness, markBackupSuccess } from '../../src/services/backupWatchdog.js';

const db = prisma as any;
const H = 3_600_000;

/** Ответ на чтение ключей: last_backup_at и last_backup_warn_at. */
function mockKeys(backupAgeH: number | null, warnAgeH: number | null) {
  db.platformConfig.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.key === 'last_backup_at') {
      return backupAgeH === null ? null : { value: new Date(Date.now() - backupAgeH * H).toISOString() };
    }
    if (where.key === 'last_backup_warn_at') {
      return warnAgeH === null ? null : { value: new Date(Date.now() - warnAgeH * H).toISOString() };
    }
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.platformConfig.upsert.mockResolvedValue({});
});

describe('свежий бэкап', () => {
  it('не тревожит, если бэкап был недавно', async () => {
    mockKeys(2, null);

    const res = await checkBackupFreshness();

    expect(res.stale).toBe(false);
    expect(res.alerted).toBe(false);
    expect(alertRouter.dispatch).not.toHaveBeenCalled();
  });

  it('молчит на границе порога (36 ч ещё норма)', async () => {
    mockKeys(35, null);
    const res = await checkBackupFreshness();
    expect(res.stale).toBe(false);
  });
});

describe('устаревший бэкап', () => {
  it('поднимает тревогу, если бэкапа не было больше суток с запасом', async () => {
    mockKeys(50, null);

    const res = await checkBackupFreshness();

    expect(res.stale).toBe(true);
    expect(res.alerted).toBe(true);
    expect(alertRouter.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'backup_failed' }),
    );
  });

  it('ОТСУТСТВИЕ отметок — тоже тревога (так выглядел реальный инцидент)', async () => {
    mockKeys(null, null);

    const res = await checkBackupFreshness();

    expect(res.lastBackupAt).toBeNull();
    expect(res.stale).toBe(true);
    expect(res.alerted).toBe(true);

    const msg = (alertRouter.dispatch as any).mock.calls[0][0].message;
    expect(msg).toMatch(/нет вообще/);
  });

  it('в тексте алерта есть возраст бэкапа и что делать', async () => {
    mockKeys(60, null);

    await checkBackupFreshness();

    const payload = (alertRouter.dispatch as any).mock.calls[0][0];
    expect(payload.message).toMatch(/60 ч назад/);
    expect(payload.message).toMatch(/backup-db\.sh/);
  });
});

describe('защита от спама алертами', () => {
  it('не повторяет предупреждение чаще раза в сутки', async () => {
    mockKeys(50, 3);   // бэкап старый, но предупреждали 3 часа назад

    const res = await checkBackupFreshness();

    expect(res.stale).toBe(true);
    expect(res.alerted).toBe(false);
    expect(alertRouter.dispatch).not.toHaveBeenCalled();
  });

  it('повторяет, когда сутки прошли', async () => {
    mockKeys(50, 25);

    const res = await checkBackupFreshness();

    expect(res.alerted).toBe(true);
    expect(alertRouter.dispatch).toHaveBeenCalled();
  });
});

describe('отметка об успехе', () => {
  it('markBackupSuccess пишет метку времени', async () => {
    const at = new Date('2026-07-19T00:00:00Z');

    await markBackupSuccess(at);

    const call = db.platformConfig.upsert.mock.calls[0][0];
    expect(call.where.key).toBe('last_backup_at');
    expect(call.update.value).toBe(at.toISOString());
  });
});

describe('устойчивость', () => {
  it('сбой отправки алерта не роняет проверку', async () => {
    mockKeys(50, null);
    (alertRouter.dispatch as any).mockRejectedValueOnce(new Error('telegram down'));

    await expect(checkBackupFreshness()).resolves.toBeDefined();
  });
});
