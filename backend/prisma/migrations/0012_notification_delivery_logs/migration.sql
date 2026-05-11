-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "error_code" INTEGER,
    "description" TEXT,
    "match_mode" TEXT,
    "distance_km" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_delivery_logs_order_id_idx" ON "notification_delivery_logs"("order_id");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_user_id_created_at_idx" ON "notification_delivery_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_status_created_at_idx" ON "notification_delivery_logs"("status", "created_at");
