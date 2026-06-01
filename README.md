# NetSupportAI

AI-powered Remote IT Support SaaS Platform for network engineers and ISPs.

---

## Always Do First

- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
- **Never auto-commit.** The user commits manually — never run `git commit` automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI + Uvicorn |
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| State | Zustand (auth, toasts, alert badges) |
| Charts | Recharts (ComposedChart, AreaChart, LineChart) |
| Terminal | xterm.js + WebSocket |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 (async) + Alembic |
| Cache / Queue | Redis 7 + Celery 5 |
| AI | Anthropic Claude (claude-sonnet-4) |
| Remote Access | Paramiko SSH + WebSocket proxy |
| Monitoring | icmplib (ICMP ping) + pysnmp (SNMP polling) |
| Notifications | SMTP + Twilio (WhatsApp) + Telegram Bot API |
| Auth | JWT (python-jose) + bcrypt, role-based access |
| Reverse Proxy | Nginx + Let's Encrypt (certbot) |
| Deployment | Docker Compose / systemd + Gunicorn |

---

## Project Structure

```
netsupportai/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py          # AsyncSession, expire_on_commit=False, autoflush=False
│   │   ├── models/
│   │   │   ├── device.py        # Device model — extra_data: Mapped[dict|None] (JSON)
│   │   │   ├── device_metric.py
│   │   │   ├── config_backup.py
│   │   │   └── ...
│   │   ├── routers/
│   │   │   ├── devices.py       # CRUD, ping, SNMP, SSH backup, metrics
│   │   │   ├── alerts.py
│   │   │   ├── tickets.py
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── ping_service.py
│   │   │   ├── snmp_service.py  # poll_device, walk_storage_table, get_interface_table
│   │   │   └── ssh_service.py
│   │   ├── schemas/
│   │   └── utils/
│   ├── alembic/
│   └── requirements.txt
│
└── frontend/
    ├── vite.config.js            # /api → localhost:8000, /ws → ws://localhost:8000
    ├── tailwind.config.js
    └── src/
        ├── App.jsx               # Route definitions — all auth routes under <Layout />
        ├── index.css             # Global styles, animations (expandDown, shimmer, etc.)
        ├── api/
        │   └── client.js         # Axios instance + API modules (devicesAPI, alertsAPI, …)
        ├── store/
        │   └── authStore.js      # useAuthStore, useNotifStore, useAlertStore (Zustand)
        ├── hooks/
        │   ├── useWebSocket.js   # Auto-reconnect WS → dispatches to stores
        │   └── useAuth.js        # signIn / signOut with navigation
        ├── components/
        │   ├── Layout.jsx        # Sidebar + Navbar + Outlet
        │   ├── Sidebar.jsx       # Role-filtered nav links
        │   ├── Navbar.jsx
        │   ├── Terminal.jsx      # xterm.js SSH terminal
        │   └── ...
        ├── utils/
        │   ├── timeFormat.js     # fmtTime, fmtDateTime — respects user 12/24h pref
        │   └── alertEngine.js    # checkPingAlerts, fireAlertToasts, calcJitter
        └── pages/
            ├── Dashboard.jsx
            ├── Tickets.jsx / TicketDetail.jsx / NewTicket.jsx
            ├── Devices.jsx               # NOC devices — ping modal, SNMP, alert rules
            ├── DeviceDetail.jsx          # Live metrics, SNMP sensors (PRTG charts), backups
            ├── CustomerDevices.jsx       # Link + customer devices
            ├── CustomerManagement.jsx    # Customer CRUD + service details + devices
            ├── AIDiagnostics.jsx
            ├── RemoteAccess.jsx
            ├── Alerts.jsx                # Custom-rule-triggered alerts
            ├── Settings.jsx              # Profile, Team, Date/Time (12/24h, NTP)
            ├── Services.jsx              # Service catalog tool
            ├── AlertRules.jsx            # Custom alert rule builder
            └── ...
```

---

## Features Built

### Core Platform
- **Ticket management** — CRUD, auto-numbering (NSA-00001), priority/SLA, AI diagnostics, comments
- **NOC device monitoring** — ICMP ping, SNMP polling (CPU/memory/uptime/interfaces), SSH config backup
- **Customer device management** — link devices (fiber/radio, A/B endpoints), customer devices
- **Remote SSH terminal** — browser-based via WebSocket (xterm.js + Paramiko)
- **AI Diagnostics** — Claude-powered root cause analysis with streaming chat
- **Real-time alerts** — WebSocket dashboard feed, Celery background workers
- **Notifications** — Email, WhatsApp (Twilio), Telegram Bot
- **Client portal** — separate login for clients to submit and track tickets
- **JWT auth** — access + refresh tokens, bcrypt, role-based (superadmin / admin / engineer / noc / client)

