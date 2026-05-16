import { useEffect, useState } from 'react'
import { alertsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CheckCircle, Bell, Trash2, RefreshCw } from 'lucide-react'

const SEV_DOT = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}
const SEV_BADGE = {
  critical: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-blue-50 text-blue-700',
}
const SEV_ICON = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const TABS = [['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']]

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [actioning, setActioning] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter === 'active') params.is_resolved = false
      if (filter === 'resolved') params.is_resolved = true
      const { data } = await alertsAPI.list({ ...params, limit: 100 })
      setAlerts(data.items)
      setTotal(data.total)
      setActive(data.active_count)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const doAction = async (id, action) => {
    setActioning(id)
    try {
      if (action === 'acknowledge') await alertsAPI.acknowledge(id)
      else if (action === 'resolve') await alertsAPI.resolve(id)
      else await alertsAPI.delete(id)
      toast.success(`Alert ${action}d`)
      await load()
    } catch { toast.error('Action failed') }
    finally { setActioning(null) }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-sub">{active} active · {total} total</p>
        </div>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === v ? 'bg-white shadow-sm text-zoho-text' : 'text-zoho-muted hover:text-zoho-text'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zoho-muted text-sm">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="text-zoho-muted text-sm">
            {filter === 'active' ? 'No active alerts — all clear!' : 'No alerts found.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {alerts.map((a, idx) => (
            <div
              key={a.id}
              className={`flex items-start gap-4 px-5 py-4 ${idx !== alerts.length - 1 ? 'border-b border-zoho-border' : ''}`}
            >
              {/* Severity dot */}
              <div className="flex-shrink-0 mt-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${SEV_DOT[a.severity] ?? 'bg-gray-400'}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-zoho-text">{a.title}</span>
                  <span className={`badge ${SEV_BADGE[a.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                    {a.severity}
                  </span>
                  {a.is_acknowledged && (
                    <span className="badge bg-gray-100 text-zoho-muted">acknowledged</span>
                  )}
                  {a.is_resolved && (
                    <span className="badge bg-green-50 text-green-700">resolved</span>
                  )}
                </div>
                <p className="text-sm text-zoho-muted">{a.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="capitalize">{a.alert_type.replace(/_/g, ' ')}</span>
                  {a.metric_value != null && <span>Value: {a.metric_value}</span>}
                  <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!a.is_acknowledged && !a.is_resolved && (
                  <button
                    className="btn-ghost py-1.5 px-2.5 text-xs"
                    onClick={() => doAction(a.id, 'acknowledge')}
                    disabled={actioning === a.id}
                    title="Acknowledge"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                )}
                {!a.is_resolved && (
                  <button
                    className="btn-ghost py-1.5 px-2.5 text-xs text-green-600 hover:bg-green-50"
                    onClick={() => doAction(a.id, 'resolve')}
                    disabled={actioning === a.id}
                    title="Resolve"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  className="btn-ghost py-1.5 px-2.5 text-xs text-red-400 hover:bg-red-50"
                  onClick={() => doAction(a.id, 'delete')}
                  disabled={actioning === a.id}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
