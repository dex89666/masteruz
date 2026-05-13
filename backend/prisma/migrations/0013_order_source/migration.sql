-- Добавление enum-источника заказа: DETAILED_WIZARD (визард) или INSTANT_AI (фото за 30 сек)
CREATE TYPE "OrderSource" AS ENUM ('DETAILED_WIZARD', 'INSTANT_AI');

ALTER TABLE "orders"
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'DETAILED_WIZARD';

-- Backfill: всё, что было создано через AI-фотозаказ, помечаем INSTANT_AI
UPDATE "orders"
  SET "source" = 'INSTANT_AI'
  WHERE "is_instant_ai_order" = TRUE;

CREATE INDEX "orders_source_idx" ON "orders" ("source");
