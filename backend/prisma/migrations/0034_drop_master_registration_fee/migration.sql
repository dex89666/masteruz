-- Регистрация мастера бесплатная: взнос отменён, признак оплаты больше не нужен.
-- Старые платежи с типом REGISTRATION_FEE остаются в истории платежей.
ALTER TABLE "master_profiles" DROP COLUMN IF EXISTS "registration_paid";
ALTER TABLE "master_profiles" DROP COLUMN IF EXISTS "registration_paid_at";
