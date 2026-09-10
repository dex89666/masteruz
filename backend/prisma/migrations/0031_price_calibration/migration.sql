-- ============================================================================
-- MasterUz — 0031: калибровка цен по реальным сделкам
-- ----------------------------------------------------------------------------
-- Экспертная цена стареет, а рынок уже говорит о себе двумя голосами, которые
-- лежат в базе и не используются ни одной строкой кода:
--   * order_responses.price_offer — сколько мастера ПРОСЯТ за заказ;
--   * orders.price после закрытия — сколько за него ЗАПЛАТИЛИ.
--
-- Чтобы разложить эти суммы обратно по позициям прайса, смете нужно помнить
-- свой состав в кодах — для этого ai_order_templates.price_lines.
-- ============================================================================

-- CreateEnum
CREATE TYPE "ObservationSource" AS ENUM ('MASTER_OFFER', 'FINAL_PRICE');

-- AlterTable: состав сметы в кодах позиций
ALTER TABLE "ai_order_templates"
  ADD COLUMN IF NOT EXISTS "price_lines" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "price_observations" (
    "id"          TEXT NOT NULL,
    "item_code"   TEXT NOT NULL,
    "order_id"    TEXT NOT NULL,
    "source"      "ObservationSource" NOT NULL,
    "qty"         DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit_price"  DECIMAL(12,2) NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- Повторный прогон сборщика не должен раздувать выборку копиями
CREATE UNIQUE INDEX "price_observations_order_item_source_key"
  ON "price_observations"("order_id", "item_code", "source");

-- Калибровщик читает окно по позиции: индекс покрывает и фильтр, и сортировку
CREATE INDEX "price_observations_item_code_observed_at_idx"
  ON "price_observations"("item_code", "observed_at");

-- Пауза после ручной правки: решение админа не перетирается ночным прогоном
ALTER TABLE "price_items"
  ADD COLUMN IF NOT EXISTS "manual_price_at" TIMESTAMP(3);
