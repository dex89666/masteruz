#!/bin/bash
# ============================================
# MasterUz — Initial Deployment Script
# Запускать после server-setup.sh и настройки .env.production
# ============================================

set -e

cd /opt/masteruz

# Проверка .env.production
if [ ! -f .env.production ]; then
    echo "❌ Файл .env.production не найден!"
    echo "Скопируйте .env.production.example → .env.production и заполните"
    exit 1
fi

# Source environment
export $(grep -v '^#' .env.production | xargs)

echo "🚀 MasterUz Initial Deploy"
echo "Domain: $DOMAIN"
echo "=========================="

# 1. Create certbot directories
echo "📁 Creating SSL directories..."
mkdir -p certbot/conf certbot/www

# 2. Start with init-ssl config (HTTP only)
echo "🔧 Starting with temporary SSL config..."
# Use init config first
cp nginx/conf.d/masteruz-init-ssl.conf nginx/conf.d/active.conf
rm -f nginx/conf.d/masteruz.conf.active 2>/dev/null

# 3. Start services (without SSL first)
echo "🐳 Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis backend frontend nginx

# 4. Wait for services
echo "⏳ Waiting for services to start..."
sleep 15

# 5. Get SSL certificate
echo "🔒 Obtaining SSL certificate..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@${DOMAIN} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN} \
    -d www.${DOMAIN}

# 6. Switch to production SSL config
echo "🔧 Switching to production SSL config..."
rm nginx/conf.d/active.conf
# Update domain in nginx config
sed "s/masteruz.uz/${DOMAIN}/g" nginx/conf.d/masteruz.conf > nginx/conf.d/active.conf

# 7. Restart nginx with SSL
echo "🔄 Restarting Nginx with SSL..."
docker compose -f docker-compose.prod.yml restart nginx

# 8. Run database migrations
echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# 9. Seed database
echo "🌱 Seeding database..."
docker compose -f docker-compose.prod.yml exec -T backend npx tsx prisma/seed.ts

# 10. Health check
echo "🏥 Health check..."
sleep 5
if curl -sf https://${DOMAIN}/api/health > /dev/null 2>&1; then
    echo "✅ Platform is live at https://${DOMAIN}"
else
    echo "⚠️ Health check failed. Check logs:"
    echo "   docker compose -f docker-compose.prod.yml logs backend"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Ваша платформа: https://${DOMAIN}"
echo "API Health: https://${DOMAIN}/api/health"
echo ""
echo "Полезные команды:"
echo "  Логи:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Статус:  docker compose -f docker-compose.prod.yml ps"
echo "  Стоп:    docker compose -f docker-compose.prod.yml down"
echo "  Бэкап:   bash scripts/backup.sh"
