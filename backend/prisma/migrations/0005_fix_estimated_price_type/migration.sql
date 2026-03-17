-- ============================================
-- MasterUz — Migration 0005: Fix estimated_price column type
-- Ensure DOUBLE PRECISION (not Decimal) for estimated_price
-- Fixes "numeric field overflow" error
-- ============================================

-- AlterColumn: Force DOUBLE PRECISION type
ALTER TABLE "ai_order_templates" ALTER COLUMN "estimated_price" TYPE DOUBLE PRECISION USING "estimated_price"::DOUBLE PRECISION;
