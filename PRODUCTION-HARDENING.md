# 🛡️ Production Hardening Checklist

> Запускается параллельно с DEPLOY.md. После выполнения всех 12 пунктов
> платформа готова к публичному запуску с защитой от типичных атак.

---

## ✅ 1. Yandex Maps API ключ

**Зачем:** Без ключа `api-maps.yandex.ru` отдаёт 403 после ~25k запросов/день.

**Шаги:**
1. Открыть https://developer.tech.yandex.ru/services/
2. Создать новый ключ типа **JavaScript API и HTTP Геокодер**
3. В Railway:
```bash
railway variables --service masteruz-frontend --set "VITE_YANDEX_MAPS_KEY=<ключ>"
railway variables --service masteruz-backend  --set "YANDEX_MAPS_API_KEY=<ключ>"
```

---

## ✅ 2. Sentry — мониторинг ошибок

**Зачем:** ловить 500-е и React-краши с алертами.

**Шаги:**
1. Зарегистрироваться на https://sentry.io (free 5k events/мес)
2. Создать **Node** и **React** проекты
3. В Railway:
```bash
railway variables --service masteruz-backend  --set "SENTRY_DSN=https://xxx@sentry.io/yyy"
railway variables --service masteruz-frontend --set "VITE_SENTRY_DSN=https://aaa@sentry.io/bbb"
```

Код автоматически активирует Sentry при заполненном DSN. Placeholder `__SET_ME__` игнорируется.

---

## ✅ 3. Платежи Click + Payme

**Зачем:** реальный приём денег от клиентов.

**Документы:**
- Click: договор оферты, ИНН, расчётный счёт → https://merchant.click.uz
- Payme: договор + банковские реквизиты → https://business.payme.uz

После получения данных:
```bash
railway variables --service masteruz-backend \
  --set "CLICK_MERCHANT_ID=..." \
  --set "CLICK_SERVICE_ID=..." \
  --set "CLICK_SECRET_KEY=..." \
  --set "PAYME_MERCHANT_ID=..." \
  --set "PAYME_MERCHANT_KEY=..."
```

---

## ✅ 4. Cloudflare — DDoS-защита + WAF + кеш

**Зачем:** Бесплатный слой защиты + ускорение в 2-3× через CDN.

**Шаги:**
1. Зарегистрироваться на https://dash.cloudflare.com и добавить домен `masteruz.com`
2. Перенести NS-записи в Cloudflare у регистратора домена
3. В Cloudflare DNS добавить:
   - `A masteruz.com → IP Railway` (✅ Proxy: orange cloud)
   - `A api.masteruz.com → IP Railway` (✅ Proxy)
4. **SSL/TLS → Full (strict)** — не Flexible! Иначе бесконечный redirect.
5. **SSL/TLS → Edge Certificates → Always Use HTTPS = ON, Min TLS = 1.2, HSTS = 12 мес.**
6. **Security → WAF → Managed Rules → All ON** (OWASP Core, Cloudflare Specials)
7. **Security → Bots → Bot Fight Mode = ON** (free)
8. **Rules → Page Rules → `*api.masteruz.com/*` → Cache Level: Bypass** (API нельзя кешировать)
9. **Rules → Page Rules → `masteruz.com/uploads/*` → Cache Level: Cache Everything, Edge TTL: 1 month**
10. После применения проверить: https://www.ssllabs.com/ssltest/analyze.html?d=masteruz.com — рейтинг **A+**

**Bonus (платный $20/мес):** Cloudflare Pro даёт WAF custom rules + image optimization.

---

## ✅ 5. Ежедневный pg_dump → внешнее хранилище

**Зачем:** Neon free-tier не имеет point-in-time recovery. Если БД упадёт — данные потеряны.

**Реализация:** [scripts/backup-pg.sh](scripts/backup-pg.sh) — готовый скрипт.

**Где хостить бэкапы:**
- **Backblaze B2** — $0.005/GB/мес, S3-совместимый ✅ рекомендую
- AWS S3 (Glacier) — дороже, но enterprise-надёжно
- Hetzner Storage Box — €4/мес за 1 TB

**Настройка S3-совместимого хранилища:**
```bash
railway variables --service masteruz-backend \
  --set "BACKUP_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com" \
  --set "BACKUP_S3_BUCKET=masteruz-backups" \
  --set "BACKUP_S3_ACCESS_KEY=..." \
  --set "BACKUP_S3_SECRET_KEY=..."
```

