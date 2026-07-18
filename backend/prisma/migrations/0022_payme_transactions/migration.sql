-- ============================================================================
-- MasterUz — 0022: транзакции протокола Payme Merchant API
-- ----------------------------------------------------------------------------
-- Отдельная таблица состояния транзакций Payme. Требуется протоколом:
--   * стабильные create_time / perform_time / cancel_time;
--   * собственная машина состояний (1, 2, -1, -2);
--   * методы CheckTransaction и GetStatement (сверка);
--   * идемпотентность CreateTransaction / PerformTransaction / CancelTransaction.
-- ============================================================================

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "payme_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "reason" INTEGER,
    "create_time" TIMESTAMP(3) NOT NULL,
    "perform_time" TIMESTAMP(3),
    "cancel_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_payme_id_key" ON "payment_transactions"("payme_id");

-- CreateIndex
CREATE INDEX "payment_transactions_payment_id_idx" ON "payment_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "payment_transactions_create_time_idx" ON "payment_transactions"("create_time");

-- CreateIndex
CREATE INDEX "payment_transactions_state_idx" ON "payment_transactions"("state");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
