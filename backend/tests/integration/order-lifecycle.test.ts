// ============================================
// MasterUz — Интеграционные тесты: жизненный цикл заказа (БД)
// Проверяет реальные SQL-запросы, constraints, транзакции
// Запуск: TEST_DATABASE_URL=... npx vitest run tests/integration/order-lifecycle.test.ts
// ============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, OrderStatus, UserRole, BalanceTransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

// Пропускаем, если нет тестовой БД
const describeDB = TEST_DB_URL ? describe : describe.skip;

let prisma: PrismaClient;

describeDB('Order Lifecycle — интеграция с БД', () => {
  // ID сущностей, созданных в тестах (для cleanup)
  const createdIds: { users: string[]; categories: string[]; orders: string[] } = {
    users: [],
    categories: [],
    orders: [],
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup в правильном порядке (по зависимостям)
    if (createdIds.orders.length) {
      await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    }
    if (createdIds.users.length) {
      await prisma.userProfile.deleteMany({ where: { userId: { in: createdIds.users } } });
      await prisma.masterProfile.deleteMany({ where: { userId: { in: createdIds.users } } });
      await prisma.balanceTransaction.deleteMany({ where: { userId: { in: createdIds.users } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    }
    if (createdIds.categories.length) {
      await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    }
    await prisma.$disconnect();
  });

  // Уникальные telegramId чтобы не конфликтовать с prod-данными
  const testTgClient = BigInt(9999000001);
  const testTgMaster = BigInt(9999000002);
  const testCategorySlug = `__test_category_${Date.now()}`;

  let clientId: string;
  let masterId: string;
  let categoryId: string;
  let orderId: string;

  it('создаёт тестовых пользователей (клиент + мастер)', async () => {
    const client = await prisma.user.create({
      data: {
        telegramId: testTgClient,
        role: UserRole.CLIENT,
        referralCode: `test_client_${Date.now()}`,
        balance: new Decimal(500000), // 500 000 сум
      },
    });
    clientId = client.id;
    createdIds.users.push(clientId);

    const master = await prisma.user.create({
      data: {
        telegramId: testTgMaster,
        role: UserRole.MASTER,
        referralCode: `test_master_${Date.now()}`,
        balance: new Decimal(0),
      },
    });
    masterId = master.id;
    createdIds.users.push(masterId);

    expect(client.role).toBe(UserRole.CLIENT);
    expect(master.role).toBe(UserRole.MASTER);
    expect(client.balance.toString()).toBe('500000');
  });

  it('создаёт тестовую категорию', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Тест сантехника', slug: testCategorySlug },
    });
    categoryId = cat.id;
    createdIds.categories.push(categoryId);
    expect(cat.slug).toBe(testCategorySlug);
  });

  it('создаёт заказ с эскроу в транзакции (атомарно)', async () => {
    const price = new Decimal(100000);
    const commissionRate = new Decimal(15);
    const commissionAmount = price.mul(commissionRate).div(100);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Списываем эскроу с клиента
      const clientBefore = await tx.user.findUniqueOrThrow({ where: { id: clientId } });
      const newBalance = clientBefore.balance.sub(price);
      if (newBalance.lessThan(0)) throw new Error('Недостаточно средств');

      await tx.user.update({
        where: { id: clientId },
        data: { balance: newBalance },
      });

      // 2. Создаём заказ
      const order = await tx.order.create({
        data: {
          clientId,
          categoryId,
          title: 'Тестовый заказ сантехника',
          description: 'Интеграционный тест: установка смесителя',
          price,
          commissionRate,
          commissionAmount,
          escrowAmount: price,
          status: OrderStatus.PUBLISHED,
          offerAccepted: true,
        },
      });

      // 3. Записываем транзакцию баланса
      await tx.balanceTransaction.create({
        data: {
          userId: clientId,
          type: BalanceTransactionType.ESCROW_HOLD,
          amount: price.neg(),
          balanceBefore: clientBefore.balance,
          balanceAfter: newBalance,
          orderId: order.id,
          description: 'Эскроу: блокировка средств',
        },
      });

      return order;
    });

    orderId = result.id;
    createdIds.orders.push(orderId);

    // Проверяем: баланс клиента уменьшился
    const client = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    expect(client.balance.toString()).toBe('400000');

    // Проверяем: заказ создан
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.PUBLISHED);
    expect(order.escrowAmount.toString()).toBe('100000');
  });

  it('назначает мастера на заказ', async () => {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { masterId, status: OrderStatus.IN_PROGRESS },
    });

    expect(order.masterId).toBe(masterId);
    expect(order.status).toBe(OrderStatus.IN_PROGRESS);
  });

  it('завершает заказ — выплата мастеру из эскроу (атомарно)', async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const payoutAmount = order.escrowAmount.sub(order.commissionAmount);

    await prisma.$transaction(async (tx) => {
      // 1. Выплата мастеру
      const masterBefore = await tx.user.findUniqueOrThrow({ where: { id: masterId } });
      const masterNewBalance = masterBefore.balance.add(payoutAmount);

      await tx.user.update({
        where: { id: masterId },
        data: { balance: masterNewBalance },
      });

      await tx.balanceTransaction.create({
        data: {
          userId: masterId,
          type: BalanceTransactionType.PAYOUT,
          amount: payoutAmount,
          balanceBefore: masterBefore.balance,
          balanceAfter: masterNewBalance,
          orderId,
          description: 'Оплата за заказ',
        },
      });

      // 2. Закрываем заказ
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    // Проверяем финальное состояние
    const master = await prisma.user.findUniqueOrThrow({ where: { id: masterId } });
    expect(master.balance.toString()).toBe(payoutAmount.toString());

    const completedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(completedOrder.status).toBe(OrderStatus.COMPLETED);
    expect(completedOrder.completedAt).toBeTruthy();
  });

  it('unique constraint: нельзя создать двух пользователей с одним telegramId', async () => {
    await expect(
      prisma.user.create({
        data: {
          telegramId: testTgClient, // уже существует
          role: UserRole.CLIENT,
          referralCode: `dup_${Date.now()}`,
        },
      })
    ).rejects.toThrow();
  });

  it('foreign key: нельзя создать заказ с несуществующим клиентом', async () => {
    await expect(
      prisma.order.create({
        data: {
          clientId: '00000000-0000-0000-0000-000000000000',
          categoryId,
          title: 'Ghost order',
          description: 'FK violation test',
          price: new Decimal(10000),
          commissionRate: new Decimal(15),
          commissionAmount: new Decimal(1500),
          status: OrderStatus.DRAFT,
          offerAccepted: false,
        },
      })
    ).rejects.toThrow();
  });

  it('Decimal precision: balance корректно хранит копейки', async () => {
    await prisma.user.update({
      where: { id: clientId },
      data: { balance: new Decimal('123456.78') },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    expect(user.balance.toString()).toBe('123456.78');
  });
});
