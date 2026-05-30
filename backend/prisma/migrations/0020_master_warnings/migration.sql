-- ════════════════════════════════════════════════════════════════
-- MasterUz — Master Warnings & Auto-Block
-- ────────────────────────────────────────────────────────────────
-- Мастер отменяет принятый заказ ПОСЛЕ того как нажал «Выехал»
-- (статус IN_TRANSIT и далее) — на этом этапе он уже видит контакты
-- клиента, и случайностей быть не может. За такую отмену:
--   • штраф 15% от стоимости работ;
--   • +1 warning;
--   • при достижении 4 warnings — блокировка на 5 дней,
--     счётчик сбрасывается в 0.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "warning_count"   integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "blocked_until"   timestamptz,
  ADD COLUMN IF NOT EXISTS "last_warning_at" timestamptz;

CREATE INDEX IF NOT EXISTS "users_blocked_until_idx"
  ON "users" ("blocked_until")
  WHERE "blocked_until" IS NOT NULL;

-- История предупреждений — для прозрачности (мастер видит у себя в
-- профиле, админ — в карточке пользователя).
CREATE TABLE IF NOT EXISTS "master_warnings" (
  "id"              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"         text        NOT NULL REFERENCES "users"("id")  ON DELETE CASCADE,
  "order_id"        text                REFERENCES "orders"("id") ON DELETE SET NULL,
  "reason"          text        NOT NULL,                        -- 'CANCEL_AFTER_TRANSIT' и т.п.
  "penalty_amount"  numeric(12,2) NOT NULL DEFAULT 0,
  "warning_no"      integer     NOT NULL,                         -- 1..4 в текущем «цикле»
  "blocked_until"   timestamptz,                                  -- если этот warning вызвал блок
  "created_at"      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "master_warnings_user_idx"
  ON "master_warnings" ("user_id", "created_at" DESC);
