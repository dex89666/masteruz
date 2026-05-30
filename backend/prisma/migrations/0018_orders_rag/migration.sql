-- ════════════════════════════════════════════════════════════════
-- MasterUz — RAG / самообучаемый поиск решений по истории заказов
-- ════════════════════════════════════════════════════════════════
-- Идея: каждый завершённый заказ становится «обучающим примером».
-- При новом запросе AI ищет 3 наиболее похожих закрытых заказа по
-- косинусному расстоянию embedding-вектора и подставляет их в
-- system-prompt — Claude/GPT не генерирует с нуля, а опирается на
-- реальные цены и решения узбекского рынка.
--
-- Размер вектора 1536 = OpenAI `text-embedding-3-small`.
-- Индекс HNSW: для нашего объёма (десятки тыс. заказов) HNSW даёт
-- лучший recall/latency, чем ivfflat, и не требует пересборки при
-- росте таблицы.
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Когда вектор пересчитан в последний раз. Нужно чтобы backfill и
-- горячие хуки знали, какие заказы уже обработаны и не дублировали
-- работу при перезапусках.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "embedding_updated_at" timestamptz;

-- HNSW по cosine distance. m=16, ef_construction=64 — дефолты, дают
-- хороший баланс между скоростью построения и качеством поиска.
CREATE INDEX IF NOT EXISTS "orders_embedding_hnsw_idx"
  ON "orders" USING hnsw ("embedding" vector_cosine_ops);
