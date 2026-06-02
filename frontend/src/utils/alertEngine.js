/**
 * Alert engine — evaluates device ping/jitter results against custom alert rules.
 * Triggered alerts are:
 *   1. Shown as toast notifications
 *   2. Persisted to localStorage so they appear on the Alerts page
 *
 * Notification format: "Severity Level - Device Name: Rule Name  DD Mon YYYY, HH:MM:SS"
 */
import { fmtDateTime } from './timeFormat'

const RULES_KEY        = 'netsupportai-alert-rules'
const CUSTOM_ALERTS_KEY = 'netsupportai-custom-alerts'
const COOLDOWN_MS       = 5 * 60 * 1000   // 5 min between repeat notifications per rule

// Module-level cooldown map — persists across component mounts within a session
const cooldowns = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadRules() {
  try { return JSON.parse(localStorage.getItem(RULES_KEY) || '[]') }
  catch { return [] }
}

function compare(condition, value, threshold) {
  if (value == null) return false
  switch (condition) {
    case '>':  return value >  threshold
    case '>=': return value >= threshold
    case '<':  return value <  threshold
    case '<=': return value <= threshold
    case '=':  return value === threshold
    default:   return false
  }
}

function getDeviceRules(device) {
  if (!device?.extra_data?.alerts_enabled) return []
  const ids = device.extra_data?.alert_rule_ids ?? []
  if (!ids.length) return []
  return loadRules().filter(r => ids.includes(r.id))
}

// Map custom severity names → backend bucket (used for color coding in Alerts page)
const SEV_TO_BACKEND = {
  Emergency: 'critical', Alert: 'critical', Critical: 'critical',
  Error: 'warning', Warning: 'warning',
  Notification: 'info', Informational: 'info',
}

const HIGH_SEV = new Set(['Emergency', 'Alert', 'Critical', 'Error', 'Warning'])

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Evaluate a ping API response against the device's assigned alert rules.
 * Returns array of { severity, ruleName, paramKey }
 */
export function checkPingAlerts(device, pingData) {
  const rules = getDeviceRules(device)
  const triggered = []

  for (const rule of rules) {
    for (const p of rule.parameters ?? []) {
      if (!p.enabled) continue
      let breach = false

      switch (p.key) {
        case 'ping_latency':
          if (pingData.reachable && pingData.latency_ms != null)
            breach = compare(p.condition, pingData.latency_ms, p.threshold)
          break
        case 'ping_timeout':
          breach = compare(p.condition, pingData.reachable ? 0 : 1, p.threshold)
          break
        case 'ping_stability': {
          const loss = pingData.packet_loss_pct ?? (pingData.reachable ? 0 : 100)
          breach = compare(p.condition, loss, p.threshold)
          break
        }
      }

      if (breach) triggered.push({ severity: p.severity, ruleName: rule.name, paramKey: p.key })
    }
  }

  return triggered
}

/**
 * Evaluate a calculated jitter value (ms) against the device's alert rules.
 */
export function checkJitterAlerts(device, jitterMs) {
  const rules = getDeviceRules(device)
  const triggered = []

  for (const rule of rules) {
    for (const p of rule.parameters ?? []) {
      if (!p.enabled || p.key !== 'jitter') continue
      if (compare(p.condition, jitterMs, p.threshold))
        triggered.push({ severity: p.severity, ruleName: rule.name, paramKey: 'jitter' })
    }
  }

  return triggered
}

// ─── Custom alert persistence ─────────────────────────────────────────────────

function loadCustomAlerts() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_ALERTS_KEY) || '[]') }
  catch { return [] }
}

function persistCustomAlerts(alerts) {
  localStorage.setItem(CUSTOM_ALERTS_KEY, JSON.stringify(alerts))
}

function saveCustomAlert(entry) {
  const existing = loadCustomAlerts()
  existing.unshift(entry)
  persistCustomAlerts(existing.slice(0, 200))  // keep last 200
}

/** Load all custom rule–triggered alerts (for the Alerts page) */
export function getCustomAlerts() {
  return loadCustomAlerts()
}

export function acknowledgeCustomAlert(id) {
  persistCustomAlerts(loadCustomAlerts().map(a => a.id === id ? { ...a, is_acknowledged: true } : a))
}

export function resolveCustomAlert(id) {
  persistCustomAlerts(loadCustomAlerts().map(a => a.id === id ? { ...a, is_resolved: true } : a))
}

export function deleteCustomAlert(id) {
  persistCustomAlerts(loadCustomAlerts().filter(a => a.id !== id))
}

/** Clear all in-memory cooldowns so conditions can re-fire immediately. */
export function clearCooldowns() {
  cooldowns.clear()
}

// ─── Toast + persist ─────────────────────────────────────────────────────────

/**
 * Fire toast notifications and persist alert records for triggered rules.
 *
 * @param {Array}   triggered   - output of checkPingAlerts / checkJitterAlerts
 * @param {string}  deviceId
 * @param {string}  deviceName
 * @param {object}  toastFn     - react-hot-toast instance
 * @param {boolean} useCooldown - true for polling loops to avoid spam
 */
export function fireAlertToasts(triggered, deviceId, deviceName, toastFn, useCooldown = false) {
  const now = Date.now()

  for (const { severity, ruleName, paramKey } of triggered) {
    if (useCooldown) {
      const key = `${deviceId}::${ruleName}::${paramKey}`
      if (now - (cooldowns.get(key) ?? 0) < COOLDOWN_MS) continue
      cooldowns.set(key, now)
    }

    const timestamp = fmtDateTime(new Date())
    const title     = `${severity} - ${deviceName}: ${ruleName}`
    const fullMsg   = `${title}  ${timestamp}`

    // Toast notification
    if (HIGH_SEV.has(severity)) toastFn.error(fullMsg, { duration: 6000 })
    else toastFn(fullMsg, { icon: '🔔', duration: 5000 })

    // Persist to Alerts page store — store each field explicitly so the
    // Alerts page can build the heading without any string parsing
    saveCustomAlert({
      id:              `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity_level:  severity,          // exact severity from alert rule ("Emergency", "Warning", …)
      device_name:     deviceName,        // exact device name
      alert_name:      ruleName,          // exact alert rule name ("Down", "High Latency", …)
      created_at:      new Date().toISOString(),
      is_resolved:     false,
      is_acknowledged: false,
    })
  }
}

/**
 * Calculate jitter (std deviation of latencies) from an array of ms values.
 */
export function calcJitter(latencyArray) {
  if (!latencyArray || latencyArray.length < 2) return null
  const avg      = latencyArray.reduce((a, b) => a + b, 0) / latencyArray.length
  const variance = latencyArray.reduce((s, l) => s + (l - avg) ** 2, 0) / latencyArray.length
  return Math.sqrt(variance)
}
