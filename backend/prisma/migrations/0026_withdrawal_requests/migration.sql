-- ============================================================================
-- MasterUz — 0026: вывод средств мастером
-- ----------------------------------------------------------------------------
-- До этой миграции мастер не мог получить заработанное: деньги начислялись
-- на внутренний баланс (тип PAYOUT) и оставались в системе навсегда —
-- механизма вывода не существовало ни в схеме, ни в API, ни в интерфейсе.
--
-- Ключевое правило модели: сумма СПИСЫВАЕТСЯ при создании заявки, а не при
-- её одобрении. Иначе мастер мог бы потратить те же деньги, пока заявка
-- в очереди, и платформа ушла бы в минус. Возврат — при отклонении/отзыве.
--
-- Реквизиты карты копируются в заявку снимком: карту могут удалить или
-- изменить, а платёжное поручение должно остаться воспроизводимым.
-- ============================================================================

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- Новые типы балансовых транзакций
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_REFUND';

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payout_amount" DECIMAL(12,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "card_id" TEXT,
    "card_number" TEXT NOT NULL,
    "card_holder" TEXT,
    "card_provider" TEXT,
    "processed_by_id" TEXT,
    "processed_at" TIMESTAMP(3),
    "admin_note" TEXT,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_requests_user_id_created_at_idx" ON "withdrawal_requests"("user_id", "created_at");

-- CreateIndex: очередь обработки для админа
CREATE INDEX "withdrawal_requests_status_created_at_idx" ON "withdrawal_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_id_fkey"
  FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Настройки вывода средств (меняются админом без релиза) ───────────────────
INSERT INTO "platform_config" ("id", "key", "value", "description", "updated_at")
VALUES
  (gen_random_uuid(), 'withdrawal_min_amount', '50000',
   'Минимальная сумма вывода средств мастером (сум)', NOW()),
  (gen_random_uuid(), 'withdrawal_commission_rate', '0',
   'Комиссия платформы за вывод средств (%). 0 = вывод бесплатный', NOW()),
  (gen_random_uuid(), 'withdrawal_enabled', 'true',
   'Разрешён ли вывод средств мастерами', NOW())
ON CONFLICT ("key") DO NOTHING;
