-- ════════════════════════════════════════════════════════════════
-- MasterUz — Knowledge Base (самообучаемые «рецепты» решений)
-- ────────────────────────────────────────────────────────────────
-- L1 — история заказов (orders.embedding) уже даёт «похожие кейсы».
-- L2 — knowledge_entries даёт ОБОБЩЁННОЕ знание: проблема → диагноз
-- → шаги ремонта → материалы → ориентир цены. Создаётся AI один
-- раз при закрытии заказа, и сливается с уже существующими «рецептами».
-- Чем больше заказов закрыто, тем точнее становится база.
--
-- ВАЖНО: тут не «копия заказов». Это извлечённое знание, переиспользуемое
-- между разными клиентами. Один рецепт обслуживает десятки кейсов.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "knowledge_entries" (
  "id"                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "category_id"         text NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,

  -- Короткая «подпись» проблемы — что мы видим. Используется для
  -- быстрой человекочитаемой идентификации рецепта.
  "problem_signature"   text NOT NULL,

  -- Развёрнутое описание проблемы (нормализованное AI).
  "problem_description" text NOT NULL,

  -- Что AI «диагностировал»: вероятная причина поломки.
  "diagnosis"           text,

  -- Список вероятных корневых причин (в порядке убывания вероятности).
  "root_causes"         text[] NOT NULL DEFAULT '{}',

  -- Пошаговый план ремонта: [{step: int, action: text, tool?: text}]
  "solution_steps"      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Материалы: [{name, quantity, unit, approxPrice}]
  "materials"           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Диапазон итоговой цены, накопленный из реальных закрытых заказов.
  "price_min"           numeric(12,2),
  "price_max"           numeric(12,2),
  "price_avg"           numeric(12,2),

  -- Визуальные теги, распознанные AI на фото:
  -- "автомобильный замок", "личинка цилиндра", "врезной замок",
  -- "выключатель Schneider", "латунный смеситель". Хранятся отдельно
  -- от описания, потому что они дают сильный сигнал в поиске.
  "visual_tags"         text[] NOT NULL DEFAULT '{}',

  -- Источники: какие заказы сгенерировали этот рецепт. Накапливается
  -- по мере слияний.
  "source_order_ids"    text[] NOT NULL DEFAULT '{}',

  -- Сколько раз рецепт был «процитирован» в новых запросах.
  -- Фронт может показывать «Решено N раз».
  "hits"                int NOT NULL DEFAULT 0,

  -- Уверенность рецепта: 0..1, накапливается через слияния.
  "confidence"          double precision NOT NULL DEFAULT 0.5,

  -- Embedding для семантического поиска. Строится из problem_signature
  -- + problem_description + visual_tags.
  "embedding"           vector(1536),

  "created_at"          timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "knowledge_entries_category_idx"
  ON "knowledge_entries" ("category_id");

CREATE INDEX IF NOT EXISTS "knowledge_entries_embedding_hnsw_idx"
  ON "knowledge_entries" USING hnsw ("embedding" vector_cosine_ops);

-- Полнотекстовый GIN по тегам — даёт быстрый фильтр «где встречалось
-- слово ‘замок’» в дополнение к семантическому поиску.
CREATE INDEX IF NOT EXISTS "knowledge_entries_visual_tags_gin"
  ON "knowledge_entries" USING gin ("visual_tags");
