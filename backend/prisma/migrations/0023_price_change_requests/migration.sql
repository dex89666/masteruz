-- ============================================================================
-- MasterUz — 0023: изменение цены заказа по ходу работ
-- ----------------------------------------------------------------------------
-- Мастер может предложить новую цену (доп. работы / уточнение объёма).
-- Любое изменение требует ЯВНОГО подтверждения клиента.
--   * рост ≤ price_change_limit_pct (20%)  → достаточно согласия клиента;
--   * рост >  price_change_limit_pct       → дополнительно модерация админом;
--   * суммарный рост ограничен price_change_max_total_pct (50%).
-- При отказе клиента создаётся запись kind=SETTLEMENT: мастер заявляет
-- фактически выполненный объём, клиент подтверждает либо открывает спор.
-- ============================================================================

-- CreateEnum
CREATE TYPE "PriceChangeKind" AS ENUM ('PRICE_CHANGE', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "PriceChangeStatus" AS ENUM ('PENDING', 'MODERATION', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "price_change_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "kind" "PriceChangeKind" NOT NULL DEFAULT 'PRICE_CHANGE',
    "status" "PriceChangeStatus" NOT NULL DEFAULT 'PENDING',
    "old_price" DECIMAL(12,2) NOT NULL,
    "new_price" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moderated_by_id" TEXT,
    "moderated_at" TIMESTAMP(3),
    "moderator_note" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_change_requests_order_id_idx" ON "price_change_requests"("order_id");

-- CreateIndex
CREATE INDEX "price_change_requests_status_idx" ON "price_change_requests"("status");

-- CreateIndex
CREATE INDEX "price_change_requests_order_id_status_idx" ON "price_change_requests"("order_id", "status");

-- AddForeignKey
ALTER TABLE "price_change_requests" ADD CONSTRAINT "price_change_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_change_requests" ADD CONSTRAINT "price_change_requests_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Настройки платформы: лимиты изменения цены ───────────────────────────────
INSERT INTO "platform_config" ("id", "key", "value", "description", "updated_at")
VALUES
  (gen_random_uuid(), 'price_change_limit_pct', '20', 'Макс. рост цены за одно изменение без модерации админом (%). Согласие клиента требуется всегда.', NOW()),
  (gen_random_uuid(), 'price_change_max_total_pct', '50', 'Макс. суммарный рост цены от изначальной стоимости заказа (%).', NOW())
ON CONFLICT ("key") DO NOTHING;

-- ── Плата за выезд мастера: 100 000 сум (меняется админом без релиза) ────────
INSERT INTO "platform_config" ("id", "key", "value", "description", "updated_at")
VALUES (gen_random_uuid(), 'visit_fee', '100000', 'Фиксированная плата за выезд мастера (сум).', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = '100000', "updated_at" = NOW();
