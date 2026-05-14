-- Миграция: persisting последняя известная гео-позиция мастера во время доставки.
-- Используется для подтверждения прибытия даже если в момент клика «Я приехал»
-- браузер не успел получить свежие координаты (вкладка была в фоне, сон и т.д.).

ALTER TABLE "orders"
  ADD COLUMN "master_lat"          DOUBLE PRECISION,
  ADD COLUMN "master_lng"          DOUBLE PRECISION,
  ADD COLUMN "master_location_at"  TIMESTAMP(3);

CREATE INDEX "orders_status_master_location_at_idx"
  ON "orders" ("status", "master_location_at");
