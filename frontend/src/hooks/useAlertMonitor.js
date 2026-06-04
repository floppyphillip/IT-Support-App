/**
 * Background alert monitor.
 *
 * Two entry points:
 *  1. `nsa:device-saved` event — fired whenever a device is created/updated.
 *     If the device has alerts_enabled, it is pinged immediately and registered
 *     for ongoing polling.
 *  2. Periodic poll (every POLL_MS) — pings every registered alert-enabled device.
 *
 * The module-level `alertDevices` map is the single source of truth for which
 * devices are being monitored.  It survives re-renders but resets on page refresh.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { devicesAPI } from '../api/client'
import { checkPingAlerts, fireAlertToasts } from '../utils/alertEngine'

const POLL_MS       = 2 * 60_000   // full-sweep every 2 minutes
const INTER_PING_MS = 2_000        // 2 s gap between consecutive pings

// Module-level — survives re-renders, resets on page refresh
const alertDevices = new Map()  // deviceId → full device object

function register(device) {
  const active =
    device?.extra_data?.alerts_enabled &&
    device?.extra_data?.alert_rule_ids?.length > 0 &&
    device?.ip_address
  if (active) {
    alertDevices.set(device.id, device)
  } else {
    alertDevices.delete(device.id)
  }
  return !!active
}

async function pingDevice(device) {
  try {
    const { data } = await devicesAPI.ping(device.id, 1)
    const triggered = checkPingAlerts(device, data)
    console.debug(
      `[AlertMonitor] ${device.name} — reachable:${data.reachable}` +
      ` latency:${data.latency_ms ?? '—'}ms triggered:${triggered.length}`
    )
    if (triggered.length > 0) {
      fireAlertToasts(triggered, device.id, device.name, toast, true)
    }
  } catch (err) {
    console.debug(`[AlertMonitor] ping API error for ${device.name}:`, err.message)
  }
}

export default function useAlertMonitor(accessToken) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!accessToken) return

    // ── Immediate check when any device is created/updated ─────────────────────
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
    window.addEventListener('nsa:device-saved', onDeviceSaved)

    // ── Periodic full sweep ─────────────────────────────────────────────────────
    async function sweep() {
      // Sync registry from the API on each sweep so adds/removes from other
      // sessions or pages are picked up without needing a page refresh.
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
        // API offline — keep using the existing registry from prior events/sweeps
      }

      const targets = [...alertDevices.values()]
      console.debug(`[AlertMonitor] sweep — ${targets.length} device(s) to check`)

      for (const device of targets) {
        await pingDevice(device)
        if (targets.length > 1) {
          await new Promise(r => setTimeout(r, INTER_PING_MS))
        }
      }

      timerRef.current = setTimeout(sweep, POLL_MS)
    }

    sweep()   // run immediately on mount

    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('nsa:device-saved', onDeviceSaved)
    }
  }, [accessToken])
}
