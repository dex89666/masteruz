-- Гарантию на работы даёт мастер: срок по умолчанию в профиле и срок в каждом отклике.
ALTER TABLE "master_profiles" ADD COLUMN IF NOT EXISTS "warranty_days" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "order_responses" ADD COLUMN IF NOT EXISTS "warranty_days" INTEGER;
