-- PRO-подписка мастера
-- 0016_master_pro_subscription

-- ENUMs
CREATE TYPE "MasterPlan" AS ENUM (
  'TRIAL',
  'MONTH',
  'QUARTER',
  'FIVE_MONTH',
  'YEAR',
  'REFERRAL',
  'FOUNDER'
);

CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED'
);

-- Главная таблица подписок
CREATE TABLE "master_subscriptions" (
  "id"                    TEXT PRIMARY KEY,
  "master_id"             TEXT NOT NULL,
  "plan"                  "MasterPlan" NOT NULL,
  "status"                "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_period_start"  TIMESTAMP(3) NOT NULL,
  "current_period_end"    TIMESTAMP(3) NOT NULL,
  "amount_paid"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "payment_id"            TEXT UNIQUE,
  "referrer_master_id"    TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "master_subscriptions_master_fk"
    FOREIGN KEY ("master_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "master_subscriptions_payment_fk"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL,
  CONSTRAINT "master_subscriptions_referrer_fk"
    FOREIGN KEY ("referrer_master_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "master_subscriptions_master_status_end_idx"
  ON "master_subscriptions" ("master_id", "status", "current_period_end");
CREATE INDEX "master_subscriptions_end_idx"
  ON "master_subscriptions" ("current_period_end");
