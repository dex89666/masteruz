-- ============================================================================
-- MasterUz — 0025: снимок прогноза AI на заказе (самообучение)
-- ----------------------------------------------------------------------------
-- До этого прогноз AI лежал только внутри ai_order_templates.image_analysis
-- (JSON), поэтому сравнить «что предсказали» с «что вышло по факту» можно было
-- лишь разбором JSON вручную. Плоские колонки делают точность измеримой
-- обычным SQL, а обучающий набор — собираемым автоматически по мере закрытия
-- заказов, без ручной разметки.
--
-- Факт берётся из самого заказа: orders.price и orders.category_id после
-- закрытия. Отдельно его дублировать не нужно — так не будет рассинхрона.
-- ============================================================================

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_predicted_price"       DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_predicted_category_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_confidence"            DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_needs_on_site"         BOOLEAN;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_model"                 TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ai_predicted_at"          TIMESTAMP(3);

-- Выборка обучающих примеров: закрытые заказы, по которым был прогноз.
CREATE INDEX IF NOT EXISTS "orders_ai_eval_idx"
  ON "orders" ("status", "ai_predicted_at")
  WHERE "ai_predicted_at" IS NOT NULL;
