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
| Maps | react-leaflet v4.2 + leaflet 1.9 (install with `--legacy-peer-deps`) |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 (async) + Alembic |
| Cache / Queue | Redis 7 + Celery 5 |
| AI | Anthropic Claude (claude-sonnet-4-6) |
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
│   │   ├── config.py
│   │   ├── database.py              # AsyncSession, expire_on_commit=False, autoflush=False
│   │   ├── models/
│   │   │   ├── device.py            # extra_data: Mapped[dict|None] = mapped_column(JSON)
│   │   │   ├── device_metric.py
│   │   │   ├── config_backup.py
│   │   │   ├── alert.py
│   │   │   ├── ticket.py
│   │   │   ├── user.py
│   │   │   ├── client.py
│   │   │   ├── customer.py
│   │   │   ├── audit_log.py
│   │   │   └── notification_settings.py
│   │   ├── routers/
│   │   │   ├── devices.py           # CRUD, ping, SNMP, SSH backup, metrics
│   │   │   ├── alerts.py            # alert CRUD + WebSocket device state events
│   │   │   ├── tickets.py
│   │   │   ├── auth.py
│   │   │   ├── ai_diagnostics.py
│   │   │   ├── customers.py
│   │   │   ├── clients.py
│   │   │   ├── dashboard.py         # /ws WebSocket for live stats + activity feed
│   │   │   ├── remote_access.py
│   │   │   └── notifications.py
│   │   ├── schemas/                 # Pydantic v2 request/response models
│   │   ├── services/
│   │   │   ├── ping_service.py      # ICMP ping via icmplib
│   │   │   ├── snmp_service.py      # poll_device, walk_storage_table, get_interface_table
│   │   │   ├── ssh_service.py       # Paramiko SSH + config backup
│   │   │   ├── ai_service.py        # Anthropic SDK (streaming)
│   │   │   ├── auth_service.py
│   │   │   ├── ticket_service.py
│   │   │   └── notification_service.py
│   │   ├── workers/
│   │   │   ├── celery_app.py        # Celery + Redis broker
│   │   │   ├── alert_task.py        # Per-alert Celery tasks
│   │   │   └── monitor_task.py      # Celery Beat — periodic device monitoring
│   │   └── utils/
│   │       ├── security.py          # JWT + bcrypt helpers
│   │       ├── limiter.py           # Rate limiting (slowapi)
│   │       ├── logger.py
│   │       └── network_parser.py
│   ├── alembic/                     # DB migrations
│   ├── seed.py                      # Dev seed data
│   └── requirements.txt
│
├── frontend/
│   ├── vite.config.js               # /api → localhost:8000, /ws → ws://localhost:8000
│   │                                # manualChunks: vendor, state, icons, dates, charts,
│   │                                #   terminal, leaflet (lazy-loaded via React.lazy)
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                  # All auth routes as children of <Layout />
│       ├── index.css                # Design tokens (CSS vars), utility classes, animations
│       ├── api/
│       │   └── client.js            # Axios instance + all typed API modules
│       ├── store/
│       │   └── authStore.js         # useAuthStore (Zustand, persisted)
│       ├── hooks/
│       │   ├── useWebSocket.js      # Generic auto-reconnect WebSocket hook
│       │   ├── useAuth.js           # isAuthenticated + login/logout helpers
│       │   └── useAlertMonitor.js   # Background ping monitor — edge-triggered alerts
│       ├── components/
│       │   ├── Layout.jsx           # Sidebar + Navbar + Outlet + useAlertMonitor
│       │   ├── Sidebar.jsx          # Role-filtered nav (Main / Tools / Account groups)
│       │   ├── Navbar.jsx
│       │   ├── Terminal.jsx         # xterm.js SSH terminal over WebSocket
│       │   ├── LinkPlanModal.jsx    # Full-screen RF link planner (Leaflet map + elevation chart)
│       │   ├── Skeleton.jsx         # SkeletonCard, SkeletonTable, SkeletonStats
│       │   ├── EmptyState.jsx
│       │   ├── StatsCard.jsx
│       │   └── StatusIndicator.jsx
│       ├── utils/
│       │   ├── timeFormat.js        # fmtTime, fmtDateTime — respects 12/24h preference
│       │   ├── alertEngine.js       # checkPingAlerts, checkSnmpAlerts, fireAlertToasts,
│       │   │                        # fireRecoveryAlert, clearCooldowns + localStorage helpers
│       │   └── snmpCatalog.js       # SNMP_VALUE_CATALOG — single source of truth for all OIDs
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx        # Live stats cards + activity feed (WebSocket)
│           ├── Tickets.jsx          # List with SLA badges and priority strips
│           ├── TicketDetail.jsx     # AI diagnosis, streaming chat, comments
│           ├── NewTicket.jsx
│           ├── Devices.jsx          # NOC devices: CRUD, EndpointPopup ping, SNMP, link devices
│           ├── DeviceDetail.jsx     # SNMP sensors (PRTG charts), config backups, state log
│           ├── CustomerDevices.jsx  # Customer devices: link + endpoint devices, ping
│           ├── CustomerManagement.jsx  # Customer CRUD + service details + inline columns
│           ├── AIDiagnostics.jsx
│           ├── RemoteAccess.jsx     # SSH terminal
│           ├── Alerts.jsx           # Custom-rule alerts (edge-triggered) + recovery alerts
│           ├── AlertRules.jsx       # Rule builder: ping params + SNMP OID params
│           ├── Services.jsx         # Service catalog (localStorage)
│           ├── LinkPlanning.jsx     # 5 GHz RF link plan list + stats (lazy-loads modal)
│           ├── Settings.jsx         # Profile, Team, Date/Time (12/24h + NTP/Manual)
│           ├── UserManagement.jsx
│           ├── Clients.jsx
│           └── ClientPortal.jsx
│
├── deploy/
│   ├── setup_server.sh
│   ├── backup.sh
│   └── netsupportai.service         # systemd unit
├── nginx/
│   ├── nginx.conf
│   └── ssl.conf
├── docker-compose.yml
├── docker-compose.prod.yml
└── deploy.sh
```

---

## Routes

| Route | Page | Notes |
|---|---|---|
| `/login` | Login | Public |
| `/client-portal` | ClientPortal | Client role |
| `/dashboard` | Dashboard | Staff |
| `/tickets` | Tickets | Staff |
| `/tickets/new` | NewTicket | Staff |
| `/tickets/:id` | TicketDetail | Staff |
| `/devices` | Devices | Staff |
| `/devices/:id` | DeviceDetail | Staff |
| `/customer-devices` | CustomerDevices | Staff |
| `/customer-devices/:id` | DeviceDetail | Staff |
| `/ai-diagnostics` | AIDiagnostics | Staff |
| `/remote-access` | RemoteAccess | Staff |
| `/alerts` | Alerts | Staff |
| `/alert-rules` | AlertRules | Staff |
| `/customer-management` | CustomerManagement | Staff |
| `/services` | Services | Staff |
| `/link-planning` | LinkPlanning | Staff |
| `/clients` | Clients | Staff |
| `/users` | UserManagement | Staff |
| `/settings` | Settings | All |

---

## Features Built

### Core Platform
- **Ticket management** — CRUD, auto-numbering (NSA-00001), priority/SLA countdown badges, AI auto-triage, streaming chat, comments
- **NOC device monitoring** — ICMP ping (EndpointPopup with live/counted modes), SNMP polling (CPU/memory/uptime/interfaces), SSH config backup with diff viewer
- **Customer device management** — link devices (fiber/radio, point-to-point/ring topologies, A/B endpoints), customer devices, endpoint ping
- **Remote SSH terminal** — browser-based via WebSocket (xterm.js + Paramiko), command palette
- **AI Diagnostics** — Claude-powered root cause analysis with streaming chat, CLI command suggestions, confidence bars
- **Dashboard** — live stats (open tickets, online devices, active alerts, SLA breach rate) via WebSocket; activity feed; weekly chart
- **Notifications** — Email, WhatsApp (Twilio), Telegram Bot; configurable per user
- **Client portal** — separate login for clients to submit and track tickets
- **JWT auth** — access + refresh tokens (httpOnly cookie), bcrypt, role-based (superadmin / admin / engineer / noc / client); force-password-change on first login
- **Audit log** — all write operations recorded with actor + diff
- **SNMP Sensor Monitor** (DeviceDetail) — bandwidth (PRTG-style ComposedChart: green area total, amber line in, blue line out), ping latency, and SNMP Value sensors; period selector (Live → 1 Year); CSV export; sensor data persisted to localStorage per device

### Alert System (custom rule engine)
- **Alert Rules** (`/alert-rules`) — rule builder with three parameter groups:
  - *Ping*: Latency (ms), Timeout (fires on any unreachable ping), Stability (packet loss %), Jitter (ms) — each with condition, threshold, and severity
  - *Interface Up/Down* (`iface_state`) — unified param monitors all interfaces; **separate severity levels** for Down and Up transitions; quick-create "Interface Monitor" template; `ifOperStatus_N` OIDs drive evaluation but are hidden from the rule form (`alertHidden: true` in catalog)
  - *Interface Speed / Duplex* (`iface_speed_duplex`) — toggle-chip selector: **10M Half**, **10M Full**, **100M Half**, **100M Full**, **1 Gbps**; reads `ifSpeed_N` (bits/sec) and `dot3StatsDuplexStatus_N` (2=half, 3=full) from SNMP sensor cache; single severity for all selected combos; quick-create "Speed / Duplex Monitor" template
  - *SNMP*: All OIDs from `SNMP_VALUE_CATALOG` grouped by category (CPU, Memory, Storage, Sessions, System, Interfaces) — OIDs with `alertHidden: true` are excluded from the rule form but remain available in DeviceDetail sensor picker
- **Background monitor** (`useAlertMonitor`) — runs in `Layout.jsx` continuously:
  - Sweeps every 2 minutes: fetches all alert-enabled devices, pings each, evaluates ping + SNMP + iface-state + iface-speed rules
  - **Edge-triggered**: `paramStates` Map tracks previous breach state per `deviceId::ruleName::paramKey`; alert fires only on `ok → breaching` transition
  - **Immediate start**: `nsa:device-saved` event triggers an immediate check the moment a device is saved with alerts enabled
  - **Recovery**: `ping_timeout` clearance → `fireRecoveryAlert`; `iface_state_N` clearance → `fireIfaceUpAlert` (uses `severity_up` from the rule)
- **Alerts page** — Active / All / Resolved tabs; Acknowledge / Resolve / Delete; auto-refreshes via `nsa:alert-saved` event
- **State reset**: resolving/deleting an alert dispatches `nsa:state-reset`, clearing breach states so the same condition can re-fire

### Other Tools
- **Services tool** (`/services`) — service catalog; each service has a name and Name/Value entries; referenced from Customer Management
- **Customer Management** — Service Details (type from Services catalog, name, capacity/bandwidth); Services and Customer Devices columns with inline table expansion; read-only customer view modal
  - **Delete guards**: a customer cannot be deleted while it has linked devices (shows count in toast); a customer device cannot be deleted while attached to a customer (delete modal shows which customer and blocks the button)
- **Date/Time settings** (Settings, superadmin + admin) — 12/24h clock toggle, Manual date/time, NTP server picker (50+ servers, 7 regions); all timestamps respect this via `timeFormat.js`
- **Link Planning** (`/link-planning`) — 5 GHz RF point-to-point link planning tool (localStorage). Full-screen modal with:
  - Live satellite map (Esri World Imagery via react-leaflet v4 + leaflet 1.9). **Free — no API key required.** Tile switcher: Satellite / Street / Topo. `minZoom={3}` prevents zooming out beyond the initial world view.
  - **Plan Name** field in the left panel (labeled input; same state as the inline-editable header title — both stay in sync).
  - Point A and Point B each have a **Site Name** field (e.g. "Main Tower", "Island Site"). Coordinate inputs accept **decimal degrees or DMS** — `parseDMSToDecimal()` auto-converts on blur. Site names appear as dark pill labels below the map markers; changing a name does not clear existing analysis results.
  - `makeMarkerIcon(letter, color, name)` — Leaflet divIcon with coloured circle + optional name label; updates reactively as the user types.
  - Plan cards on the listing page show site names when set (e.g. `A Main Tower → B Island Site`); fall back to coordinates when empty.
  - Map auto-pans 400 ms after coordinates are typed (`MapContainer ref={handleMapRef}` + debounced `useEffect`).
  - **Locate** button pans to entered coordinates; **Pick on Map** enters click-to-place mode when no coordinates are set.
  - Markers are draggable; drag updates the coordinate inputs in real time.
  - Frequency slider + text input (5000–6000 MHz); Channel width selector (5/10/20/40 MHz).
  - RF calculations: FSPL, RSL, link margin, 1st Fresnel zone radius, modulation estimate (256-QAM → BPSK → No Link), throughput, quality (excellent/good/marginal/poor).
  - Elevation profile: 60-point path from Open-Elevation API with sinusoidal fallback; `ComposedChart` with terrain, LOS line, Fresnel zone bounds, obstructed terrain overlay.
  - Leaflet chunk lazy-loaded via `React.lazy()` + `Suspense` (loads only on first modal open).
  - localStorage shape: `{ id, name, pointA: { name, lat, lng, height }, pointB: { name, lat, lng, height }, frequency, channelWidth, created_at, updated_at, results }[]`

---

## Coding Conventions

### General
- **No auto-commit** — user commits manually
- **No comments** unless the WHY is non-obvious (hidden constraint, subtle invariant, workaround)
- **No unused imports** — remove on refactor
- **No `alert()` / `confirm()`** — use `toast` (react-hot-toast) and custom modals
- **No `<form>` elements** — use button `onClick` handlers
- **Icons exclusively from `lucide-react`** — never `react-icons`

### Frontend Design System
The app uses a **light theme** defined via CSS custom properties in `src/index.css`. Always match these conventions:

**CSS variable tokens** — use via inline `style` prop:
```
var(--bg)          #ffffff      page background
var(--surface)     #ffffff      card background
var(--surface-2)   #f8fafc      nested bg (inputs, code blocks, mini-cards)
var(--hover)       #f1f5f9      hover state bg
var(--border)      rgba(0,0,0,0.09)    default border
var(--border-mid)  rgba(0,0,0,0.14)    hover border / input border
var(--border-strong) rgba(0,0,0,0.22)  active/selected border
var(--sidebar)     #f8fafc      sidebar background
var(--blue)        #3b82f6      primary accent
var(--blue-dim)    rgba(59,130,246,0.10)  active nav bg
var(--text-1)      #111827      headings, primary values
var(--text-2)      #374151      body text
var(--text-3)      #6b7280      secondary labels, descriptions
var(--text-4)      #9ca3af      placeholders, timestamps, metadata
```

**Utility classes** — use via `className`:
```
.card           white bg + border + rounded-xl
.btn-primary    blue bg, white text, 18px
.btn-secondary  surface-2 bg, border-mid, text-2, 18px
.btn-ghost      transparent, text-3, hover: surface bg
.btn-danger     red tint bg + border + text
.input          white bg, border-mid, text-1, 18px, focus ring
.label          uppercase, tracking-wider, text-4, 15px
.page-title     text-1, 24px, weight 600
.page-sub       text-4, 17px
.skeleton       shimmer animation (light gradient)
.th / .td / .tr table header / cell / row styles
```

**Font**: `'Inter Tight', system-ui, sans-serif` at **18px base**. Use `font-mono` for IPs, hostnames, metrics, timestamps, CLI output.

**Status colors** — use these hex values directly in `style` props (not Tailwind `text-*-400` which is too light on white):
```
Green  (online, success, resolved): #059669
Amber  (warning, degraded):         #d97706
Red    (critical, error, offline):  #dc2626
Blue   (primary, info):             #2563eb
Purple (AI / Claude):               #7c3aed
```

**Dos:**
- Use `style={{ color: 'var(--text-X)' }}` for semantic text colors
- Use `style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}` for nested panels
- Use `onMouseEnter/Leave` with inline style for hover states that require CSS variable values
- Add `transition-all duration-150` to every interactive element
- Use `font-mono` on every metric, IP, command, timestamp

**Don'ts:**
- Never use `bg-[#0b0f1a]`, `bg-[#111827]`, `bg-[#1a2236]` — use CSS variable equivalents
- Never use `text-slate-*` for themed text — use `var(--text-1..4)`
- Never use `border-white/[opacity]` — use `var(--border)`, `var(--border-mid)`, `var(--border-strong)`
- Never use a white or dark page background without the CSS variable system
- Never import from `react-icons` — use `lucide-react` exclusively

### State
- Global state → Zustand stores only (no React Context)
- Per-component state → `useState` / `useReducer`
- Non-backend persistent data → `localStorage` with `netsupportai-*` key prefix

### API calls
- Always use typed modules from `src/api/client.js` — never call `axios` directly in components
- All fetching in `useEffect` with `try/catch` — always provide mock fallback in `catch`
- Token refresh handled by Axios interceptor — never manually refresh in components

### Time formatting
Always use `src/utils/timeFormat.js` — never call `.toLocaleString()` directly:
```js
import { fmtTime, fmtDateTime } from '../utils/timeFormat'
```

### Alert notification formats
```
Standard breach:      Severity - Device Name: Alert Rule Name  DD Mon YYYY, HH:MM:SS
Recovery:             Device Name: Up  DD Mon YYYY, HH:MM:SS
Interface Up/Down:    Severity – Interface N: Down/Up  DD Mon YYYY, HH:MM:SS
Interface Speed:      Severity – Device Name: Interface N Speed Duplex  DD Mon YYYY, HH:MM:SS
```
Note: Interface Up/Down and Interface Speed formats use an **en dash** (–) not a hyphen (-). Interface Up/Down stores `iface_alert: true`; Interface Speed stores `iface_speed_alert: true` on the custom alert record.

### Custom event bus (same-tab communication)
| Event | Fired by | Consumed by |
|---|---|---|
| `nsa:alert-saved` | `alertEngine.saveCustomAlert` | `Alerts.jsx` (auto-refresh) |
| `nsa:state-reset` | `alertEngine.clearCooldowns` | `useAlertMonitor` (clears breach states) |
| `nsa:device-saved` | `Devices.jsx`, `CustomerDevices.jsx` save handlers | `useAlertMonitor` (immediate ping) |

### Device `extra_data`
Device-level config stored in `device.extra_data` (JSON column):
```
snmp_oids          SNMP OID picker selections
alerts_enabled     boolean — controls useAlertMonitor
alert_rule_ids     string[] — IDs from netsupportai-alert-rules
link_type          'fiber' | 'radio' | 'copper' | 'other'
topology           'point_to_point' | 'ring' | 'star' | 'mesh'
endpoints_b        string[] — IP list for B-side endpoints
names_b            string[] — display names for B endpoints
name_a             string — display name for A endpoint
bandwidth          string — circuit capacity label
```

Always include `flag_modified(device, 'extra_data')` in the backend router after writing a new dict.

### SNMP OID catalog
Any new OID goes in `src/utils/snmpCatalog.js` — it automatically appears in both the DeviceDetail sensor picker and the AlertRules form. Optional fields per entry:
```js
defaultCondition   // overrides '>' default (e.g. '=' for ifOperStatus)
defaultThreshold   // overrides 0/80 default (e.g. 2 for ifOperStatus)
description        // shown as a hint row in the AlertRules form
alertHidden: true  // keeps OID in DeviceDetail sensor picker but hides it from AlertRules SNMP params
                   // use for OIDs whose alert logic is handled by a special unified param
                   // (e.g. ifOperStatus_N → iface_state, ifSpeed_N → iface_speed_duplex)
```

### Alert engine exports (`src/utils/alertEngine.js`)
- `checkPingAlerts(device, pingData)` → `{ severity, ruleName, paramKey }[]`
- `checkSnmpAlerts(device, snmpData)` → `{ severity, ruleName, paramKey }[]`
- `checkIfaceAlerts(device, snmpData)` → `{ severity, ruleName, paramKey, ifaceNum, ifaceState:'Down' }[]` — fires only on DOWN (value=2); uses `p.severity_down`
- `checkIfaceSpeedAlerts(device, snmpData)` → `{ severity, ruleName, paramKey, ifaceNum, speedLabel, duplexLabel, ifaceSpeedAlert:true }[]` — reads `ifSpeed_N` + `dot3StatsDuplexStatus_N`
- `checkJitterAlerts(device, jitterMs)` → `{ severity, ruleName, paramKey }[]`
- `fireAlertToasts(triggered, deviceId, deviceName, toast, useCooldown)` — writes to localStorage + shows toast; handles standard, iface Up/Down, and iface speed formats
- `fireRecoveryAlert(deviceName, toast)` — saves `severity_level:'recovery'` record + success toast
- `fireIfaceUpAlert(device, ifaceNum, toast)` — looks up `severity_up` from device rules, fires Up alert
- `clearCooldowns()` — clears cooldown Map + dispatches `nsa:state-reset`

### SNMP display values
Always use `fmtOidValue(rawVal, unit)` from `DeviceDetail.jsx` to render sensor values.
Unit handling: `%` → float%, `s` → TimeTicks to `DDd:HH:MM:SS`, `B` → auto KB/MB/GB/TB, `KB` → auto MB/GB, `bit`/`bits` → auto Kbit/Mbit/Gbit.

---

## localStorage Keys

| Key | Shape | Used by |
|---|---|---|
| `netsupportai-auth` | Zustand persist (`{ state: { user, accessToken } }`) | All pages |
| `netsupportai-sensors-{deviceId}` | `Sensor[]` (bandwidth / latency / snmp) | DeviceDetail |
| `netsupportai-services` | `{ id, name, entries[], created_at }[]` | Services, CustomerManagement |
| `netsupportai-alert-rules` | `{ id, name, description, parameters[], created_at, updated_at }[]` | AlertRules, useAlertMonitor |
| `netsupportai-custom-alerts` | `{ id, severity_level, device_name, alert_name, iface_alert?, iface_speed_alert?, created_at, is_resolved, is_acknowledged }[]` | alertEngine, Alerts |
| `netsupportai-customer-service-details` | `{ [customerId]: ServiceDetail[] }` | CustomerManagement |
| `netsupportai-datetime` | `{ mode, ntpServer, clockFormat, manualDate, manualTime }` | Settings, timeFormat |
| `netsupportai-link-plans` | `{ id, name, pointA, pointB, frequency, channelWidth, created_at, updated_at, results }[]` | LinkPlanning, LinkPlanModal |

---

## Architecture

```
Browser (React + Vite)
       │
       ▼
    Nginx (TLS termination)
       │
       ▼
FastAPI (Gunicorn + Uvicorn × 4 workers)
       │
  ┌────┴────────────────┐
  ▼                     ▼
PostgreSQL 16        Redis 7
(SQLAlchemy async)   (Celery broker + result cache)
                          │
                   ┌──────┴──────────┐
                   ▼                 ▼
             Celery Beat        Celery Worker
             (scheduler)        (async tasks)
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                   Anthropic Claude    Twilio / Telegram / SMTP
```

---

## Quick Start (Docker)

```bash
git clone <repo>
cd netsupportai
cp backend/.env.example backend/.env
# Fill in ANTHROPIC_API_KEY, SMTP, Twilio, Telegram, SECRET_KEY, DATABASE_URL

docker-compose up -d
docker-compose exec backend alembic upgrade head

# App at http://localhost:5173
# API docs at http://localhost:8000/api/docs
```

## Production Deployment (Ubuntu 24.04)

```bash
sudo bash deploy/setup_server.sh
sudo nano /opt/netsupportai/backend/.env

cd frontend && npm ci && npm run build
sudo cp -r dist/* /var/www/netsupportai/

cd /opt/netsupportai/backend
/opt/netsupportai/venv/bin/pip install -r requirements.txt
/opt/netsupportai/venv/bin/alembic upgrade head

sudo systemctl start netsupportai netsupportai-worker
sudo certbot --nginx -d your-domain.com
```

## Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → /dist
npm run lint         # ESLint

# Installing react-leaflet (requires legacy peer deps — React 18 project)
npm install react-leaflet@4 leaflet --legacy-peer-deps
```

## API Docs

Available at `/api/docs` (Swagger UI) or `/api/redoc` when the backend is running.

## License

Proprietary — All rights reserved.
