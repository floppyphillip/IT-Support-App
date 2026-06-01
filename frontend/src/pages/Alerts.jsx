import { useEffect, useState } from 'react'
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

// Severity → visual style
const SEV_STYLE = {
  Emergency:     { dot: 'bg-red-600',    badge: 'bg-red-600/20 text-red-500 border-red-600/30',           left: 'border-l-red-600'    },
  Alert:         { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',           left: 'border-l-red-500'    },
  Critical:      { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',  left: 'border-l-orange-500' },
  Error:         { dot: 'bg-orange-400', badge: 'bg-orange-400/20 text-orange-300 border-orange-400/30',  left: 'border-l-orange-400' },
  Warning:       { dot: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',     left: 'border-l-amber-500'  },
  Notification:  { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',        left: 'border-l-blue-500'   },
  Informational: { dot: 'bg-slate-400',  badge: 'bg-slate-400/20 text-slate-400 border-slate-400/30',     left: 'border-l-slate-400'  },
}
const DEFAULT_STYLE = SEV_STYLE.Notification

const TABS = [['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']]

export default function Alerts() {
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('active')
  const [actioning, setActioning] = useState(null)

  const load = () => {
    setLoading(true)
    setAlerts(getCustomAlerts())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = alerts.filter(a => {
    if (filter === 'active')   return !a.is_resolved
    if (filter === 'resolved') return  a.is_resolved
    return true
  })

  const activeCount = alerts.filter(a => !a.is_resolved).length

  const doAction = (id, action) => {
    setActioning(id)
    if (action === 'acknowledge') acknowledgeCustomAlert(id)
    else if (action === 'resolve') resolveCustomAlert(id)
    else deleteCustomAlert(id)
    setAlerts(getCustomAlerts())
    toast.success(`Alert ${action}d`)
    setActioning(null)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-sub">{activeCount} active · {alerts.length} total</p>
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
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title={filter === 'active' ? 'All clear!' : 'No alerts found'}
            description={
              filter === 'active'
                ? 'No active alerts — all monitored devices are within thresholds.'
                : 'No alerts match this filter.'
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const s = SEV_STYLE[a.severity_level] ?? DEFAULT_STYLE

            // Exact format: Severity Level - Device Name: Alert Name  Date and Time
            const heading = `${a.severity_level} - ${a.device_name}: ${a.alert_name}  ${fmtDateTime(a.created_at)}`

            return (
              <div key={a.id} className={`card border-l-4 ${s.left} p-4 hover:shadow-lg transition-all duration-200`}>
                <div className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900 font-mono">{heading}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`badge border ${s.badge}`}>{a.severity_level}</span>
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

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!a.is_acknowledged && !a.is_resolved && (
                      <button
                        className="btn-ghost py-1.5 px-2"
                        onClick={() => doAction(a.id, 'acknowledge')}
                        disabled={actioning === a.id}
                        title="Acknowledge"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!a.is_resolved && (
                      <button
                        className="btn-ghost py-1.5 px-2 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => doAction(a.id, 'resolve')}
                        disabled={actioning === a.id}
                        title="Resolve"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      className="btn-ghost py-1.5 px-2 text-red-400 hover:bg-red-500/10"
                      onClick={() => doAction(a.id, 'delete')}
                      disabled={actioning === a.id}
                      title="Delete"
                    >
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
