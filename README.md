# NetSupportAI

AI-powered Remote IT Support SaaS Platform built with FastAPI, React, PostgreSQL, Redis, and Claude AI.

## Features

- **AI Diagnostics** — Claude-powered ticket analysis, root cause identification, and recommended remediation steps with streaming chat interface
- **Ticket Management** — Full CRUD with auto-numbering (NSA-00001), priority/category, comments, and AI auto-classification
- **Device Monitoring** — ICMP ping + SNMP polling with automatic alerts on status changes, high latency, CPU/memory thresholds
- **Remote Access** — Browser-based SSH terminal via WebSocket (xterm.js + Paramiko)
- **Real-time Alerts** — WebSocket dashboard feed, Celery background workers, auto-notification via Email / WhatsApp (Twilio) / Telegram
- **Client Portal** — Separate login for clients to submit and track their own tickets
- **JWT Auth** — Access + refresh tokens, bcrypt password hashing, role-based access (admin / technician / client_user)
- **Audit Logging** — Full action audit trail

## Quick Start (Docker)

```bash
# 1. Clone and configure
git clone <repo>
cd netsupportai
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys, SMTP, Twilio, Telegram credentials

# 2. Start all services
docker-compose up -d

# 3. Run database migrations
docker-compose exec backend alembic upgrade head

# 4. Create first admin user (via API or psql)
# POST /api/auth/register requires an admin token — bootstrap via psql:
docker-compose exec db psql -U netsupport netsupportai -c \
  "INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES (gen_random_uuid(), 'admin@company.com', '\$2b\$12\$...', 'Admin', 'admin', true);"

# 5. Open app
open http://localhost:5173
open http://localhost:8000/api/docs  # Swagger UI
```

## Production Deployment (Ubuntu 24.04)

```bash
# Run setup script
sudo bash deploy/setup_server.sh

# Configure .env
sudo cp backend/.env.example /opt/netsupportai/backend/.env
sudo nano /opt/netsupportai/backend/.env

# Build frontend
cd frontend && npm ci && npm run build
sudo cp -r dist/* /var/www/netsupportai/

# Install Python deps and run migrations
cd /opt/netsupportai/backend
/opt/netsupportai/venv/bin/pip install -r requirements.txt
/opt/netsupportai/venv/bin/alembic upgrade head

# Start services
sudo systemctl start netsupportai
sudo systemctl start netsupportai-worker

# SSL
sudo certbot --nginx -d your-domain.com
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐
│   Browser   │───▶│    Nginx    │───▶│  FastAPI (Gunicorn│
│  React/Vite │    │ (TLS proxy) │    │  + Uvicorn x4)   │
└─────────────┘    └─────────────┘    └──────────────────┘
                                               │
                          ┌────────────────────┼───────────────┐
                          ▼                    ▼               ▼
                    ┌──────────┐        ┌──────────┐   ┌──────────────┐
                    │PostgreSQL│        │  Redis   │   │ Anthropic API│
                    │   (ORM)  │        │(Celery+  │   │  (Claude AI) │
                    └──────────┘        │ cache)   │   └──────────────┘
                                        └──────────┘
                                             │
                               ┌─────────────┴──────────┐
                               ▼                        ▼
                        ┌────────────┐          ┌────────────┐
                        │Celery Beat │          │Celery Worker│
                        │(scheduler) │          │(async jobs) │
                        └────────────┘          └────────────┘
```

## API Documentation

Available at `/api/docs` (Swagger UI) or `/api/redoc`.

## Environment Variables

See `backend/.env.example` for all required configuration.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI |
| Frontend | React 18 + Vite + Tailwind CSS |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 + Alembic |
| Cache/Queue | Redis 7 + Celery 5 |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Remote Access | Paramiko SSH + WebSocket |
| Monitoring | icmplib (ICMP) + pysnmp (SNMP) |
| Notifications | SMTP + Twilio (WhatsApp) + Telegram Bot API |
| Auth | JWT (python-jose) + bcrypt |
| Reverse Proxy | Nginx + Let's Encrypt |
| Deployment | Docker + systemd + Gunicorn |

## License

Proprietary — All rights reserved.
