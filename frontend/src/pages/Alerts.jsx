import { useEffect, useState } from 'react'
import { alertsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CheckCircle, Bell, BellOff, Trash2, RefreshCw } from 'lucide-react'

const SEVERITY_STYLES = {
  critical: 'border-l-red-500 bg-red-50',
  warning:  'border-l-yellow-500 bg-yellow-50',
  info:     'border-l-blue-500 bg-blue-50',
}
const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-yellow-100 text-yellow-700',
  info:     'bg-blue-100 text-blue-700',
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active') // 'active' | 'all' | 'resolved'
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-yellow-500" /> Alerts
          </h1>
          <p className="text-sm text-gray-500">{active} active of {total} total</p>
        </div>
        <button className="btn-secondary" onClick={load}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['active', 'Active'], ['all', 'All'], ['resolved', 'Resolved']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
          <p>No alerts {filter === 'active' ? 'active' : ''} — all clear!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className={`card border-l-4 p-4 ${SEVERITY_STYLES[a.severity] ?? 'border-l-gray-300'}`}>
              <div className="flex items-start gap-4">
                <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  a.severity === 'critical' ? 'text-red-500' :
                  a.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{a.title}</span>
                    <span className={`badge ${SEVERITY_BADGE[a.severity]}`}>{a.severity}</span>
                    {a.is_acknowledged && <span className="badge bg-gray-100 text-gray-500">acknowledged</span>}
                    {a.is_resolved && <span className="badge bg-green-100 text-green-700">resolved</span>}
                  </div>
                  <p className="text-sm text-gray-600">{a.message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="capitalize">{a.alert_type.replace(/_/g,' ')}</span>
                    {a.metric_value && <span>Value: {a.metric_value}</span>}
                    <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!a.is_acknowledged && !a.is_resolved && (
                    <button className="btn-secondary py-1 text-xs" onClick={() => doAction(a.id, 'acknowledge')} disabled={actioning === a.id}>
                      <Bell className="w-3.5 h-3.5" /> Ack
                    </button>
                  )}
                  {!a.is_resolved && (
                    <button className="btn-secondary py-1 text-xs" onClick={() => doAction(a.id, 'resolve')} disabled={actioning === a.id}>
                      <CheckCircle className="w-3.5 h-3.5" /> Resolve
                    </button>
                  )}
                  <button className="text-gray-300 hover:text-red-400 p-1" onClick={() => doAction(a.id, 'delete')} disabled={actioning === a.id}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
