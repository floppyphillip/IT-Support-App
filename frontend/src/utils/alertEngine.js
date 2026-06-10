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
  const v = Number(value)
  const t = Number(threshold)
  switch (condition) {
    case '>':  return v >  t
    case '>=': return v >= t
    case '<':  return v <  t
    case '<=': return v <= t
    case '=':  return v === t
    default:   return false
  }
}

function getDeviceRules(device) {
  if (!device?.extra_data?.alerts_enabled) {
    console.debug('[AlertEngine] alerts_enabled not set on device', device?.name ?? device?.id)
    return []
  }
  const ids = device.extra_data?.alert_rule_ids ?? []
  if (!ids.length) {
    console.debug('[AlertEngine] no alert_rule_ids on device', device?.name ?? device?.id)
    return []
  }
  const allRules = loadRules()
  const matched  = allRules.filter(r => ids.includes(r.id))
  console.debug('[AlertEngine] device rules matched', device?.name, '→', matched.map(r => r.name))
  return matched
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
          // Single pings return binary reachable/unreachable — fire whenever unreachable
          breach = !pingData.reachable
          break
        case 'ping_stability': {
          const loss = pingData.packet_loss_pct ?? (pingData.reachable ? 0 : 100)
          breach = compare(p.condition, loss, p.threshold)
          break
        }
      }

      console.debug('[AlertEngine]', rule.name, p.key, '→ breach:', breach, { pingData, threshold: p.threshold, condition: p.condition })
      if (breach) triggered.push({ severity: p.severity, ruleName: rule.name, paramKey: p.key })
    }
  }

  return triggered
}

/**
 * Evaluate the latest SNMP sensor values against the device's alert rules.
 * snmpData: { oidKey → latestNumericValue }
 * Returns array of { severity, ruleName, paramKey }
 */
export function checkSnmpAlerts(device, snmpData) {
  const rules = getDeviceRules(device)
  const triggered = []
  for (const rule of rules) {
    for (const p of rule.parameters ?? []) {
      if (!p.enabled || !p.key?.startsWith('snmp_')) continue
      const value = snmpData[p.oidKey]
      if (value == null) continue
      if (compare(p.condition, value, p.threshold)) {
        console.debug(`[AlertEngine] ${rule.name} ${p.key} → breach: true`, { value, threshold: p.threshold, condition: p.condition })
        triggered.push({ severity: p.severity, ruleName: rule.name, paramKey: p.key })
      }
    }
  }
  return triggered
}

/**
 * Evaluate interface DOWN state across all polled ifOperStatus_N OIDs.
 * Only fires when an interface transitions to down (value === 2).
 * Up transitions are handled separately by fireIfaceUpAlert (called on recovery).
 * Returns array of { severity, ruleName, paramKey, ifaceNum, ifaceState }
 */
export function checkIfaceAlerts(device, snmpData) {
  const rules = getDeviceRules(device)
  const triggered = []
  for (const rule of rules) {
    for (const p of rule.parameters ?? []) {
      if (!p.enabled || p.key !== 'iface_state') continue
      for (const [oidKey, value] of Object.entries(snmpData)) {
        const m = oidKey.match(/^ifOperStatus_(\d+)$/)
        if (!m || value == null) continue
        if (Number(value) === 2) {
          const ifaceNum = m[1]
          const severity = p.severity_down ?? p.severity ?? 'Critical'
          console.debug(`[AlertEngine] ${rule.name} Interface ${ifaceNum} → Down (severity: ${severity})`)
          triggered.push({
            severity,
            ruleName:   rule.name,
            paramKey:   `iface_state_${ifaceNum}`,
            ifaceNum,
            ifaceState: 'Down',
          })
        }
      }
    }
  }
  return triggered
}

/**
 * Fire an "interface Up" alert for a single interface using the severity_up
 * from the device's assigned rule(s). Called by useAlertMonitor on recovery.
 */
