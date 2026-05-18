#!/usr/bin/env bash
# ============================================================================
# MasterUz — синхронизация Cloudflare R2 credentials в Railway
# ----------------------------------------------------------------------------
# Шаги:
#   1) Скопируйте шаблон:   cp .env.r2.example .env.r2
#   2) Откройте .env.r2 и впишите 3 значения из Cloudflare R2:
#        R2_ACCESS_KEY_ID       — Access Key ID (S3 clients)
#        R2_SECRET_ACCESS_KEY   — Secret Access Key (S3 clients)
#        R2_S3_ENDPOINT         — Jurisdiction-specific endpoint, БЕЗ имени
#                                 бакета в конце (только хост,
#                                 например https://<acc>.r2.cloudflarestorage.com
#                                 или https://<acc>.eu.r2.cloudflarestorage.com)
#        R2_BUCKET              — имя бакета (по умолчанию masteruz)
#   3) ./scripts/railway-sync-r2.sh
#
# Файл .env.r2 уже в .gitignore — секреты не уйдут в репозиторий.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.r2"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Не найден $ENV_FILE" >&2
  echo "   Создайте: cp .env.r2.example .env.r2  и заполните значения." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

for var in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_S3_ENDPOINT; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ В $ENV_FILE не заполнено $var" >&2
    exit 1
  fi
done

R2_BUCKET="${R2_BUCKET:-masteruz}"

# Нормализуем endpoint: убираем завершающий слэш и (на всякий случай)
# название бакета, если пользователь его дописал.
ENDPOINT="${R2_S3_ENDPOINT%/}"
ENDPOINT="${ENDPOINT%/$R2_BUCKET}"

echo "→ Обновляю переменные Cloudflare R2 в Railway (masteruz-backend)…"
echo "   Endpoint: $ENDPOINT"
echo "   Bucket:   $R2_BUCKET"

railway variables \
  --service masteruz-backend \
  --skip-deploys \
  --set "BACKUP_S3_ENDPOINT=${ENDPOINT}" \
  --set "BACKUP_S3_BUCKET=${R2_BUCKET}" \
  --set "BACKUP_S3_ACCESS_KEY=${R2_ACCESS_KEY_ID}" \
  --set "BACKUP_S3_SECRET_KEY=${R2_SECRET_ACCESS_KEY}" \
  --set "BACKUP_S3_REGION=auto" >/dev/null

echo "✅ Переменные обновлены."
echo "→ Запускаю передеплой сервиса…"
railway redeploy --service masteruz-backend --yes

echo
echo "✅ Готово. Проверка после старта:"
echo "   curl https://masteruz-backend-production.up.railway.app/api/health/ready"
