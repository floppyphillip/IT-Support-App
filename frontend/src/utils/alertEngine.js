/**
 * Alert engine — evaluates device ping/jitter results against custom alert rules
 * and fires toast notifications in the format:
 *   "Severity Level - Device Name: Rule Name  DD Mon YYYY, HH:MM:SS"
 */
import { fmtDateTime } from './timeFormat'

const RULES_KEY  = 'netsupportai-alert-rules'
const COOLDOWN_MS = 5 * 60 * 1000   // 5 minutes between repeat notifications per rule

// Module-level cooldown map persists across component mounts
const cooldowns = new Map()

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

/**
 * Evaluate a ping API response against the device's assigned alert rules.
 * @param {object} device  - full device object (needs extra_data.alerts_enabled, alert_rule_ids)
 * @param {object} pingData - { reachable, latency_ms, packet_loss_pct }
 * @returns {Array} triggered - [{ severity, ruleName, paramKey }]
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
          // threshold is consecutive timeout count; 1 = one timeout occurred
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
 * @param {object} device
 * @param {number} jitterMs  - std deviation of recent latencies in ms
 * @returns {Array} triggered
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

const HIGH_SEV = new Set(['Emergency', 'Alert', 'Critical', 'Error', 'Warning'])

/**
 * Fire toast notifications for triggered alerts.
 * Format: "Severity Level - Device Name: Rule Name  DD Mon YYYY, HH:MM:SS"
 *
 * @param {Array}   triggered    - output of checkPingAlerts / checkJitterAlerts
 * @param {string}  deviceId     - used as part of cooldown key
 * @param {string}  deviceName   - shown in notification
 * @param {object}  toastFn      - react-hot-toast instance
 * @param {boolean} useCooldown  - set true for polling loops to avoid spam
 */
export function fireAlertToasts(triggered, deviceId, deviceName, toastFn, useCooldown = false) {
  const now = Date.now()
  for (const { severity, ruleName, paramKey } of triggered) {
    if (useCooldown) {
      const key = `${deviceId}::${ruleName}::${paramKey}`
      if (now - (cooldowns.get(key) ?? 0) < COOLDOWN_MS) continue
      cooldowns.set(key, now)
    }
    const msg = `${severity} - ${deviceName}: ${ruleName}  ${fmtDateTime(new Date())}`
    if (HIGH_SEV.has(severity)) toastFn.error(msg, { duration: 6000 })
    else toastFn(msg, { icon: '🔔', duration: 5000 })
  }
}

/**
 * Convenience: calculate jitter (std dev of latencies) from an array of ms values.
 */
export function calcJitter(latencyArray) {
  if (latencyArray.length < 2) return null
  const avg = latencyArray.reduce((a, b) => a + b, 0) / latencyArray.length
  const variance = latencyArray.reduce((s, l) => s + (l - avg) ** 2, 0) / latencyArray.length
  return Math.sqrt(variance)
}
