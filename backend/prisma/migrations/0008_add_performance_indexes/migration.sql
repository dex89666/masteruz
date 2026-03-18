-- Индексы производительности для критических запросов
-- Все CREATE INDEX IF NOT EXISTS — безопасно для повторного применения

-- Order: составные индексы для фильтрации заказов клиента/мастера по статусу
CREATE INDEX IF NOT EXISTS "orders_client_id_status_idx" ON "orders"("client_id", "status");
CREATE INDEX IF NOT EXISTS "orders_master_id_status_idx" ON "orders"("master_id", "status");

-- Payment: индекс для истории платежей пользователя
CREATE INDEX IF NOT EXISTS "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- Notification: индекс для пагинации уведомлений
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- Blacklist: индекс для быстрой проверки блокировки пользователя
CREATE INDEX IF NOT EXISTS "blacklist_user_id_idx" ON "blacklist"("user_id");

-- BalanceTransaction: индекс для фильтрации по типу операции (выписки)
CREATE INDEX IF NOT EXISTS "balance_transactions_user_id_type_idx" ON "balance_transactions"("user_id", "type");
