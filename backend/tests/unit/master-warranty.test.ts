// ============================================
// MasterUz — гарантия мастера
// Срок задаёт мастер (отклик → профиль → минимум 5 дней по Правилам),
// гарантия оформляется один раз, чужие пользователи её не видят и не закрывают.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  orderResponse: { findUnique: vi.fn() },
  masterProfile: { findUnique: vi.fn() },
  guarantee: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
}));

vi.mock('../../src/config/database.js', () => ({ prisma: db }));
vi.mock('../../src/utils/helpers.js', () => ({ isAdminUser: vi.fn(async () => false) }));

import {
  issueMasterWarranty,
  getGuaranteeByOrder,
  resolveGuarantee,
} from '../../src/modules/guarantees/guarantees.service.js';

const completedAt = new Date('2026-10-01T10:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  db.order.findUnique.mockResolvedValue({
    status: 'COMPLETED', masterId: 'm1', clientId: 'c1', title: 'Кран', completedAt,
  });
  db.guarantee.findUnique.mockResolvedValue(null);
  db.guarantee.create.mockImplementation(async ({ data }: any) => ({ id: 'g1', ...data }));
  db.masterProfile.findUnique.mockResolvedValue({ warrantyDays: 30 });
});

describe('issueMasterWarranty', () => {
  it('берёт срок из отклика мастера и считает его со дня выполнения', async () => {
    db.orderResponse.findUnique.mockResolvedValue({ warrantyDays: 90 });
    const g = await issueMasterWarranty('o1');
    expect(g.durationDays).toBe(90);
    expect(g.expiresAt.toISOString()).toBe('2026-12-30T10:00:00.000Z');
  });

  it('без срока в отклике — срок из профиля мастера', async () => {
    db.orderResponse.findUnique.mockResolvedValue({ warrantyDays: null });
    expect((await issueMasterWarranty('o1')).durationDays).toBe(30);
  });

  it('не меньше 5 дней по Правилам оказания услуг', async () => {
    db.orderResponse.findUnique.mockResolvedValue({ warrantyDays: 1 });
    expect((await issueMasterWarranty('o1')).durationDays).toBe(5);
  });

  it('повторный вызов возвращает уже оформленную гарантию', async () => {
    db.guarantee.findUnique.mockResolvedValue({ id: 'g0', durationDays: 14 });
    expect((await issueMasterWarranty('o1')).id).toBe('g0');
    expect(db.guarantee.create).not.toHaveBeenCalled();
  });

  it('для незавершённого заказа гарантии нет', async () => {
    db.order.findUnique.mockResolvedValue({ status: 'IN_PROGRESS', masterId: 'm1', clientId: 'c1' });
    await expect(issueMasterWarranty('o1')).rejects.toThrow();
  });
});

describe('доступ к гарантии', () => {
  it('посторонний пользователь не видит гарантию заказа', async () => {
    await expect(getGuaranteeByOrder('o1', 'stranger')).rejects.toThrow(/доступа/);
  });

  it('клиент не может сам закрыть гарантийное обращение — только мастер', async () => {
    db.guarantee.findUnique.mockResolvedValue({
      claimedAt: new Date(), resolvedAt: null,
      order: { masterId: 'm1', clientId: 'c1', title: 'Кран' },
    });
    await expect(resolveGuarantee('o1', 'c1')).rejects.toThrow(/мастер/);
    db.guarantee.update.mockResolvedValue({ resolvedAt: new Date() });
    await expect(resolveGuarantee('o1', 'm1')).resolves.toBeTruthy();
  });
});
