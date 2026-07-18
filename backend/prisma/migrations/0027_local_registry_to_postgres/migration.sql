-- ============================================================================
-- MasterUz — 0027: локальный реестр из файлов в Postgres
-- ----------------------------------------------------------------------------
-- Реестр писал в data/*.json относительно cwd, то есть в /app/data внутри
-- контейнера. Volume Railway смонтирован в /app/uploads — значит /app/data
-- был эфемерной файловой системой, и КАЖДЫЙ деплой стирал записи.
--
-- Терялось при этом существенное:
--   * ПИНФЛ мастеров (персональный идентификатор РУз), ФИО, адреса;
--   * записи о согласии с офертой и политиками — юридическое подтверждение
--     того, что пользователь принял документы, с версией, IP и временем.
--
-- Побочный эффект для пользователей: после каждого деплоя ConsentGate
-- снова требовал принять документы, потому что история согласий исчезала.
-- ============================================================================

-- CreateTable
CREATE TABLE "local_clients" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_masters" (
    "id" TEXT NOT NULL,
    "pinfl" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "work_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed_work" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "local_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "identity_key" TEXT NOT NULL,
    "accepted_offer" BOOLEAN NOT NULL,
    "accepted_privacy" BOOLEAN NOT NULL,
    "accepted_data_processing" BOOLEAN NOT NULL,
    "documents_version" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- ПИНФЛ уникален: один мастер — одна запись в реестре.
CREATE UNIQUE INDEX "local_masters_pinfl_key" ON "local_masters"("pinfl");

CREATE INDEX "local_clients_created_at_idx" ON "local_clients"("created_at");
CREATE INDEX "local_masters_created_at_idx" ON "local_masters"("created_at");

-- Проверка «есть ли согласие» ищет по паре ключ + версия документов.
CREATE INDEX "consent_records_identity_key_documents_version_idx"
  ON "consent_records"("identity_key", "documents_version");
CREATE INDEX "consent_records_accepted_at_idx" ON "consent_records"("accepted_at");
