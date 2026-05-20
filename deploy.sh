#!/bin/bash
# NetSupportAI — fresh Ubuntu server deployment script
# Usage: bash deploy.sh
set -e

REPO_URL="https://github.com/floppyphillip/IT-Suppot-App.git"
APP_DIR="/opt/netsupportai"
DOMAIN="techmartinfo.com"

echo "==> [1/7] Installing system dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    curl git ca-certificates gnupg ufw

echo "==> [2/7] Installing Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

echo "==> [3/7] Configuring firewall..."
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> [4/7] Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "    Directory exists — pulling latest..."
    git -C "$APP_DIR" pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> [5/7] Setting up environment..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env"
    echo ""
    echo "  !! ACTION REQUIRED: Edit $APP_DIR/backend/.env with your values:"
    echo "     - SECRET_KEY       (run: openssl rand -hex 32)"
    echo "     - DATABASE_URL     (update password)"
    echo "     - ANTHROPIC_API_KEY"
    echo "     - SSH_ENCRYPTION_KEY (run: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
    echo "     - FRONTEND_URL / ALLOWED_ORIGINS (set to https://$DOMAIN)"
    echo "     - SMTP / Twilio / Telegram credentials"
    echo ""
    read -p "  Press Enter after editing .env to continue..."
fi

echo "==> [6/7] Building and starting services..."
# Build frontend dist (required by nginx to serve static files)
mkdir -p "$APP_DIR/frontend/dist"
docker build \
    --target builder \
    -t netsupportai-frontend-build \
    "$APP_DIR/frontend"
# Extract the built dist from the image into the host directory
CONTAINER_ID=$(docker create netsupportai-frontend-build)
docker cp "$CONTAINER_ID:/app/dist/." "$APP_DIR/frontend/dist/"
docker rm "$CONTAINER_ID"
echo "    Frontend built successfully."

# Start everything in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "==> [7/7] Setting up SSL with Certbot..."
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --email "admin@$DOMAIN" --redirect || \
    echo "  !! Certbot failed — run manually: certbot --nginx -d $DOMAIN"

echo ""
echo "==> Done! NetSupportAI is running at https://$DOMAIN"
echo "    Logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
