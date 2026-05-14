-- Миграция: подтверждение выезда мастера + напоминания
-- При переводе ACCEPTED → IN_TRANSIT мастер указывает причину
-- ('MATERIAL' — едет за материалом, 'TO_CLIENT' — едет к клиенту)
-- и обещанное время прибытия. Cron шлёт пинг, если ETA истёк.

ALTER TABLE "orders"
  ADD COLUMN "transit_reason"        TEXT,
  ADD COLUMN "transit_eta_at"        TIMESTAMP(3),
  ADD COLUMN "last_master_ping_at"   TIMESTAMP(3);

CREATE INDEX "orders_status_transit_eta_at_idx"
  ON "orders" ("status", "transit_eta_at");
