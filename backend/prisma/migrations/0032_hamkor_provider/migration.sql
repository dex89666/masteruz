-- Hamkorbank (UzQR) — единственный онлайн-провайдер с 2026-10.
-- Старые значения CLICK/PAYME/TELEGRAM_STARS остаются: на них ссылается история платежей.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'HAMKOR';
