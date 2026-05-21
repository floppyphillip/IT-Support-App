#!/bin/bash
# NetSupportAI — fresh Ubuntu server deployment script
# Usage: bash deploy.sh
set -e

REPO_URL="https://github.com/floppyphillip/IT-Support-App.git"
APP_DIR="/opt/netsupportai"
DOMAIN="techmartinfo.com"

# ─── Helpers ──────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

prompt() {
    local var_name="$1"
    local label="$2"
    local default="$3"
    local secret="$4"

    if [ "$secret" = "secret" ]; then
        read -rsp "  ${label}${default:+ [$default]}: " value </dev/tty
        echo
    else
        read -rp "  ${label}${default:+ [$default]}: " value </dev/tty
    fi
    eval "$var_name='${value:-$default}'"
}

section() {
    echo ""
    echo -e "${CYAN}${BOLD}  ── $1 ──${RESET}"
}

# ─── Configuration wizard ─────────────────────────────────────────────────────

clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║        NetSupportAI — Installation Wizard        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo "  This wizard will collect all required configuration"
echo "  values and deploy NetSupportAI on this server."
echo ""
echo -e "${YELLOW}  Press Enter to accept the default value shown in [brackets].${RESET}"

# Auto-generate secrets
GEN_SECRET_KEY=$(openssl rand -hex 32)
GEN_DB_PASSWORD=$(openssl rand -hex 16)
GEN_FERNET_KEY=$(python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())" 2>/dev/null || openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')

# ── Domain ────────────────────────────────────────────────────────────────────
section "Domain & Admin"
prompt DOMAIN       "Domain name"       "$DOMAIN"
prompt ADMIN_EMAIL  "Admin email"       "admin@$DOMAIN"

# ── Database ──────────────────────────────────────────────────────────────────
section "Database"
prompt DB_NAME      "Database name"     "netsupportai"
prompt DB_USER      "Database user"     "netsupport"
prompt DB_PASSWORD  "Database password (leave blank to auto-generate)" "$GEN_DB_PASSWORD"

# ── App secrets ───────────────────────────────────────────────────────────────
section "App Secrets (leave blank to auto-generate)"
prompt SECRET_KEY        "JWT secret key"       "$GEN_SECRET_KEY"
prompt SSH_ENCRYPT_KEY   "SSH encryption key (Fernet)" "$GEN_FERNET_KEY"

# ── Anthropic AI ──────────────────────────────────────────────────────────────
section "Anthropic AI"
prompt ANTHROPIC_KEY  "Anthropic API key" "sk-ant-..."

# ── SMTP ──────────────────────────────────────────────────────────────────────
section "SMTP / Email (optional — press Enter to skip)"
prompt SMTP_HOST    "SMTP host"         "smtp.gmail.com"
prompt SMTP_PORT    "SMTP port"         "587"
prompt SMTP_USER    "SMTP username"     ""
prompt SMTP_PASS    "SMTP password"     "" secret
prompt SMTP_FROM    "From address"      "noreply@$DOMAIN"

# ── Twilio ────────────────────────────────────────────────────────────────────
section "Twilio / WhatsApp (optional — press Enter to skip)"
prompt TWILIO_SID   "Twilio account SID"  ""
prompt TWILIO_TOKEN "Twilio auth token"   "" secret
prompt TWILIO_FROM  "Twilio WhatsApp from" "whatsapp:+14155238886"

# ── Telegram ──────────────────────────────────────────────────────────────────
section "Telegram Bot (optional — press Enter to skip)"
prompt TELEGRAM_TOKEN   "Telegram bot token"    ""
prompt TELEGRAM_CHAT_ID "Telegram default chat ID" ""

# ── SNMP ──────────────────────────────────────────────────────────────────────
section "SNMP Defaults"
prompt SNMP_COMMUNITY "Default SNMP community" "public"
prompt SNMP_PORT      "SNMP port"              "161"
prompt SNMP_TIMEOUT   "SNMP timeout (seconds)" "5"

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ─────────────────────────────────────────────────────${RESET}"
echo -e "${GREEN}  Configuration summary:${RESET}"
echo "    Domain:      $DOMAIN"
echo "    Admin email: $ADMIN_EMAIL"
echo "    Database:    $DB_NAME @ localhost (user: $DB_USER)"
echo "    Anthropic:   ${ANTHROPIC_KEY:0:12}..."
echo "    SMTP:        ${SMTP_USER:-not configured}"
echo "    Twilio:      ${TWILIO_SID:-not configured}"
echo "    Telegram:    ${TELEGRAM_TOKEN:+configured}${TELEGRAM_TOKEN:-not configured}"
echo ""
read -rp "  Proceed with installation? [Y/n]: " CONFIRM </dev/tty
if [[ "${CONFIRM,,}" == "n" ]]; then
    echo "  Aborted."
    exit 0
fi

# ─── Write .env ───────────────────────────────────────────────────────────────

