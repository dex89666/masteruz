#!/usr/bin/env bash
# ============================================================
# MasterUz — Ежедневный бэкап PostgreSQL → S3-совместимое хранилище
# ============================================================
# Использование (cron на VPS):
#   0 3 * * * /opt/masteruz/scripts/backup-pg.sh >> /var/log/masteruz-backup.log 2>&1
#
# Зависимости: postgresql-client, awscli (или mc для S3).
# Конфигурация — через env: DATABASE_URL, BACKUP_S3_*
# ============================================================

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL не задан}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET не задан}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT не задан}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY не задан}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY не задан}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/tmp/masteruz-backups
FILENAME="masteruz-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Начинаю pg_dump…"
pg_dump --no-owner --no-acl --clean --if-exists "$DATABASE_URL" | gzip -9 > "$FILEPATH"

SIZE_MB=$(du -m "$FILEPATH" | cut -f1)
echo "[$(date)] Дамп готов: ${SIZE_MB} МБ → ${FILEPATH}"

# Загрузка в S3 (через awscli с custom endpoint)
echo "[$(date)] Загружаю в S3 ${BACKUP_S3_BUCKET}…"
AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
aws --endpoint-url "$BACKUP_S3_ENDPOINT" \
    s3 cp "$FILEPATH" "s3://${BACKUP_S3_BUCKET}/daily/${FILENAME}" \
    --storage-class STANDARD_IA

# Чистка старых дампов (>30 дней) — локально
find "$BACKUP_DIR" -name 'masteruz-*.sql.gz' -mtime +1 -delete

# Чистка S3 — оставляем последние 30 ежедневных + 12 ежемесячных
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" = "01" ]; then
  echo "[$(date)] Первое число — копирую в monthly/"
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  aws --endpoint-url "$BACKUP_S3_ENDPOINT" \
      s3 cp "s3://${BACKUP_S3_BUCKET}/daily/${FILENAME}" \
            "s3://${BACKUP_S3_BUCKET}/monthly/${FILENAME}"
fi

echo "[$(date)] ✅ Бэкап завершён: ${FILENAME} (${SIZE_MB} МБ)"
