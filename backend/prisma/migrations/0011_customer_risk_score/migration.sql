-- ============================================
-- MasterUz — Iteration 2: Customer Risk Score
-- + поля riskScore/riskUpdatedAt/riskFactors на users
-- + новая таблица master_reviews_client (мастер оценивает клиента)
-- ============================================

ALTER TABLE "users"
  ADD COLUMN "risk_score"      INTEGER  NOT NULL DEFAULT 50,
  ADD COLUMN "risk_updated_at" TIMESTAMP(3),
  ADD COLUMN "risk_factors"    JSONB;

CREATE INDEX "users_risk_score_idx" ON "users"("risk_score");

CREATE TABLE "master_reviews_client" (
  "id"              TEXT         NOT NULL,
  "order_id"        TEXT         NOT NULL,
  "master_id"       TEXT         NOT NULL,
  "client_id"       TEXT         NOT NULL,
  "overall"         INTEGER      NOT NULL,
  "was_rude"        BOOLEAN      NOT NULL DEFAULT false,
  "was_no_show"     BOOLEAN      NOT NULL DEFAULT false,
  "haggled_hard"    BOOLEAN      NOT NULL DEFAULT false,
  "changed_scope"   BOOLEAN      NOT NULL DEFAULT false,
  "delayed_payment" BOOLEAN      NOT NULL DEFAULT false,
  "comment"         TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "master_reviews_client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_reviews_client_order_master_unique"
  ON "master_reviews_client"("order_id", "master_id");

CREATE INDEX "master_reviews_client_client_idx"
  ON "master_reviews_client"("client_id");

ALTER TABLE "master_reviews_client"
  ADD CONSTRAINT "master_reviews_client_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "master_reviews_client"
  ADD CONSTRAINT "master_reviews_client_master_fk"
    FOREIGN KEY ("master_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "master_reviews_client"
  ADD CONSTRAINT "master_reviews_client_client_fk"
    FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
