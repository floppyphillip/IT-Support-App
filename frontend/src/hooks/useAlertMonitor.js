/**
 * Background alert monitor — edge-triggered, not level-triggered.
 *
 * An alert fires ONLY when a parameter transitions from "ok" to "breaching".
 * While the device stays in the same state (e.g. still unreachable), no
 * duplicate alert is produced.  When the condition clears (recovery), the
 * state resets so the NEXT breach fires a fresh alert.
 *
 * Two entry points:
 *  1. `nsa:device-saved`  — fires an immediate check the moment a device is
 *     created/updated with alerts enabled.
 *  2. Periodic sweep (POLL_MS) — pings every registered device.
 *
 * State is reset globally when the user deletes or resolves alerts
 * (`nsa:state-reset`), allowing re-alerting on an already-breaching device.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { devicesAPI } from '../api/client'
import { checkPingAlerts, checkSnmpAlerts, checkIfaceAlerts, fireAlertToasts, fireRecoveryAlert } from '../utils/alertEngine'

const POLL_MS       = 2 * 60_000   // full sweep every 2 minutes
const INTER_PING_MS = 2_000        // gap between consecutive pings

// Module-level — survives re-renders, resets on page refresh
const alertDevices = new Map()  // deviceId → device object
// `${deviceId}::${ruleName}::${paramKey}` → true (was breaching on last check)
const paramStates  = new Map()

function register(device) {
  const active =
    device?.extra_data?.alerts_enabled &&
    device?.extra_data?.alert_rule_ids?.length > 0 &&
    device?.ip_address

  if (active) {
    alertDevices.set(device.id, device)
  } else {
    alertDevices.delete(device.id)
    // Drop stale state for this device
    for (const key of paramStates.keys()) {
      if (key.startsWith(device.id + '::')) paramStates.delete(key)
    }
  }
  return !!active
}

function readSnmpData(deviceId) {
  try {
    const sensors = JSON.parse(localStorage.getItem(`netsupportai-sensors-${deviceId}`) ?? '[]')
    const out = {}
    const tenMin = 10 * 60_000
    for (const s of sensors) {
      if (s.type !== 'snmp' || !s.oidKey || !s.data?.length) continue
      const last = s.data[s.data.length - 1]
      if (last?.value == null) continue
      if (Date.now() - new Date(last.ts ?? last.t).getTime() > tenMin) continue  // stale
      out[s.oidKey] = last.value
    }
    return out
  } catch { return {} }
}

async function pingDevice(device) {
  try {
    const { data } = await devicesAPI.ping(device.id, 1)
    const snmpData = readSnmpData(device.id)
    const current  = [
      ...checkPingAlerts(device, data),
      ...checkSnmpAlerts(device, snmpData),
      ...checkIfaceAlerts(device, snmpData),
    ]

    const breachingNow = new Set(
      current.map(b => `${device.id}::${b.ruleName}::${b.paramKey}`)
    )

    // State change ok → breach: collect only NEW breaches
    const newBreaches = current.filter(({ ruleName, paramKey }) => {
      const key = `${device.id}::${ruleName}::${paramKey}`
      return !(paramStates.get(key) ?? false)
    })

    // Update breach states
    for (const { ruleName, paramKey } of current) {
      paramStates.set(`${device.id}::${ruleName}::${paramKey}`, true)
    }

    // State change breach → ok: reset and fire recovery if it was a timeout breach
    let didFireRecovery = false
    for (const [key, wasBreaching] of paramStates.entries()) {
      if (wasBreaching && key.startsWith(device.id + '::') && !breachingNow.has(key)) {
        paramStates.set(key, false)
        console.debug(`[AlertMonitor] ${device.name} recovered — ${key.split('::').slice(1).join('/')}`)
        // Fire one recovery alert when the device becomes reachable again
        if (!didFireRecovery && key.split('::').pop() === 'ping_timeout') {
          fireRecoveryAlert(device.name, toast)
          didFireRecovery = true
        }
      }
    }

    console.debug(
      `[AlertMonitor] ${device.name}` +
      ` reachable:${data.reachable} latency:${data.latency_ms ?? '—'}ms` +
      ` newBreaches:${newBreaches.length} totalBreaching:${current.length}`
    )

    if (newBreaches.length > 0) {
      // useCooldown=false — state-change dedup already handled above
      fireAlertToasts(newBreaches, device.id, device.name, toast, false)
    }
  } catch (err) {
    console.debug(`[AlertMonitor] ping error for ${device.name}:`, err.message)
  }
}

export default function useAlertMonitor(accessToken) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!accessToken) return

    // Immediate check when a device is created/updated
    function onDeviceSaved({ detail }) {
      const device = detail?.device
      if (!device?.id) return
      const active = register(device)
      console.debug(
        `[AlertMonitor] device-saved "${device.name}" — ` +
        (active ? 'registered, pinging now' : 'not alert-enabled, skipped')
      )
      if (active) pingDevice(device)
    }

    // User dismissed/resolved alerts — reset states so devices can re-alert
    function onStateReset() {
      for (const key of paramStates.keys()) paramStates.set(key, false)
      console.debug('[AlertMonitor] state reset — all breach states cleared')
    }

    window.addEventListener('nsa:device-saved', onDeviceSaved)
    window.addEventListener('nsa:state-reset',  onStateReset)

    async function sweep() {
      // Sync registry from API to pick up changes made in other sessions
      try {
        const [nocRes, custRes] = await Promise.allSettled([
          devicesAPI.list({ limit: 200, category: 'noc' }),
          devicesAPI.list({ limit: 200, category: 'customer' }),
        ])
        const all = [
          ...(nocRes.status  === 'fulfilled' ? (nocRes.value.data.items  ?? []) : []),
          ...(custRes.status === 'fulfilled' ? (custRes.value.data.items ?? []) : []),
        ]
        all.forEach(register)
      } catch {
        // API offline — use existing registry
      }

      const targets = [...alertDevices.values()]
      console.debug(`[AlertMonitor] sweep — ${targets.length} device(s)`)

      for (const device of targets) {
        await pingDevice(device)
        if (targets.length > 1) await new Promise(r => setTimeout(r, INTER_PING_MS))
      }

      timerRef.current = setTimeout(sweep, POLL_MS)
    }

    sweep()

    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('nsa:device-saved', onDeviceSaved)
      window.removeEventListener('nsa:state-reset',  onStateReset)
    }
  }, [accessToken])
}
