-- ============================================
-- MasterUz — Order auto-cancel reminders
-- Счётчик отправленных напоминаний мастерам/админам перед автоотменой
-- ============================================

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminders_sent" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "orders_status_master_id_created_at_idx"
  ON "orders" ("status", "master_id", "created_at");
