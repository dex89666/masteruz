#!/usr/bin/env bash
# ============================================================================
# MasterUz — ручной бэкап production-базы
# ----------------------------------------------------------------------------
# Зачем скрипт: автобэкап в GitHub Actions падает при блокировке биллинга
# и делает это МОЛЧА. Этот скрипт не зависит от GitHub и от локально
# установленного pg_dump — версия клиента берётся из Docker-образа,
# совпадающего с сервером.
#
# ВАЖНО: дамп содержит персональные данные пользователей. Он пишется в
# ~/backups/masteruz (вне репозитория) — не переносите его в проект.
#
# ВОССТАНОВЛЕНИЕ требует расширения pgvector: в orders есть колонка
# embedding vector(1536), и на «голом» postgres таблица orders НЕ создастся.
# Проверено: на образе postgres:18 заказы теряются, на pgvector/pgvector:pg18
# восстанавливается без единой ошибки.
#
#   Бэкап:         ./scripts/backup-db.sh
#   Восстановить:  gunzip -c FILE.sql.gz | psql "$DATABASE_URL"
#                  (СУБД должна иметь pgvector)
# ============================================================================

set -euo pipefail

PG_IMAGE="${PG_IMAGE:-postgres:18}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/masteruz}"
KEEP_LAST="${KEEP_LAST:-14}"   # сколько копий хранить

# DATABASE_URL: из окружения либо из backend/.env
if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_FILE="$(dirname "$0")/../backend/.env"
  if [[ -f "$ENV_FILE" ]]; then
    DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'')"
  fi
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL не задан (ни в окружении, ни в backend/.env)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/masteruz-$TS.sql"

echo "→ Снимаю дамп через $PG_IMAGE ..."
docker run --rm "$PG_IMAGE" pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$OUT"

# Дамп, оборванный на середине, выглядит как обычный файл — проверяем маркер.
if ! grep -q "PostgreSQL database dump complete" "$OUT"; then
  echo "❌ Дамп неполный — файл удалён, бэкап НЕ создан" >&2
  rm -f "$OUT"
  exit 1
fi

TABLES="$(grep -c '^CREATE TABLE' "$OUT" || true)"
gzip -f "$OUT"
echo "✅ Бэкап готов: $OUT.gz  ($(du -h "$OUT.gz" | cut -f1), таблиц: $TABLES)"

# Отметка об успехе в БД: бэкенд ежечасно проверяет её свежесть и поднимает
# тревогу, если бэкапов давно нет. Именно молчание, а не явная ошибка,
# оставило базу без копии на месяц — поэтому пишем только при УСПЕХЕ.
docker run --rm -i "$PG_IMAGE" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL || echo "⚠ не удалось записать отметку (бэкап при этом создан)"
INSERT INTO platform_config (id, key, value, description, updated_at)
VALUES (gen_random_uuid(), 'last_backup_at', now()::text,
        'Время последнего успешного бэкапа БД (пишется скриптом бэкапа)', now())
ON CONFLICT (key) DO UPDATE SET value = now()::text, updated_at = now();
SQL

# Ротация: старые копии удаляем, чтобы диск не забился.
cd "$BACKUP_DIR"
ls -1t masteruz-*.sql.gz 2>/dev/null | tail -n "+$((KEEP_LAST + 1))" | while read -r old; do
  rm -f "$old"
  echo "  удалена старая копия: $old"
done

echo "Всего копий: $(ls -1 masteruz-*.sql.gz 2>/dev/null | wc -l)"
