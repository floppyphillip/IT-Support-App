#!/usr/bin/env bash
# NetSupportAI — Ubuntu 24.04 production server setup
# Usage: sudo bash setup_server.sh
set -euo pipefail

APP_USER="netsupportai"
APP_DIR="/opt/netsupportai"
LOG_DIR="/var/log/netsupportai"
DOMAIN="${DOMAIN:-your-domain.com}"
DB_NAME="netsupportai"
DB_USER="netsupport"
DB_PASS="${DB_PASSWORD:-$(openssl rand -hex 16)}"

echo "=== NetSupportAI Server Setup ==="

# ─── System updates ───────────────────────────────────────────────────────────
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git unzip ufw fail2ban \
  build-essential libssl-dev libffi-dev \
  python3.11 python3.11-venv python3-pip \
  postgresql-16 postgresql-client-16 \
  redis-server \
  nginx certbot python3-certbot-nginx \
  iputils-ping net-tools snmp \
  htop iotop

# ─── Firewall ─────────────────────────────────────────────────────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "Firewall configured."

# ─── Fail2ban ─────────────────────────────────────────────────────────────────
systemctl enable --now fail2ban

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo "PostgreSQL setup complete. Password: $DB_PASS"

# ─── Redis ────────────────────────────────────────────────────────────────────
sed -i 's/^bind 127.0.0.1 -::1/bind 127.0.0.1/' /etc/redis/redis.conf
systemctl enable --now redis-server

# ─── App user ─────────────────────────────────────────────────────────────────
id -u $APP_USER &>/dev/null || useradd --system --create-home --shell /bin/bash $APP_USER
mkdir -p $LOG_DIR
chown $APP_USER:$APP_USER $LOG_DIR
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR

# Generate SSH key for remote access
sudo -u $APP_USER ssh-keygen -t rsa -b 4096 -f /home/$APP_USER/.ssh/id_rsa -N "" 2>/dev/null || true

# ─── Node.js (for frontend build) ────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ─── Docker (optional, for containerised deployment) ─────────────────────────
curl -fsSL https://get.docker.com | sh
usermod -aG docker $APP_USER
systemctl enable --now docker

# ─── Python venv ──────────────────────────────────────────────────────────────
sudo -u $APP_USER python3.11 -m venv $APP_DIR/venv
sudo -u $APP_USER $APP_DIR/venv/bin/pip install --upgrade pip

# ─── Nginx ────────────────────────────────────────────────────────────────────
cp /opt/netsupportai/nginx/nginx.conf /etc/nginx/nginx.conf
nginx -t && systemctl enable --now nginx

# ─── SSL (Let's Encrypt) ──────────────────────────────────────────────────────
echo "To get SSL certificate, run:"
echo "  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN"

# ─── Systemd services ─────────────────────────────────────────────────────────
cp /opt/netsupportai/deploy/netsupportai.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable netsupportai

echo ""
echo "=== Setup complete! ==="
echo "DB password: $DB_PASS"
echo "Next steps:"
echo "  1. Copy application code to $APP_DIR"
echo "  2. Create $APP_DIR/backend/.env from .env.example"
echo "  3. Run: sudo systemctl start netsupportai"
echo "  4. Run alembic migrations: cd $APP_DIR/backend && alembic upgrade head"