write_env() {
    mkdir -p "$APP_DIR/backend"
    cat > "$APP_DIR/backend/.env" <<EOF
# ─── App ──────────────────────────────────────────────────────────────────────
APP_NAME=NetSupportAI
APP_VERSION=1.0.0
DEBUG=false
ENVIRONMENT=production
SECRET_KEY=$SECRET_KEY

# ─── Auth tokens ───────────────────────────────────────────────────────────────
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# ─── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://$DB_USER:$DB_PASSWORD@db:5432/$DB_NAME

# ─── Redis / Celery ────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# ─── Anthropic Claude ──────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_MAX_TOKENS=4096

# ─── AI auto-triage ────────────────────────────────────────────────────────────
AI_AUTO_RESOLVE_CONFIDENCE=0.85

# ─── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL=https://$DOMAIN
ALLOWED_ORIGINS=["https://$DOMAIN"]

# ─── SMTP / Email ──────────────────────────────────────────────────────────────
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
SMTP_TLS=true

# ─── Twilio (WhatsApp) ─────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=$TWILIO_SID
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN
TWILIO_WHATSAPP_FROM=$TWILIO_FROM

# ─── Telegram Bot ──────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN
TELEGRAM_DEFAULT_CHAT_ID=$TELEGRAM_CHAT_ID

# ─── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL=INFO
LOG_DIR=/var/log/netsupportai
LOG_RETENTION_DAYS=30

# ─── Monitoring ────────────────────────────────────────────────────────────────
MONITOR_INTERVAL_SECONDS=60
PING_TIMEOUT_SECONDS=5.0
SNMP_DEFAULT_COMMUNITY=$SNMP_COMMUNITY
SNMP_PORT=$SNMP_PORT
SNMP_TIMEOUT=$SNMP_TIMEOUT

# ─── SSH ───────────────────────────────────────────────────────────────────────
SSH_ENCRYPTION_KEY=$SSH_ENCRYPT_KEY
SSH_KEY_PATH=/home/netsupportai/.ssh/id_rsa
SSH_TIMEOUT=30

# ─── SLA hours ─────────────────────────────────────────────────────────────────
SLA_CRITICAL_HOURS=1
SLA_HIGH_HOURS=4
SLA_MEDIUM_HOURS=8
SLA_LOW_HOURS=24

# ─── Ticket Numbering ──────────────────────────────────────────────────────────
TICKET_PREFIX=NSA
EOF
    echo -e "${GREEN}  .env written to $APP_DIR/backend/.env${RESET}"
}

# Also write a docker-compose compatible db password env
write_db_env() {
    cat > "$APP_DIR/.env" <<EOF
DB_PASSWORD=$DB_PASSWORD
DB_USER=$DB_USER
DB_NAME=$DB_NAME
EOF
}

# ─── Installation steps ───────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}==> [1/7] Installing system dependencies...${RESET}"
apt-get update -qq
apt-get install -y --no-install-recommends \
    curl git ca-certificates gnupg ufw python3

echo -e "${BOLD}==> [2/7] Installing Docker...${RESET}"
if ! command -v docker &>/dev/null; then
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
    echo "    Docker installed."
else
    echo "    Docker already installed — skipping."
fi

echo -e "${BOLD}==> [3/7] Configuring firewall...${RESET}"
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 161/udp
ufw --force enable

echo -e "${BOLD}==> [4/7] Cloning repository...${RESET}"
if [ -d "$APP_DIR/.git" ]; then
    echo "    Repository exists — pulling latest..."
    git -C "$APP_DIR" pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo -e "${BOLD}==> [5/7] Writing configuration...${RESET}"
write_env
write_db_env

echo -e "${BOLD}==> [6/7] Building frontend and starting backend services...${RESET}"

# Patch domain into nginx config files
sed -i "s/your-domain\.com/$DOMAIN/g" "$APP_DIR/nginx/nginx.conf"
sed -i "s/your-domain\.com/$DOMAIN/g" "$APP_DIR/nginx/ssl.conf"
echo "    Nginx config patched for $DOMAIN."

# Build frontend dist
mkdir -p "$APP_DIR/frontend/dist"
docker build --target builder -t netsupportai-frontend-build "$APP_DIR/frontend"
CONTAINER_ID=$(docker create netsupportai-frontend-build)
docker cp "$CONTAINER_ID:/app/dist/." "$APP_DIR/frontend/dist/"
docker rm "$CONTAINER_ID"
echo "    Frontend built."

# Start backend services only (no nginx yet — needs SSL certs first)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    up -d --build db redis backend worker beat flower
echo "    Backend services started."

echo -e "${BOLD}==> [7/7] Setting up SSL and starting nginx...${RESET}"
apt-get install -y certbot

# Use standalone mode — certbot starts its own HTTP server on port 80
# nginx is not running yet so port 80 is free
certbot certonly --standalone \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$ADMIN_EMAIL" && \
    echo "    SSL certificate obtained." || {
        echo -e "${YELLOW}    !! Certbot failed. Check that $DOMAIN points to this server's IP.${RESET}"
        echo -e "${YELLOW}    !! To retry: certbot certonly --standalone -d $DOMAIN${RESET}"
        echo -e "${YELLOW}    !! Then restart nginx: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx${RESET}"
    }

# Now start nginx — certs exist so it will start cleanly
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
echo "    Nginx started."

# Set up automatic cert renewal
echo "0 3 * * * root certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.prod.yml restart nginx" \
    > /etc/cron.d/certbot-renew
echo "    Auto-renewal cron job configured."

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║          Installation Complete!                  ║"
echo "  ║                                                  ║"
echo "  ║   App:   https://$DOMAIN"
echo "  ║   Logs:  docker compose logs -f                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"
