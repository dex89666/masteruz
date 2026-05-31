// ============================================
// MasterUz — Integration-style Unit Tests: критический путь оплаты
// Заказ → блокировка эскроу → завершение (выплата мастеру) / отмена (возврат).
//
// В отличие от financial-transactions.test.ts (проверяет факт $transaction),
// здесь in-memory фейк Prisma реально двигает балансы — и мы утверждаем
// денежные инварианты: сколько списано, сколько выплачено, что возвращено,
// и что повторная финализация НЕ платит мастеру дважды.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';

// ─── In-memory store ────────────────────────────────────────────
interface UserRow { id: string; balance: number; role: string }
interface OrderRow {
  id: string;
  clientId: string;
  masterId: string | null;
  status: OrderStatus;
  price: number;
  escrowAmount: number;
  commissionAmount: number;
  visitFee: number;
  paymentModel: string;
  depositAmount: number;
  remainingAmount: number;
  [k: string]: unknown;
}
interface BalanceTxRow {
  userId: string;
  type: string;
  amount: number;
  orderId?: string | null;
  [k: string]: unknown;
}

const store = {
  users: new Map<string, UserRow>(),
  orders: new Map<string, OrderRow>(),
  masterProfiles: new Map<string, { completedOrders: number }>(),
  balanceTx: [] as BalanceTxRow[],
  categories: new Map<string, { id: string; isActive: boolean; name: string }>(),
  platformConfig: new Map<string, { value: string }>(),
  orderSeq: 0,
};

function resetStore() {
  store.users.clear();
  store.orders.clear();
  store.masterProfiles.clear();
  store.balanceTx = [];
  store.categories.clear();
  store.platformConfig.clear();
  store.orderSeq = 0;
}

// ─── Моки (vi.mock поднимается наверх) ──────────────────────────
vi.mock('../../src/config/database.js', () => {
  const db: any = {
    category: {
      findUnique: vi.fn(async ({ where }: any) => store.categories.get(where.id) ?? null),
    },
    platformConfig: {
      findUnique: vi.fn(async ({ where }: any) => store.platformConfig.get(where.key) ?? null),
    },
    task: { findMany: vi.fn(async () => []) },
    user: {
      findUnique: vi.fn(async ({ where }: any) => store.users.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const u = store.users.get(where.id)!;
        if (data.balance !== undefined) u.balance = data.balance;
        return u;
      }),
    },
    order: {
      create: vi.fn(async ({ data }: any) => {
        const id = `order-${++store.orderSeq}`;
        const row: OrderRow = {
          id,
          clientId: data.clientId,
          masterId: data.masterId ?? null,
          status: data.status,
          price: data.price,
          escrowAmount: data.escrowAmount,
          commissionAmount: data.commissionAmount,
          visitFee: data.visitFee ?? 0,
          paymentModel: data.paymentModel,
          depositAmount: data.depositAmount,
          remainingAmount: data.remainingAmount,
        };
        store.orders.set(id, row);
        return { ...row, category: {}, client: { profile: {} }, orderTasks: [] };
      }),
      findUnique: vi.fn(async ({ where }: any) => store.orders.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const o = store.orders.get(where.id)!;
        Object.assign(o, data);
        return o;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const o = store.orders.get(where.id);
        if (!o) return { count: 0 };
        // where.status: { not: X } — захват только если статус ещё не X
        if (where.status?.not !== undefined && o.status === where.status.not) {
          return { count: 0 };
        }
        Object.assign(o, data);
        return { count: 1 };
      }),
    },
    balanceTransaction: {
      create: vi.fn(async ({ data }: any) => {
        store.balanceTx.push(data);
        return data;
      }),
    },
    masterProfile: {
      update: vi.fn(async ({ where, data }: any) => {
        const p = store.masterProfiles.get(where.userId) ?? { completedOrders: 0 };
        if (data.completedOrders?.increment) p.completedOrders += data.completedOrders.increment;
        store.masterProfiles.set(where.userId, p);
        return p;
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(db)),
  };
  return { prisma: db };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/services/notificationService.js', () => ({
  notificationService: {
    notifyMastersNewOrder: vi.fn().mockResolvedValue(undefined),
    notifyOrderAwaitingRemainder: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../src/services/auditService.js', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../src/services/eventBus.js', () => ({
  eventBus: { emit: vi.fn() },
}));
vi.mock('../../src/modules/balance/balance.service.js', () => ({
  balanceService: {
    holdFunds: vi.fn(),
    releaseFunds: vi.fn(),
    refundFunds: vi.fn(),
  },
}));
vi.mock('../../src/services/customerRiskService.js', () => ({
  safeRecalculate: vi.fn(),
}));
vi.mock('../../src/services/fraudDetectionService.js', () => ({
  safeScanUser: vi.fn(),
}));
vi.mock('../../src/services/ragService.js', () => ({
  upsertOrderEmbedding: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/services/knowledgeService.js', () => ({
  enqueueExtractKnowledge: vi.fn().mockResolvedValue(undefined),
}));
const issueMasterWarning = vi.fn().mockResolvedValue({ warningNo: 1, threshold: 4, blockedUntil: null });
vi.mock('../../src/services/masterDisciplineService.js', () => ({
  issueMasterWarning: (...args: unknown[]) => issueMasterWarning(...args),
  PENALTY_RATE_AFTER_TRANSIT: 0.15,
}));
vi.mock('../../src/services/platformConfigService.js', () => ({
  getTieredCommissionRate: vi.fn(async () => 15), // 15%
  getTieredEffectiveCommissionRate: vi.fn(async () => 15),
  getConfigNumber: vi.fn(async (_key: string, def: number) => def),
  PLATFORM_CONFIG_KEYS: {
    depositRate: 'deposit_rate',
    visitFeeCommissionRate: 'visit_fee_commission_rate',
    falseDisputePenalty: 'false_dispute_penalty',
  },
}));

// Импорты ПОСЛЕ моков
import { OrdersService } from '../../src/modules/orders/orders.service.js';

let service: OrdersService;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  service = new OrdersService();
  store.categories.set('cat-plumbing', { id: 'cat-plumbing', isActive: true, name: 'Сантехник' });
});

