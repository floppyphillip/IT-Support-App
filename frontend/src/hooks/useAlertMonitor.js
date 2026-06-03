/**
 * Background alert monitor — runs while the app is open.
 *
 * Every POLL_MS it fetches all devices that have alerts_enabled=true,
 * pings each one via the API, evaluates the device's custom alert rules,
 * and writes to localStorage when a rule breaches.
 *
 * This is the frontend counterpart to the planned backend Celery worker.
 * It does NOT use the manual ping tool in the UI — it runs silently in the
 * background as long as Layout is mounted.
 */
import { useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { devicesAPI } from '../api/client'
import { checkPingAlerts, fireAlertToasts } from '../utils/alertEngine'

const POLL_MS        = 5 * 60_000   // ping every 5 minutes
const INTER_PING_MS  = 3_000        // 3 s gap between device pings to avoid hammering

export default function useAlertMonitor(accessToken) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (!accessToken) return

    async function run() {
      try {
        // Fetch all NOC + customer devices; filter to alert-enabled ones
        const [nocRes, custRes] = await Promise.allSettled([
          devicesAPI.list({ limit: 200, category: 'noc' }),
          devicesAPI.list({ limit: 200, category: 'customer' }),
        ])

        const noc  = nocRes.status  === 'fulfilled' ? (nocRes.value.data.items  ?? []) : []
        const cust = custRes.status === 'fulfilled' ? (custRes.value.data.items ?? []) : []

        const targets = [...noc, ...cust].filter(
          d => d.extra_data?.alerts_enabled &&
               d.extra_data?.alert_rule_ids?.length > 0 &&
               d.ip_address
        )

        console.debug(`[AlertMonitor] checking ${targets.length} alert-enabled device(s)`)

        for (const device of targets) {
          try {
            const { data } = await devicesAPI.ping(device.id, 1)
            const triggered = checkPingAlerts(device, data)
            if (triggered.length > 0) {
              fireAlertToasts(triggered, device.id, device.name, toast, true)
            }
            console.debug(`[AlertMonitor] ${device.name} → reachable:${data.reachable} latency:${data.latency_ms}ms triggered:${triggered.length}`)
          } catch {
            // This device's ping failed at the API level — skip it
          }

          // Brief pause between devices so we don't flood the backend
          await new Promise(r => setTimeout(r, INTER_PING_MS))
        }
      } catch {
        // Could not fetch device list — backend offline, skip this cycle
      }

      timerRef.current = setTimeout(run, POLL_MS)
    }

    run()
    return () => clearTimeout(timerRef.current)
  }, [accessToken])
}
