/**
 * Background alert monitor.
 * Polls alertsAPI.list() every 60 s for backend-generated monitoring events
 * (device_offline, ping_failure, high_latency) and evaluates the device's
 * custom alert rules against each event.  When a rule breaches, the alert is
 * written to localStorage via fireAlertToasts so it appears on the Alerts page.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { alertsAPI, devicesAPI } from '../api/client'
import { checkPingAlerts, fireAlertToasts } from '../utils/alertEngine'

// Backend event type → synthetic ping data that exercises the right parameters
const EVENT_PING_MAP = {
  device_offline: { reachable: false, latency_ms: null,  packet_loss_pct: 100 },
  ping_failure:   { reachable: false, latency_ms: null,  packet_loss_pct: 100 },
  high_latency:   { reachable: true,  latency_ms: 9999,  packet_loss_pct:   0 },
}
const MONITOR_TYPES = new Set(Object.keys(EVENT_PING_MAP))
const POLL_MS       = 60_000   // 60 s between polls

// Module-level — survive re-renders, reset on full page refresh
const processedIds  = new Set()
const deviceCache   = new Map()  // deviceId → full device object (with extra_data)

async function getDevice(id) {
  if (deviceCache.has(id)) return deviceCache.get(id)
  try {
    const { data } = await devicesAPI.get(id)
    deviceCache.set(id, data)
    return data
  } catch {
    return null
  }
}

export default function useAlertMonitor(accessToken) {
  const timerRef    = useRef(null)
  const startedAt   = useRef(Date.now() - 5 * 60_000)  // look back 5 min on first poll

  useEffect(() => {
    if (!accessToken) return

    async function poll() {
      try {
        const { data } = await alertsAPI.list({ limit: 50 })
        const alerts = (data.items ?? data ?? [])
          .filter(a =>
            MONITOR_TYPES.has(a.alert_type) &&
            !processedIds.has(a.id) &&
            new Date(a.created_at).getTime() >= startedAt.current
          )

        for (const alert of alerts) {
          processedIds.add(alert.id)

          const deviceId = alert.device_id
          if (!deviceId) continue

          const device = await getDevice(deviceId)
          if (!device?.extra_data?.alerts_enabled) continue

          const fakePing  = EVENT_PING_MAP[alert.alert_type]
          const triggered = checkPingAlerts(device, fakePing)
          if (triggered.length > 0) {
            fireAlertToasts(triggered, device.id, device.name, toast, false)
          }
        }
      } catch {
        // Backend unavailable — silently skip
      }

      // Slide the lookback window forward so subsequent polls only see new alerts
      startedAt.current = Date.now() - 10_000  // 10 s overlap to avoid gaps
      timerRef.current = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => clearTimeout(timerRef.current)
  }, [accessToken])
}