export function fireIfaceUpAlert(device, ifaceNum, toastFn) {
  const rules    = getDeviceRules(device)
  let severityUp = 'Notification'
  for (const rule of rules) {
    const p = rule.parameters?.find(x => x.enabled && x.key === 'iface_state')
    if (p) { severityUp = p.severity_up ?? 'Notification'; break }
  }
  const alertName = `Interface ${ifaceNum}: Up`
  const timestamp = fmtDateTime(new Date())
  const fullMsg   = `${severityUp} – ${alertName}  ${timestamp}`
  if (HIGH_SEV.has(severityUp)) toastFn.error(fullMsg, { duration: 6000 })
  else toastFn(fullMsg, { icon: '🔔', duration: 5000 })
  saveCustomAlert({
    id:              `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    severity_level:  severityUp,
    device_name:     device.name ?? device.hostname ?? '',
    alert_name:      alertName,
    iface_alert:     true,
    created_at:      new Date().toISOString(),
    is_resolved:     false,
    is_acknowledged: false,
  })
}

/**
 * Evaluate interface speed and duplex against the device's alert rules.
 * Reads ifSpeed_N (bits/sec) and dot3StatsDuplexStatus_N (2=half, 3=full) from snmpData.
 * Returns array of { severity, ruleName, paramKey, ifaceNum, speedLabel, duplexLabel, ifaceSpeedAlert }
 */
export function checkIfaceSpeedAlerts(device, snmpData) {
  const rules = getDeviceRules(device)
  const triggered = []

  for (const rule of rules) {
    for (const p of rule.parameters ?? []) {
      if (!p.enabled || p.key !== 'iface_speed_duplex') continue

      for (const [oidKey, rawSpeed] of Object.entries(snmpData)) {
        const m = oidKey.match(/^ifSpeed_(\d+)$/)
        if (!m || rawSpeed == null) continue

        const ifaceNum   = m[1]
        const bps        = Number(rawSpeed)
        const rawDuplex  = snmpData[`dot3StatsDuplexStatus_${ifaceNum}`]
        const duplexCode = rawDuplex != null ? Number(rawDuplex) : null

        // Build list of matching combo keys for this speed+duplex reading
        const matches = []

        if (bps === 10_000_000) {
          if      (duplexCode === 2 && p.speed_10_half) matches.push({ comboKey: 'speed_10_half', speed: '10Mbps',  duplex: 'Half Duplex' })
          else if (duplexCode === 3 && p.speed_10_full) matches.push({ comboKey: 'speed_10_full', speed: '10Mbps',  duplex: 'Full Duplex' })
          else if (duplexCode === null) {
            if (p.speed_10_half) matches.push({ comboKey: 'speed_10_half', speed: '10Mbps', duplex: '' })
            if (p.speed_10_full) matches.push({ comboKey: 'speed_10_full', speed: '10Mbps', duplex: '' })
          }
        } else if (bps === 100_000_000) {
          if      (duplexCode === 2 && p.speed_100_half) matches.push({ comboKey: 'speed_100_half', speed: '100Mbps', duplex: 'Half Duplex' })
          else if (duplexCode === 3 && p.speed_100_full) matches.push({ comboKey: 'speed_100_full', speed: '100Mbps', duplex: 'Full Duplex' })
          else if (duplexCode === null) {
            if (p.speed_100_half) matches.push({ comboKey: 'speed_100_half', speed: '100Mbps', duplex: '' })
            if (p.speed_100_full) matches.push({ comboKey: 'speed_100_full', speed: '100Mbps', duplex: '' })
          }
        } else if (bps >= 1_000_000_000 && p.speed_1g) {
          const label = bps === 1_000_000_000 ? '1Gbps' : `${bps / 1_000_000_000}Gbps`
          matches.push({ comboKey: 'speed_1g', speed: label, duplex: 'Full Duplex' })
        }

        for (const { comboKey, speed, duplex } of matches) {
          console.debug(`[AlertEngine] ${rule.name} Interface ${ifaceNum} → ${speed} ${duplex}`)
          triggered.push({
            severity:        p.severity ?? 'Warning',
            ruleName:        rule.name,
            paramKey:        `iface_speed_${ifaceNum}_${comboKey}`,
            ifaceNum,
            speedLabel:      speed,
            duplexLabel:     duplex,
            ifaceSpeedAlert: true,
          })
        }
      }
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
  persistCustomAlerts(existing.slice(0, 200))
  // Notify same-tab listeners (e.g. Alerts page) that a new alert was written
  window.dispatchEvent(new CustomEvent('nsa:alert-saved'))
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

/** Clear cooldowns and reset monitor breach states so conditions can re-fire. */
export function clearCooldowns() {
  cooldowns.clear()
  window.dispatchEvent(new CustomEvent('nsa:state-reset'))
}

/**
 * Save a recovery (device back online) alert and show a success toast.
 * Format: "Device Name: Up  DD Mon YYYY, HH:MM:SS"
 */
export function fireRecoveryAlert(deviceName, toastFn) {
  const timestamp = fmtDateTime(new Date())
  const msg = `${deviceName}: Up  ${timestamp}`
  toastFn.success(msg, { duration: 6000 })
  saveCustomAlert({
    id:              `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    severity_level:  'recovery',
    device_name:     deviceName,
    alert_name:      'Up',
    created_at:      new Date().toISOString(),
    is_resolved:     false,
    is_acknowledged: false,
  })
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

  for (const { severity, ruleName, paramKey, ifaceNum, ifaceState, ifaceSpeedAlert, speedLabel, duplexLabel } of triggered) {
    if (useCooldown) {
      const key = `${deviceId}::${ruleName}::${paramKey}`
      if (now - (cooldowns.get(key) ?? 0) < COOLDOWN_MS) continue
      cooldowns.set(key, now)
    }

    const timestamp = fmtDateTime(new Date())
    let fullMsg, alertName, isIfaceAlert = false, isIfaceSpeedAlert = false

    if (ifaceSpeedAlert) {
      // Format: "Severity – Device Name: Interface N Speed Duplex  DateTime"
      const duplexPart = duplexLabel ? ` ${duplexLabel}` : ''
      alertName         = `Interface ${ifaceNum} ${speedLabel}${duplexPart}`
      fullMsg           = `${severity} – ${deviceName}: ${alertName}  ${timestamp}`
      isIfaceSpeedAlert = true
    } else if (ifaceNum != null) {
      // Interface Up/Down format: "Severity – Interface N: Down  DateTime"
      alertName    = `Interface ${ifaceNum}: ${ifaceState}`
      fullMsg      = `${severity} – ${alertName}  ${timestamp}`
      isIfaceAlert = true
    } else {
      alertName = ruleName
      fullMsg   = `${severity} - ${deviceName}: ${ruleName}  ${timestamp}`
    }

    if (HIGH_SEV.has(severity)) toastFn.error(fullMsg, { duration: 6000 })
    else toastFn(fullMsg, { icon: '🔔', duration: 5000 })

    saveCustomAlert({
      id:               `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity_level:   severity,
      device_name:      deviceName,
      alert_name:       alertName,
      iface_alert:      isIfaceAlert,
      iface_speed_alert: isIfaceSpeedAlert,
      created_at:       new Date().toISOString(),
      is_resolved:      false,
      is_acknowledged:  false,
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
