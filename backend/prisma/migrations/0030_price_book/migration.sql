-- ============================================================================
-- MasterUz — 0030: прайс-реестр в базе
-- ----------------------------------------------------------------------------
-- Цены жили в двух несвязанных местах: справочник решений в pricing-catalog.ts
-- (правился только деплоем) и Task.min_price в каталоге услуг. Один и тот же
-- заказ считался по разным прайсам в зависимости от того, сматчилась проблема
-- по ключевым словам или нет.
--
-- Структура каталога решений переносится в БД целиком, чтобы:
--   * цену можно было править из админки, с историей версий;
--   * калибровщик (неделя 4) двигал цену позиции, не трогая структуру решения;
--   * подбор проблемы шёл векторным поиском, а не скорингом по длине слова.
--
-- Данные переносятся скриптом scripts/pricebook/import-from-catalogs.ts.
-- ============================================================================

-- CreateEnum
CREATE TYPE "PriceItemKind" AS ENUM ('LABOR', 'MATERIAL');
CREATE TYPE "PriceSource" AS ENUM ('EXPERT', 'CALIBRATED');
CREATE TYPE "PriceModifierType" AS ENUM ('REGION', 'URGENCY', 'FLOOR', 'ACCESS', 'SEASON');
CREATE TYPE "MaterialClass" AS ENUM ('STANDARD', 'ENHANCED', 'PREMIUM');

-- CreateTable: атомарная позиция прайса
CREATE TABLE "price_items" (
    "id"            TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "name_uz"       TEXT,
    "name_en"       TEXT,
    "unit"          TEXT NOT NULL,
    "kind"          "PriceItemKind" NOT NULL DEFAULT 'LABOR',
    "unit_price"    DECIMAL(12,2) NOT NULL,
    "min_check"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "labor_minutes" INTEGER NOT NULL DEFAULT 60,
    "category_slug" TEXT NOT NULL,
    "task_slug"     TEXT,
    "source"        "PriceSource" NOT NULL DEFAULT 'EXPERT',
    "sample_size"   INTEGER NOT NULL DEFAULT 0,
    "price_p25"     DECIMAL(12,2),
    "price_p75"     DECIMAL(12,2),
    "calibrated_at" TIMESTAMP(3),
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_items_code_key" ON "price_items"("code");
CREATE INDEX "price_items_category_slug_idx" ON "price_items"("category_slug");
CREATE INDEX "price_items_kind_idx" ON "price_items"("kind");
CREATE INDEX "price_items_task_slug_idx" ON "price_items"("task_slug");

-- CreateTable: узнаваемая проблема в категории
CREATE TABLE "price_problems" (
    "id"            TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "keywords"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "sort_order"    INTEGER NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_problems_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_problems_slug_key" ON "price_problems"("slug");
CREATE INDEX "price_problems_category_slug_idx" ON "price_problems"("category_slug");

-- Векторный поиск проблемы (pgvector уже включён миграцией 0018)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "price_problems" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
CREATE INDEX IF NOT EXISTS "price_problems_embedding_idx"
  ON "price_problems" USING hnsw ("embedding" vector_cosine_ops);

-- CreateTable: решение уровня GOOD / BETTER / BEST
CREATE TABLE "price_solutions" (
    "id"             TEXT NOT NULL,
    "problem_id"     TEXT NOT NULL,
    "tier"           "AiTier" NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "days"           INTEGER NOT NULL DEFAULT 1,
    "material_class" "MaterialClass" NOT NULL DEFAULT 'STANDARD',

    CONSTRAINT "price_solutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_solutions_problem_id_tier_key" ON "price_solutions"("problem_id", "tier");
CREATE INDEX "price_solutions_problem_id_idx" ON "price_solutions"("problem_id");

-- CreateTable: позиция решения с количеством
CREATE TABLE "price_solution_lines" (
    "id"          TEXT NOT NULL,
    "solution_id" TEXT NOT NULL,
    "item_id"     TEXT NOT NULL,
    "qty"         DECIMAL(10,3) NOT NULL DEFAULT 1,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "price_solution_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_solution_lines_solution_id_idx" ON "price_solution_lines"("solution_id");
CREATE INDEX "price_solution_lines_item_id_idx" ON "price_solution_lines"("item_id");

-- CreateTable: множители (район, срочность, этаж, доступ, сезон)
CREATE TABLE "price_modifiers" (
    "id"         TEXT NOT NULL,
    "type"       "PriceModifierType" NOT NULL,
    "key"        TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "factor"     DECIMAL(5,3) NOT NULL DEFAULT 1.000,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_modifiers_type_key_key" ON "price_modifiers"("type", "key");

-- CreateTable: история версий прайса
CREATE TABLE "price_book_versions" (
    "id"            TEXT NOT NULL,
    "version"       INTEGER NOT NULL,
    "reason"        TEXT NOT NULL,
    "changed_by_id" TEXT,
    "changes"       JSONB NOT NULL DEFAULT '[]',
    "items_touched" INTEGER NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_book_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_book_versions_version_key" ON "price_book_versions"("version");
CREATE INDEX "price_book_versions_created_at_idx" ON "price_book_versions"("created_at");

-- AddForeignKey
ALTER TABLE "price_solutions"
  ADD CONSTRAINT "price_solutions_problem_id_fkey"
  FOREIGN KEY ("problem_id") REFERENCES "price_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_solution_lines"
  ADD CONSTRAINT "price_solution_lines_solution_id_fkey"
  FOREIGN KEY ("solution_id") REFERENCES "price_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_solution_lines"
  ADD CONSTRAINT "price_solution_lines_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "price_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
