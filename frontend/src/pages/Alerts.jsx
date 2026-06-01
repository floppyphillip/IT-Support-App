import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, Bell, Trash2, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'
import { SkeletonCard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import {
  getCustomAlerts,
  acknowledgeCustomAlert,
  resolveCustomAlert,
  deleteCustomAlert,
} from '../utils/alertEngine'
import { fmtDateTime } from '../utils/timeFormat'

const SEV_STYLE = {
  // Custom rule severity levels (exact names)
  Emergency:     { dot: 'bg-red-600',    badge: 'bg-red-600/20 text-red-500 border-red-600/30',          left: 'border-l-red-600'    },
  Alert:         { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',          left: 'border-l-red-500'    },
  Critical:      { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', left: 'border-l-orange-500' },
  Error:         { dot: 'bg-orange-400', badge: 'bg-orange-400/20 text-orange-300 border-orange-400/30', left: 'border-l-orange-400' },
  Warning:       { dot: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    left: 'border-l-amber-500'  },
  Notification:  { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       left: 'border-l-blue-500'   },
  Informational: { dot: 'bg-slate-400',  badge: 'bg-slate-400/20 text-slate-400 border-slate-400/30',    left: 'border-l-slate-400'  },
  // Backend severity buckets (capitalised)
  critical:      { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',          left: 'border-l-red-500'    },
  warning:       { dot: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',    left: 'border-l-amber-500'  },
  info:          { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',       left: 'border-l-blue-500'   },
}
const DEFAULT_STYLE = SEV_STYLE.info

const TABS = [['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']]

/**
 * Build the display heading for any alert.
 * Format: "Severity Level - Device Name: Alert Name  Date and Time"
 *
 * Custom alerts: fields stored explicitly (severity_level, device_name, alert_name).
 * Backend alerts: title = "Alert Name: Device Name", severity = "critical"/"warning"/"info".
 */
function buildHeading(a) {
  const ts = fmtDateTime(a.created_at)

  if (a._source === 'custom_rule') {
    // All three fields are stored explicitly — use them directly
    return `${a.severity_level} - ${a.device_name}: ${a.alert_name}  ${ts}`
  }

  // Backend alert: parse title "Device Offline: CoreRouter" and capitalise severity
  const sev = a.severity
    ? a.severity.charAt(0).toUpperCase() + a.severity.slice(1)
    : 'Unknown'
  const colonIdx  = (a.title ?? '').indexOf(': ')
  const alertName  = colonIdx >= 0 ? a.title.slice(0, colonIdx)  : (a.title ?? 'Alert')
  const deviceName = colonIdx >= 0 ? a.title.slice(colonIdx + 2) : ''
  const base = deviceName ? `${sev} - ${deviceName}: ${alertName}` : `${sev} - ${alertName}`
  return `${base}  ${ts}`
}

export default function Alerts() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('active')
  const [actioning, setActioning] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    requestAnimationFrame(() => {
      const all = getCustomAlerts().map(a => ({ ...a, _source: 'custom_rule' }))
      const filtered = all.filter(a => {
        if (filter === 'active')   return !a.is_resolved
        if (filter === 'resolved') return  a.is_resolved
        return true
      })
      setItems(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      setLoading(false)
    })
  }, [filter])

  useEffect(() => { load() }, [load])

  const activeCount = [
    ...getCustomAlerts().filter(a => !a.is_resolved),
  ].length

  const doAction = (a, action) => {
    setActioning(a.id)
    if (action === 'acknowledge') acknowledgeCustomAlert(a.id)
    else if (action === 'resolve') resolveCustomAlert(a.id)
    else deleteCustomAlert(a.id)
    toast.success(`Alert ${action}d`)
    load()
    setActioning(null)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-sub">{activeCount} active custom · {items.length} shown</p>
        </div>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: '#f9fafb' }}>
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              filter === v ? 'text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
            }`}
            style={filter === v ? { background: '#e2e8f0' } : {}}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} rows={2} />)}</div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title={filter === 'active' ? 'All clear!' : 'No alerts found'}
            description={
              filter === 'active'
                ? 'No active alerts — infrastructure looks healthy.'
                : 'No alerts match this filter.'
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(a => {
            const s = SEV_STYLE[a.severity_level] ?? DEFAULT_STYLE
            const heading = buildHeading(a)

            return (
              <div
                key={a.id}
                className={`card border-l-4 ${s.left} p-4 hover:shadow-lg transition-all duration-200`}
                onClick={undefined}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-1 font-mono">{heading}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {a._source === 'custom_rule' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          <ShieldAlert size={9} /> Custom Rule
                        </span>
                      )}
                      {a.is_acknowledged && (
                        <span className="badge bg-slate-700/50 text-gray-500 border border-slate-600/50">ack'd</span>
                      )}
                      {a.is_resolved && (
                        <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">resolved</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {!a.is_acknowledged && !a.is_resolved && (
                      <button className="btn-ghost py-1.5 px-2" onClick={() => doAction(a, 'acknowledge')}
                        disabled={actioning === a.id} title="Acknowledge">
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!a.is_resolved && (
                      <button className="btn-ghost py-1.5 px-2 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => doAction(a, 'resolve')} disabled={actioning === a.id} title="Resolve">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className="btn-ghost py-1.5 px-2 text-red-400 hover:bg-red-500/10"
                      onClick={() => doAction(a, 'delete')} disabled={actioning === a.id} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
