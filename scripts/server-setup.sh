#!/bin/bash
# ============================================
# MasterUz — Server Setup Script
# Запускать на VPS один раз при первой настройке
# ============================================

set -e

echo "🚀 MasterUz Server Setup"
echo "========================"

# 1. Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# 2. Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 3. Install Docker Compose v2
echo "🔧 Installing Docker Compose..."
apt install -y docker-compose-plugin

# 4. Install required tools
echo "📦 Installing tools..."
apt install -y git curl ufw fail2ban

# 5. Configure firewall
echo "🔒 Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# 6. Create app directory
echo "📁 Creating app directory..."
mkdir -p /opt/masteruz
cd /opt/masteruz

# 7. Clone repository
echo "📥 Cloning repository..."
read -p "Enter your GitHub repo URL (e.g. https://github.com/user/masteruz.git): " REPO_URL
git clone "$REPO_URL" .

# 8. Create .env.production
echo "⚙️ Setting up environment..."
if [ ! -f .env.production ]; then
    cp .env.production.example .env.production
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    REDIS_PASSWORD=$(openssl rand -hex 16)
    
    sed -i "s|СГЕНЕРИРУЙ_СЕКРЕТ_64_СИМВОЛА|$JWT_SECRET|" .env.production
    sed -i "s|СГЕНЕРИРУЙ_ДРУГОЙ_СЕКРЕТ_64_СИМВОЛА|$JWT_REFRESH_SECRET|" .env.production
    sed -i "s|СГЕНЕРИРУЙ_СЛОЖНЫЙ_ПАРОЛЬ_32_СИМВОЛА|$DB_PASSWORD|" .env.production
    sed -i "s|СГЕНЕРИРУЙ_СЛОЖНЫЙ_ПАРОЛЬ_24_СИМВОЛА|$REDIS_PASSWORD|" .env.production
    
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте .env.production и заполните:"
    echo "   - DOMAIN (ваш домен)"
    echo "   - TELEGRAM_BOT_TOKEN (токен от @BotFather)"
    echo "   - TELEGRAM_BOT_USERNAME (имя бота)"
    echo "   - YANDEX_MAPS_API_KEY (ключ Yandex Maps)"
    echo "   - Платёжные системы (Click, Payme)"
    echo ""
    echo "Используйте: nano /opt/masteruz/.env.production"
    echo ""
fi

echo "✅ Server setup complete!"
echo ""
echo "Следующие шаги:"
echo "1. Отредактируйте /opt/masteruz/.env.production"
echo "2. Запустите: cd /opt/masteruz && bash scripts/deploy-init.sh"