### Built More Recently
- **SNMP Sensor Monitor** (DeviceDetail) — bandwidth, ping latency, and SNMP Value sensors; PRTG-style ComposedChart with green-area total/amber-line in/blue-line out; period selector (Live → 1 Year); CSV export; localStorage persistence
- **Services tool** (`/services`) — service catalog; each service has a name and multiple Name/Value entries; stored in localStorage
- **Alert Rules tool** (`/alert-rules`) — custom alert rule builder; 4 network parameters (Ping Latency, Ping Timeout, Ping Response Stability, Jitter) each with condition, threshold, and one of 7 severity levels (Emergency → Informational)
- **Alert engine** (`src/utils/alertEngine.js`) — evaluates live ping results against device's assigned alert rules; fires toast notifications and persists triggered alerts to localStorage
- **Alerts page** — shows only custom-rule-triggered alerts in the format `Severity Level - Device Name: Alert Name  Date and Time`; Acknowledge / Resolve / Delete
- **Alert Rules on devices** — toggle + selectable list in Add/Edit Device form (NOC devices, customer devices, link devices); saved to `device.extra_data.alert_rule_ids`
- **Customer Management enhancements** — Service Details section (Service Type dropdown from Services tool, Service Name, Capacity/Bandwidth); Services column in table; customer name click → read-only view modal
- **Date/Time settings** (Settings page, superadmin + admin only) — 12/24h clock toggle, Manual date/time, NTP server picker (50+ servers across 7 regions); all timestamps in the app respect this preference via `src/utils/timeFormat.js`
- **Live metrics tile** — Uptime replaces Disk; shows `DDd:HH:MM:SS` from SNMP sysUpTime (TimeTicks)

---

## Coding Conventions

### General
- **No auto-commit** — user commits manually every time
- **No comments** unless the WHY is non-obvious
- **No unused imports** — remove them when refactoring
- **No `alert()` / `confirm()`** — use `toast` from react-hot-toast; use custom modals for destructive confirmations (except quick deletes which may use `window.confirm`)

### State
- Global state → Zustand stores only (no React Context)
- Per-component state → `useState` / `useReducer`
- Non-backend feature data → `localStorage` with `netsupportai-*` key prefix

### Time formatting
Always import from `src/utils/timeFormat.js` — never call `.toLocaleString()` directly in components:
```js
import { fmtTime, fmtDateTime } from '../utils/timeFormat'
```

### localStorage keys
```
netsupportai-auth                    Zustand auth state
netsupportai-sensors-{deviceId}      SNMP sensor data arrays
netsupportai-services                Service catalog
netsupportai-alert-rules             Alert rule definitions
netsupportai-custom-alerts           Triggered alert records
netsupportai-customer-service-details  {customerId → serviceDetails[]}
netsupportai-datetime                Clock format + NTP/manual settings
```

### Device extra_data
Device-level config that must survive API round-trips goes in `device.extra_data`:
- `snmp_oids` — SNMP OID picker selections
- `alerts_enabled` — boolean toggle
- `alert_rule_ids` — array of alert rule IDs
- `link_type`, `topology`, `endpoints_b`, etc. (link devices)

Always include `flag_modified(device, 'extra_data')` in the backend after assigning a new dict.

### Alert notification format
```
Emergency - CoreRouter: Down  01 Jun 2026, 14:30:22
```
- Severity Level: exact name from alert rule param (`Emergency`, `Warning`, …)
- Device Name: exact device name
- Alert Name: exact alert rule name
- Timestamp: `fmtDateTime(new Date())`

---

## Quick Start (Docker)

```bash
git clone <repo>
cd netsupportai
cp backend/.env.example backend/.env
# Edit backend/.env with API keys, SMTP, Twilio, Telegram credentials

docker-compose up -d
docker-compose exec backend alembic upgrade head

open http://localhost:5173
open http://localhost:8000/api/docs
```

## Production Deployment (Ubuntu 24.04)

```bash
sudo bash deploy/setup_server.sh
sudo cp backend/.env.example /opt/netsupportai/backend/.env
sudo nano /opt/netsupportai/backend/.env

cd frontend && npm ci && npm run build
sudo cp -r dist/* /var/www/netsupportai/

cd /opt/netsupportai/backend
/opt/netsupportai/venv/bin/pip install -r requirements.txt
/opt/netsupportai/venv/bin/alembic upgrade head

sudo systemctl start netsupportai netsupportai-worker
sudo certbot --nginx -d your-domain.com
```

## Architecture

```
Browser (React/Vite)
       │
       ▼
    Nginx (TLS)
       │
       ▼
FastAPI (Gunicorn + Uvicorn x4)
       │
  ┌────┴────────────────┐
  ▼                     ▼
PostgreSQL           Redis
(SQLAlchemy)    (Celery queue + cache)
                      │
               ┌──────┴──────┐
               ▼             ▼
          Celery Beat    Celery Worker
          (scheduler)   (async jobs)
                             │
                      Anthropic API (Claude)
                      Twilio / Telegram / SMTP
```

## API Docs

Available at `/api/docs` (Swagger UI) or `/api/redoc` when backend is running.

## License

Proprietary — All rights reserved.
