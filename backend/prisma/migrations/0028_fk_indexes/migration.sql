-- ============================================================================
-- MasterUz — 0028: индексы на внешние ключи
-- ----------------------------------------------------------------------------
-- Postgres НЕ создаёт индекс на внешний ключ автоматически (в отличие от
-- первичного). Без него каждый JOIN и каждая проверка ссылочной целостности
-- при удалении родительской строки идут последовательным сканом.
--
-- Сейчас данных мало и это незаметно, но список включает горячие пути:
-- payments.order_id, order_responses.master_id, order_tasks.task_id,
-- categories.parent_id — они участвуют в выборках на каждом экране.
-- Дешевле добавить сразу, чем ловить деградацию на росте.
--
-- CONCURRENTLY не используем: внутри транзакции миграции он недоступен,
-- а на текущем объёме данных блокировка мгновенная.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "ai_order_templates_created_by_id_idx" ON "ai_order_templates"("created_by_id");
CREATE INDEX IF NOT EXISTS "blacklist_blocked_by_id_idx" ON "blacklist"("blocked_by_id");
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories"("parent_id");
CREATE INDEX IF NOT EXISTS "certificates_user_id_idx" ON "certificates"("user_id");
CREATE INDEX IF NOT EXISTS "course_progress_course_id_idx" ON "course_progress"("course_id");
CREATE INDEX IF NOT EXISTS "favorite_masters_master_id_idx" ON "favorite_masters"("master_id");
CREATE INDEX IF NOT EXISTS "master_reviews_client_master_id_idx" ON "master_reviews_client"("master_id");
CREATE INDEX IF NOT EXISTS "master_subscriptions_referrer_master_id_idx" ON "master_subscriptions"("referrer_master_id");
CREATE INDEX IF NOT EXISTS "master_warnings_order_id_idx" ON "master_warnings"("order_id");
CREATE INDEX IF NOT EXISTS "order_responses_master_id_idx" ON "order_responses"("master_id");
CREATE INDEX IF NOT EXISTS "orders_parent_order_id_idx" ON "orders"("parent_order_id");
CREATE INDEX IF NOT EXISTS "order_tasks_task_id_idx" ON "order_tasks"("task_id");
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "platform_config_updated_by_id_idx" ON "platform_config"("updated_by_id");
CREATE INDEX IF NOT EXISTS "portfolio_items_category_id_idx" ON "portfolio_items"("category_id");
CREATE INDEX IF NOT EXISTS "price_change_requests_master_id_idx" ON "price_change_requests"("master_id");
CREATE INDEX IF NOT EXISTS "privileged_official_profiles_approved_by_idx" ON "privileged_official_profiles"("approved_by");
CREATE INDEX IF NOT EXISTS "promo_code_usages_user_id_idx" ON "promo_code_usages"("user_id");
CREATE INDEX IF NOT EXISTS "referrals_referred_id_idx" ON "referrals"("referred_id");
CREATE INDEX IF NOT EXISTS "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");
CREATE INDEX IF NOT EXISTS "school_courses_category_id_idx" ON "school_courses"("category_id");
CREATE INDEX IF NOT EXISTS "store_reviews_user_id_idx" ON "store_reviews"("user_id");
CREATE INDEX IF NOT EXISTS "support_messages_sender_id_idx" ON "support_messages"("sender_id");
CREATE INDEX IF NOT EXISTS "users_referred_by_id_idx" ON "users"("referred_by_id");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_processed_by_id_idx" ON "withdrawal_requests"("processed_by_id");