function seedUser(id: string, balance: number, role = 'CLIENT') {
  store.users.set(id, { id, balance, role });
}

describe('Критический путь: создание заказа → блокировка эскроу', () => {
  it('списывает депозит (30%, но не меньше комиссии) и публикует заказ', async () => {
    seedUser('client-1', 500_000);

    const order = await service.createOrder('client-1', {
      categoryId: 'cat-plumbing',
      title: 'Замена смесителя',
      description: 'Течёт смеситель на кухне, нужна замена картриджа',
      price: 200_000,
      offerAccepted: true,
    } as any);

    // 200000 * 30% = 60000 депозит; комиссия 15% = 30000 → депозит max(60000, 30000)=60000
    expect(order.escrowAmount).toBe(60_000);
    expect(order.commissionAmount).toBe(30_000);
    expect(order.remainingAmount).toBe(140_000);
    expect(order.status).toBe(OrderStatus.PUBLISHED);

    // Баланс клиента уменьшился ровно на эскроу
    expect(store.users.get('client-1')!.balance).toBe(440_000);

    // Создана запись аудита движения средств
    const hold = store.balanceTx.find((t) => t.type === 'DEPOSIT_HOLD');
    expect(hold).toBeDefined();
    expect(hold!.amount).toBe(-60_000);
  });

  it('отклоняет заказ при недостатке средств — баланс не трогается', async () => {
    seedUser('client-poor', 10_000);

    await expect(
      service.createOrder('client-poor', {
        categoryId: 'cat-plumbing',
        title: 'Замена смесителя',
        description: 'Течёт смеситель на кухне, нужна замена картриджа',
        price: 200_000,
        offerAccepted: true,
      } as any),
    ).rejects.toThrow(/Недостаточно средств/);

    expect(store.users.get('client-poor')!.balance).toBe(10_000);
    expect(store.balanceTx).toHaveLength(0);
  });

  it('требует принятия оферты', async () => {
    seedUser('client-1', 500_000);
    await expect(
      service.createOrder('client-1', {
        categoryId: 'cat-plumbing',
        title: 'Замена смесителя',
        description: 'Течёт смеситель на кухне, нужна замена картриджа',
        price: 200_000,
        offerAccepted: false,
      } as any),
    ).rejects.toThrow(/оферт/i);
  });
});

