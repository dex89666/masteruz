-- ============================================
-- MasterUz — Migration: Estimation + Chat Moderation + Blacklist Extensions
-- Добавляет: систему оценки, модерацию чата, расширение чёрного списка
-- ============================================

-- 1. Расширяем enum OrderStatus новыми статусами для оценки
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ESTIMATION_IN_PROGRESS';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ESTIMATION_DONE';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ESTIMATE_SENT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ESTIMATE_APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ESTIMATE_REJECTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'MODERATION';

-- 2. Создаём enum EstimateStatus
DO $$ BEGIN
    CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'MODERATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Расширяем enum BalanceTransactionType
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'ESTIMATION_FEE';
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'ESTIMATE_PAYOUT';

-- 4. Расширяем enum PaymentType
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'ESTIMATION_FEE';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'ESTIMATE_PAYMENT';

-- 5. Добавляем поля оценки в таблицу orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_estimation_order" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "estimation_fee" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parent_order_id" TEXT;

-- Индекс и FK для parent_order_id (цепочка оценка → основной заказ)
ALTER TABLE "orders" ADD CONSTRAINT "orders_parent_order_id_fkey"
    FOREIGN KEY ("parent_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Добавляем поля модерации в chat_messages
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "is_flagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "flag_reason" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "is_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "moderated_by_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMP(3);

-- Индекс для быстрой выборки флагированных сообщений
CREATE INDEX IF NOT EXISTS "chat_messages_is_flagged_idx" ON "chat_messages"("is_flagged");

-- 7. Расширяем таблицу blacklist
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "violation_type" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "evidence" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "telegram_location" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "penalty_amount" DOUBLE PRECISION;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "blacklist" ADD COLUMN IF NOT EXISTS "is_permanent" BOOLEAN NOT NULL DEFAULT true;

-- Индекс для violation_type
CREATE INDEX IF NOT EXISTS "blacklist_violation_type_idx" ON "blacklist"("violation_type");

-- 8. Создаём таблицу estimates (сметы)
CREATE TABLE IF NOT EXISTS "estimates" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "work_items" JSONB NOT NULL DEFAULT '[]',
    "material_items" JSONB NOT NULL DEFAULT '[]',
    "work_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "material_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated_days" INTEGER,
    "notes" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moderated_by_id" TEXT,
    "moderated_at" TIMESTAMP(3),
    "moderation_note" TEXT,
    "client_response_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- Индексы для estimates
CREATE INDEX IF NOT EXISTS "estimates_order_id_idx" ON "estimates"("order_id");
CREATE INDEX IF NOT EXISTS "estimates_master_id_idx" ON "estimates"("master_id");
CREATE INDEX IF NOT EXISTS "estimates_status_idx" ON "estimates"("status");

-- FK для estimates
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_master_id_fkey"
    FOREIGN KEY ("master_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
