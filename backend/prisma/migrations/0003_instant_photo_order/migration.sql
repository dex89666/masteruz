-- ============================================
-- MasterUz — Migration 0003: Instant Photo Order (ФотоЗаказ за 30 секунд)
-- Новая таблица ai_order_templates + поля AI в orders
-- ============================================

-- CreateEnum
CREATE TYPE "AiTier" AS ENUM ('GOOD', 'BETTER', 'BEST');

-- CreateTable
CREATE TABLE "ai_order_templates" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "tier" "AiTier" NOT NULL,
    "tier_label" TEXT NOT NULL,
    "task_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "materials" JSONB NOT NULL DEFAULT '[]',
    "estimated_price" DOUBLE PRECISION NOT NULL,
    "estimated_days" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "prompt" TEXT,
    "image_analysis" JSONB,
    "description" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_order_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add AI fields to orders
ALTER TABLE "orders" ADD COLUMN "is_instant_ai_order" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "ai_template_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "additional_wishes" TEXT;
ALTER TABLE "orders" ADD COLUMN "moderation_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "voice_description" TEXT;

-- CreateIndex
CREATE INDEX "ai_order_templates_category_id_tier_idx" ON "ai_order_templates"("category_id", "tier");

-- CreateIndex
CREATE INDEX "orders_ai_template_id_idx" ON "orders"("ai_template_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ai_template_id_fkey" FOREIGN KEY ("ai_template_id") REFERENCES "ai_order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_order_templates" ADD CONSTRAINT "ai_order_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
