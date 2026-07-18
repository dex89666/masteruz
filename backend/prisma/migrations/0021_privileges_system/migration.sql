-- CreateEnum: PrivilegeStatus
CREATE TYPE "PrivilegeStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum: PrivilegeType
CREATE TYPE "PrivilegeType" AS ENUM ('OFFICIAL', 'BUILDING_HEAD', 'BUSINESS_OWNER', 'DISTRICT_HEAD');

-- CreateTable: privileged_official_profiles
CREATE TABLE "privileged_official_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "document_number" TEXT,
    "document_url" TEXT,
    "privilege_type" "PrivilegeType" NOT NULL,
    "status" "PrivilegeStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "can_fast_track" BOOLEAN NOT NULL DEFAULT true,
    "can_assign_master" BOOLEAN NOT NULL DEFAULT true,
    "can_override_sla" BOOLEAN NOT NULL DEFAULT false,
    "can_access_analytics" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "renewal_notif_sent_at" TIMESTAMP(3),
    "target_sla_score" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "target_satisfaction" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "monthly_bonus_pool" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus_percentage" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "daily_fast_track_limit" INTEGER NOT NULL DEFAULT 5,
    "daily_fast_track_used" INTEGER NOT NULL DEFAULT 0,
    "daily_fast_track_reset_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privileged_official_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privileged_official_profiles_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "privileged_official_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "privileged_official_profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id")
);

-- CreateTable: privileged_actions
CREATE TABLE "privileged_actions" (
    "id" TEXT NOT NULL,
    "official_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_entity_type" TEXT NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privileged_actions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privileged_actions_official_id_fkey" FOREIGN KEY ("official_id") REFERENCES "privileged_official_profiles" ("id") ON DELETE CASCADE
);

-- CreateTable: kpi_records
CREATE TABLE "kpi_records" (
    "id" TEXT NOT NULL,
    "official_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "on_time_orders" INTEGER NOT NULL DEFAULT 0,
    "sla_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "total_complaints" INTEGER NOT NULL DEFAULT 0,
    "resolved_complaints" INTEGER NOT NULL DEFAULT 0,
    "avg_resolution_days" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_order_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "savings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus_earned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PRELIMINARY',
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kpi_records_official_id_fkey" FOREIGN KEY ("official_id") REFERENCES "privileged_official_profiles" ("id") ON DELETE CASCADE
);

-- CreateTable: official_order_priorities
CREATE TABLE "official_order_priorities" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "official_id" TEXT NOT NULL,
    "priority_level" INTEGER NOT NULL,
    "reason" TEXT,
    "custom_sla_hours" INTEGER,
    "bonus_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_order_priorities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "official_order_priorities_official_id_fkey" FOREIGN KEY ("official_id") REFERENCES "privileged_official_profiles" ("id") ON DELETE CASCADE
);

-- CreateTable: motivation_settings
CREATE TABLE "motivation_settings" (
    "id" TEXT NOT NULL,
    "privilege_type" "PrivilegeType" NOT NULL,
    "sla_threshold_pct" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
    "satisfaction_min" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "base_bonus_percentage" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "sla_bonus_boost" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "fast_track_limit" INTEGER NOT NULL DEFAULT 5,
    "max_custom_sla_hours" INTEGER NOT NULL DEFAULT 4,
    "renewal_days_before" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "motivation_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "motivation_settings_privilege_type_key" UNIQUE ("privilege_type")
);

-- CreateIndex
CREATE INDEX "privileged_official_profiles_status_expiresAt_idx" ON "privileged_official_profiles"("status", "expires_at");
CREATE INDEX "privileged_official_profiles_privilege_type_idx" ON "privileged_official_profiles"("privilege_type");
CREATE INDEX "privileged_official_profiles_user_id_idx" ON "privileged_official_profiles"("user_id");

-- CreateIndex
CREATE INDEX "privileged_actions_official_id_createdAt_idx" ON "privileged_actions"("official_id", "created_at");
CREATE INDEX "privileged_actions_action_createdAt_idx" ON "privileged_actions"("action", "created_at");
CREATE INDEX "privileged_actions_target_entity_type_target_entity_id_idx" ON "privileged_actions"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_records_official_id_period_key" ON "kpi_records"("official_id", "period");
CREATE INDEX "kpi_records_official_id_period_idx" ON "kpi_records"("official_id", "period");
CREATE INDEX "kpi_records_period_idx" ON "kpi_records"("period");

-- CreateIndex
CREATE UNIQUE INDEX "official_order_priorities_order_id_official_id_key" ON "official_order_priorities"("order_id", "official_id");
CREATE INDEX "official_order_priorities_official_id_createdAt_idx" ON "official_order_priorities"("official_id", "created_at");
CREATE INDEX "official_order_priorities_priority_level_idx" ON "official_order_priorities"("priority_level");
