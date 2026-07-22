// ============================================
// MasterUz — Уборка зависшего: платежи и заказы
// ============================================
// Две вещи, копившиеся в проде: заброшенные PENDING-платежи и заказы
// без мастера, о которых клиент не знает. Проверяем, что автоматика
// не трогает лишнего — особенно платежи в процессе оплаты.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => {
  const mk = () => ({
    findMany: vi.fn(), findUnique: vi.fn(),
    deleteMany: vi.fn(), updateMany: vi.fn(),
  });
  return { prisma: { notification: mk(), notificationDeliveryLog: mk(), payment: mk(), order: mk() } };
});
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/backupWatchdog.js', () => ({
  checkBackupFreshness: vi.fn().mockResolvedValue({ stale: false }),
}));
vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: { notifyClientOrderStale: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../../src/config/database.js';
import { runCleanupTick } from '../../src/services/cleanupJob.js';
import { runClientStaleNotifyTick } from '../../src/services/orderAutoCancellation.js';
import { notificationService } from '../../src/services/notificationService.js';

const db = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  db.notification.deleteMany.mockResolvedValue({ count: 0 });
  db.notificationDeliveryLog.deleteMany.mockResolvedValue({ count: 0 });
  db.payment.updateMany.mockResolvedValue({ count: 0 });
});

describe('авто-FAILED заброшенных платежей', () => {
  it('переводит старые PENDING в FAILED', async () => {
    db.payment.updateMany.mockResolvedValue({ count: 3 });

    const res = await runCleanupTick();

    expect(res.stalePayments).toBe(3);
    const call = db.payment.updateMany.mock.calls[0][0];
    expect(call.where.status).toBe('PENDING');
    expect(call.data.status).toBe('FAILED');
    // причина фиксируется — чтобы отличать авто-таймаут от реального сбоя
    expect(call.data.metadata.failedReason).toBe('auto_timeout');
  });

  it('НЕ трогает платежи в процессе оплаты (PROCESSING)', async () => {
    // Ключевая защита: у PROCESSING вебхук ещё может прийти. Пометить его
    // FAILED значило бы разойтись с реальным списанием у клиента.
    await runCleanupTick();

    const where = db.payment.updateMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDING');
    expect(where.status).not.toBe('PROCESSING');
  });

  it('фильтрует по возрасту (только старше порога)', async () => {
    await runCleanupTick();
    const where = db.payment.updateMany.mock.calls[0][0].where;
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    expect(where.createdAt.lt.getTime()).toBeLessThan(Date.now());
  });
});

describe('уведомление клиента о зависшем заказе', () => {
  it('уведомляет по каждому заказу-кандидату', async () => {
    db.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);

    const res = await runClientStaleNotifyTick();

    expect(res.notified).toBe(2);
    expect(notificationService.notifyClientOrderStale).toHaveBeenCalledTimes(2);
    expect(notificationService.notifyClientOrderStale).toHaveBeenCalledWith('o1');
  });

  it('берёт только PUBLISHED без мастера и без прежнего уведомления', async () => {
    db.order.findMany.mockResolvedValue([]);

    await runClientStaleNotifyTick();

    const where = db.order.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PUBLISHED');
    expect(where.masterId).toBeNull();
    expect(where.clientStaleNotifiedAt).toBeNull();     // защита от повтора
    expect(where.createdAt.lt).toBeInstanceOf(Date);
  });

  it('нет кандидатов — никого не уведомляет', async () => {
    db.order.findMany.mockResolvedValue([]);

    const res = await runClientStaleNotifyTick();

    expect(res.notified).toBe(0);
    expect(notificationService.notifyClientOrderStale).not.toHaveBeenCalled();
  });

  it('сбой одного уведомления не срывает весь тик', async () => {
    db.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
    (notificationService.notifyClientOrderStale as any)
      .mockRejectedValueOnce(new Error('telegram down'));

    const res = await runClientStaleNotifyTick();

    // Первый упал, второй прошёл — тик дошёл до конца
    expect(res.notified).toBe(2);
    expect(notificationService.notifyClientOrderStale).toHaveBeenCalledTimes(2);
  });
});
