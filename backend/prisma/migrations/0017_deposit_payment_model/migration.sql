-- ============================================================================
-- MasterUz — 0017: модель оплаты «30% депозит + 70% при завершении»
-- ----------------------------------------------------------------------------
-- 1. Новый статус AWAITING_REMAINDER (мастер подтвердил, клиент выбирает оплату).
-- 2. Новые типы транзакций: DEPOSIT_HOLD, REMAINDER_PAYMENT, FALSE_DISPUTE_PENALTY.
-- 3. Новые поля в orders: payment_model, deposit_amount, remaining_amount,
--    remainder_method, remainder_paid_at.
-- 4. Старые заказы помечаются payment_model='FULL_ESCROW' (бэккомпат).
-- ============================================================================

-- ── Enum: OrderStatus += AWAITING_REMAINDER ───────────────────────────────────
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_REMAINDER';

-- ── Enum: BalanceTransactionType += новые значения ────────────────────────────
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'DEPOSIT_HOLD';
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'REMAINDER_PAYMENT';
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'FALSE_DISPUTE_PENALTY';

-- ── orders: новые поля ────────────────────────────────────────────────────────
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_model"    TEXT       NOT NULL DEFAULT 'DEPOSIT_30';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deposit_amount"   DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "remaining_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "remainder_method" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "remainder_paid_at" TIMESTAMP(3);

-- ── Существующие заказы — это legacy FULL_ESCROW (полностью в эскроу) ─────────
-- Признак: created_at < сегодня (момент применения миграции).
UPDATE "orders"
SET "payment_model" = 'FULL_ESCROW',
    "deposit_amount" = "escrow_amount",
    "remaining_amount" = 0
WHERE "payment_model" = 'DEPOSIT_30'
  AND "created_at" < NOW();

-- ── Дефолт для новых заказов — настраиваемый процент депозита ─────────────────
INSERT INTO "platform_config" ("key", "value", "description")
VALUES
  ('deposit_rate', '30', 'Процент депозита, который клиент платит при создании заказа (0..100). Остаток оплачивается при завершении наличными или картой.'),
  ('false_dispute_penalty', '50000', 'Штраф клиенту (в сум) за ложный диспут после отказа от CASH-оплаты остатка.')
ON CONFLICT ("key") DO NOTHING;