**Cron на VPS:**
```bash
# /etc/cron.d/masteruz-backup
0 3 * * * root /opt/masteruz/scripts/backup-pg.sh >> /var/log/masteruz-backup.log 2>&1
```

**Альтернатива на Railway (через separate cron service):** создать отдельный Railway-сервис `masteruz-backup` с image `postgres:16-alpine` + `awscli`, запускать `backup-pg.sh` через Railway Cron.

**Тест восстановления (раз в месяц):**
```bash
gunzip -c masteruz-20260601-030000.sql.gz | psql $TEST_DATABASE_URL
```

---

## ✅ 6. Magic-byte валидация загрузок

**Реализовано:** `verifyFileMagic` middleware в [backend/src/middleware/upload.ts](backend/src/middleware/upload.ts).

Проверяет первые байты файла (signature) и сверяет с заявленным MIME.
Защищает от подмены `.php → .jpg`, `.exe → .pdf` и т.п.

Применяется к роутам:
- `POST /api/users/certificates`
- `POST /api/photos/upload`
- `POST /api/forum/topics` + `POST /api/forum/topics/:id/posts`

---

## ✅ 7. RefreshToken в httpOnly cookie

**Реализовано:** `setAuthCookies` в [backend/src/modules/auth/auth.controller.ts](backend/src/modules/auth/auth.controller.ts).

При логине бэкенд устанавливает cookie `mu_rt` с флагами:
- `httpOnly` — не доступен из JS (защита от XSS)
- `Secure` — только по HTTPS
- `SameSite=Strict` — не отправляется на cross-site запросы (защита от CSRF)
- `Path=/api/auth/refresh` — отправляется только на endpoint обновления токена

**Условие:** на проде должен работать HTTPS. Cloudflare Full (strict) обеспечивает это.

---

## ✅ 8. SSE — Redis Pub/Sub для multi-node

**Реализовано:** [backend/src/services/eventBus.ts](backend/src/services/eventBus.ts) теперь публикует события в Redis-канал `masteruz:sse` и подписан на него.

**Эффект:** теперь можно безопасно поднимать N инстансов backend на Railway — live-tracking мастера не разломается, если клиент и мастер подключены к разным нодам.

**Fallback:** если Redis недоступен → in-memory режим (как было раньше). Запишется WARN в логи.

---

## ✅ 9. /.well-known/security.txt

**Реализовано:** [frontend/public/.well-known/security.txt](frontend/public/.well-known/security.txt).

Контакты для responsible disclosure уязвимостей. Файл будет автоматически отдаваться по `https://masteruz.com/.well-known/security.txt` после следующего деплоя фронтенда.

---

## ✅ 10. CORS guard в production

**Реализовано:** [backend/src/app.ts](backend/src/app.ts) — приложение упадёт при старте, если `CORS_ORIGIN=*` в production.

---

## ✅ 11. Frontend e2e тесты в CI

**Реализовано:** [.github/workflows/ci.yml](.github/workflows/ci.yml) с тремя джобами:
- `backend-test` — TS check + vitest unit
- `frontend-build` — TS check + production build
- `npm-audit` — security audit (warning-only, не падает на moderate)

E2E тесты ([frontend/e2e/full-cycle.spec.ts](frontend/e2e/full-cycle.spec.ts)) можно подключить позже отдельным workflow с docker-compose.

---

## ✅ 12. PRIVACY_POLICY и PUBLIC_OFFER

**Уже есть:**
- [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)
- [docs/PUBLIC_OFFER.md](docs/PUBLIC_OFFER.md)

⚠️ **Перед запуском обязательно:**
- Юридически выверить тексты с юристом РУз
- Указать **реальные** ИНН, юр.адрес, банковские реквизиты
- Опубликовать на `https://masteruz.com/privacy` и `https://masteruz.com/offer`

---

## 🎯 После всех 12 пунктов

Запустить финальные проверки:
```bash
# SSL Labs A+
curl -s "https://www.ssllabs.com/ssltest/analyze.html?d=masteruz.com" | grep -i "grade"

# Health check
curl https://api.masteruz.com/api/health

# security.txt
curl https://masteruz.com/.well-known/security.txt
```

После 100% зелени — **готов к публичному запуску** ✅