describe('Критический путь: завершение → выплата мастеру', () => {
  function seedAssignedOrder() {
    store.orders.set('order-x', {
      id: 'order-x',
      clientId: 'client-1',
      masterId: 'master-1',
      status: OrderStatus.IN_PROGRESS,
      price: 200_000,
      escrowAmount: 60_000,
      commissionAmount: 30_000,
      visitFee: 0,
      paymentModel: 'FULL_ESCROW',
      depositAmount: 60_000,
      remainingAmount: 0,
    });
    seedUser('master-1', 0, 'MASTER');
    store.masterProfiles.set('master-1', { completedOrders: 0 });
  }

  it('переводит мастеру (эскроу − комиссия) и закрывает заказ', async () => {
    seedAssignedOrder();

    await (service as any).payoutAndComplete('order-x');

    // Мастер получил 60000 − 30000 = 30000
    expect(store.users.get('master-1')!.balance).toBe(30_000);

    const order = store.orders.get('order-x')!;
    expect(order.status).toBe(OrderStatus.COMPLETED);
    expect(order.escrowAmount).toBe(0);
    expect(order.commissionPaid).toBe(true);
    expect(store.masterProfiles.get('master-1')!.completedOrders).toBe(1);

    const payout = store.balanceTx.find((t) => t.type === 'PAYOUT');
    expect(payout!.amount).toBe(30_000);
  });

  it('идемпотентность: повторная финализация НЕ платит мастеру дважды', async () => {
    seedAssignedOrder();

    await (service as any).payoutAndComplete('order-x');
    const result = await (service as any).payoutAndComplete('order-x');

    // Баланс не изменился после второго вызова
    expect(store.users.get('master-1')!.balance).toBe(30_000);
    expect(result).toMatchObject({ alreadyFinalized: true });
    // Профиль увеличен ровно один раз
    expect(store.masterProfiles.get('master-1')!.completedOrders).toBe(1);
    // Выплата записана один раз
    expect(store.balanceTx.filter((t) => t.type === 'PAYOUT')).toHaveLength(1);
  });
});

describe('Критический путь: отмена → возврат эскроу', () => {
  it('клиент отменяет PUBLISHED — полный возврат, без штрафа', async () => {
    seedUser('client-1', 440_000); // 60000 уже в эскроу
    store.orders.set('order-c', {
      id: 'order-c',
      clientId: 'client-1',
      masterId: null,
      status: OrderStatus.PUBLISHED,
      price: 200_000,
      escrowAmount: 60_000,
      commissionAmount: 30_000,
      visitFee: 0,
      paymentModel: 'DEPOSIT_30',
      depositAmount: 60_000,
      remainingAmount: 140_000,
    });

    const res = await service.cancelOrder('order-c', 'client-1', 'передумал');

    expect(res.penaltyAmount).toBe(0);
    expect(store.users.get('client-1')!.balance).toBe(500_000); // эскроу вернулся
    const order = store.orders.get('order-c')!;
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.escrowAmount).toBe(0);

    const refund = store.balanceTx.find((t) => t.type === 'REFUND');
    expect(refund!.amount).toBe(60_000);
  });

  it('мастер отменяет IN_PROGRESS — клиенту возврат, мастеру штраф + предупреждение', async () => {
    seedUser('client-1', 440_000);
    seedUser('master-1', 100_000, 'MASTER');
    store.orders.set('order-m', {
      id: 'order-m',
      clientId: 'client-1',
      masterId: 'master-1',
      status: OrderStatus.IN_PROGRESS,
      price: 200_000,
      escrowAmount: 60_000,
      commissionAmount: 30_000,
      visitFee: 0,
      paymentModel: 'DEPOSIT_30',
      depositAmount: 60_000,
      remainingAmount: 140_000,
    });

    const res = await service.cancelOrder('order-m', 'master-1', 'не успеваю');

    // Штраф 15% от 200000 = 30000
    expect(res.penaltyAmount).toBe(30_000);
    // Клиенту вернули эскроу
    expect(store.users.get('client-1')!.balance).toBe(500_000);
    // С мастера списали штраф
    expect(store.users.get('master-1')!.balance).toBe(70_000);
    // Выдано дисциплинарное предупреждение
    expect(issueMasterWarning).toHaveBeenCalledTimes(1);
    expect(res.warning).toMatchObject({ warningNo: 1, threshold: 4 });

    const penalty = store.balanceTx.find((t) => t.type === 'PENALTY');
    expect(penalty!.amount).toBe(-30_000);
  });

  it('нельзя отменить уже завершённый заказ', async () => {
    store.orders.set('order-done', {
      id: 'order-done',
      clientId: 'client-1',
      masterId: 'master-1',
      status: OrderStatus.COMPLETED,
      price: 200_000,
      escrowAmount: 0,
      commissionAmount: 30_000,
      visitFee: 0,
      paymentModel: 'FULL_ESCROW',
      depositAmount: 60_000,
      remainingAmount: 0,
    });

    await expect(service.cancelOrder('order-done', 'client-1')).rejects.toThrow(
      /уже завершён или отменён/,
    );
  });
});
