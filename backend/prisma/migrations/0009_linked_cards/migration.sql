-- CreateTable
CREATE TABLE "linked_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_number" TEXT NOT NULL,
    "card_holder" TEXT,
    "expiry_month" INTEGER,
    "expiry_year" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'UZCARD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linked_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linked_cards_user_id_idx" ON "linked_cards"("user_id");

-- AddForeignKey
ALTER TABLE "linked_cards" ADD CONSTRAINT "linked_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
