#!/bin/bash
# ============================================
# MasterUz — Database Backup Script
# Добавьте в crontab: 0 3 * * * /opt/masteruz/scripts/backup.sh
# ============================================

set -e

cd /opt/masteruz
export $(grep -v '^#' .env.production | xargs)

BACKUP_DIR="/opt/masteruz/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/masteruz_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup: $BACKUP_FILE"

docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U masteruz masteruz | gzip > "$BACKUP_FILE"

# Keep only last 7 backups
ls -tp "$BACKUP_DIR"/*.sql.gz | tail -n +8 | xargs -I {} rm -- {} 2>/dev/null || true

echo "✅ Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
