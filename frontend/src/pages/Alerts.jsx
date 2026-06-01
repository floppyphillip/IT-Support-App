import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, Bell, Trash2, RefreshCw, ShieldCheck, ExternalLink, ShieldAlert } from 'lucide-react'
import { SkeletonCard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import {
  getCustomAlerts,
  acknowledgeCustomAlert,
  resolveCustomAlert,
  deleteCustomAlert,
} from '../utils/alertEngine'

// Severity → visual style mapping (backend levels + full custom levels)
const SEV = {
  critical:      { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',          left: 'border-l-red-500'    },
  warning:       { dot: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',     left: 'border-l-amber-500'  },
  info:          { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',        left: 'border-l-blue-500'   },
  // Full custom severity names
  Emergency:     { dot: 'bg-red-600',    badge: 'bg-red-600/20 text-red-500 border-red-600/30',           left: 'border-l-red-600'    },
  Alert:         { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',           left: 'border-l-red-500'    },
  Critical:      { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',  left: 'border-l-orange-500' },
  Error:         { dot: 'bg-orange-400', badge: 'bg-orange-400/20 text-orange-300 border-orange-400/30',  left: 'border-l-orange-400' },
  Warning:       { dot: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',     left: 'border-l-amber-500'  },
  Notification:  { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',        left: 'border-l-blue-500'   },
  Informational: { dot: 'bg-slate-400',  badge: 'bg-slate-400/20 text-slate-400 border-slate-400/30',     left: 'border-l-slate-400'  },
}

const TABS = [['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']]

export default function Alerts() {
  const navigate = useNavigate()
  const [backendAlerts, setBackendAlerts] = useState([])
  const [customAlerts, setCustomAlerts]   = useState([])
  const [total, setTotal]     = useState(0)
  const [active, setActive]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('active')
  const [actioning, setActioning] = useState(null)

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter === 'active')   params.is_resolved = false
      if (filter === 'resolved') params.is_resolved = true
      const { data } = await alertsAPI.list({ ...params, limit: 100 })
      setBackendAlerts(data.items)
      setTotal(data.total)
      setActive(data.active_count)
    } finally { setLoading(false) }

    // Always reload custom alerts from localStorage
    setCustomAlerts(getCustomAlerts())
  }

  useEffect(() => { loadAlerts() }, [filter])

  // ─── Filter custom alerts ─────────────────────────────────────────────────
  const filteredCustom = customAlerts.filter(a => {
    if (filter === 'active')   return !a.is_resolved
    if (filter === 'resolved') return  a.is_resolved
    return true
  })

  // Merge and sort newest first
  const allAlerts = [
    ...filteredCustom.map(a => ({ ...a, _isCustom: true })),
    ...backendAlerts,
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const totalActive = active + customAlerts.filter(a => !a.is_resolved).length
  const totalCount  = (total || 0) + customAlerts.length

  // ─── Actions ──────────────────────────────────────────────────────────────
  const doAction = async (alert, action) => {
    setActioning(alert.id)
    try {
      if (alert._isCustom) {
        if (action === 'acknowledge') acknowledgeCustomAlert(alert.id)
        else if (action === 'resolve') resolveCustomAlert(alert.id)
        else deleteCustomAlert(alert.id)
        setCustomAlerts(getCustomAlerts())
        toast.success(`Alert ${action}d`)
      } else {
        if (action === 'acknowledge') await alertsAPI.acknowledge(alert.id)
        else if (action === 'resolve') await alertsAPI.resolve(alert.id)
        else await alertsAPI.delete(alert.id)
        toast.success(`Alert ${action}d`)
        await loadAlerts()
      }
    } catch { toast.error('Action failed') }
    finally { setActioning(null) }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-sub">{totalActive} active · {totalCount} total</p>
        </div>
        <button className="btn-secondary" onClick={loadAlerts}>
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
      ) : allAlerts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title={filter === 'active' ? 'All clear!' : 'No alerts found'}
            description={filter === 'active' ? 'No active alerts — infrastructure looks healthy.' : 'No alerts match this filter.'}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {allAlerts.map((a) => {
            // Use display_severity for custom alerts, else backend severity
            const sevKey = a._isCustom ? (a.display_severity ?? a.severity) : a.severity
            const s = SEV[sevKey] ?? SEV.info

            const canOpenTicket = !a._isCustom && !!a.ticket_id && (filter !== 'resolved' || a.ticket?.status === 'closed')

            return (
              <div
                key={a.id}
                className={`card border-l-4 ${s.left} p-4 hover:shadow-lg transition-all duration-200 ${canOpenTicket ? 'cursor-pointer' : ''}`}
                onClick={() => canOpenTicket && navigate(`/tickets/${a.ticket_id}`)}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{a.title}</span>
                      <span className={`badge border ${s.badge}`}>
                        {a._isCustom ? (a.display_severity ?? a.severity) : a.severity}
                      </span>
                      {a._isCustom && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          <ShieldAlert size={9} /> Custom Rule
                        </span>
                      )}
                      {a.is_acknowledged && <span className="badge bg-slate-700/50 text-gray-500 border border-slate-600/50">ack'd</span>}
                      {a.is_resolved     && <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">resolved</span>}
                    </div>
                    <p className="text-sm text-gray-500">{a.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {a._isCustom
                        ? <span className="font-mono">{a.rule_name}</span>
                        : <span className="capitalize">{a.alert_type?.replace(/_/g, ' ')}</span>
                      }
                      {!a._isCustom && a.metric_value != null && <span>Value: {a.metric_value}</span>}
                      <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                      {canOpenTicket && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <ExternalLink className="w-3 h-3" />View ticket
                        </span>
                      )}
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
