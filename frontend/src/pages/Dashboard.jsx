import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI } from '../api/client'
import StatsCard from '../components/StatsCard'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonStats } from '../components/Skeleton'
import useWebSocket from '../hooks/useWebSocket'
import useAuth from '../hooks/useAuth'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Ticket, Server, AlertTriangle, Clock, Activity, ArrowRight, CheckCircle } from 'lucide-react'

const STATUS_COLORS = {
  open: '#2563eb', in_progress: '#f59e0b', ai_resolved: '#8b5cf6',
  escalated: '#ef4444', pending: '#f97316', resolved: '#10b981', closed: '#94a3b8',
}
const DEVICE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#94a3b8']

const TooltipStyle = { fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

export default function Dashboard() {
  const { accessToken } = useAuth()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const [{ data: s }, { data: a }] = await Promise.all([
        dashboardAPI.stats(),
        dashboardAPI.recentActivity(8),
      ])
      setStats(s)
      setActivity(a.activity || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchStats() }, [])

  const wsUrl = accessToken
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/dashboard/ws?token=${accessToken}`
    : null

  useWebSocket(wsUrl, {
    onMessage: (data) => {
      if (data.type === 'stats_update') {
        setStats((prev) => prev ? {
          ...prev,
          alerts: { ...prev.alerts, active: data.active_alerts },
          devices: { ...prev.devices, online: data.online_devices },
          tickets: { ...prev.tickets, open: data.open_tickets },
        } : prev)
      }
    },
  })

  const ticketChartData = stats?.charts?.tickets_by_status ?? []
  const deviceChartData = [
    { name: 'Online', value: stats?.devices.online ?? 0 },
    { name: 'Offline', value: stats?.devices.offline ?? 0 },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Real-time infrastructure overview</p>
      </div>

      {/* Stats */}
      {loading ? <SkeletonStats /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Open Tickets" value={stats?.tickets.open ?? '–'} icon={<Ticket className="w-5 h-5" />} color="blue" sub={`${stats?.tickets.critical ?? 0} critical`} />
          <StatsCard title="Online Devices" value={stats?.devices.online ?? '–'} icon={<Server className="w-5 h-5" />} color="green" sub={`${stats?.devices.availability_pct ?? 0}% availability`} />
          <StatsCard title="Active Alerts" value={stats?.alerts.active ?? '–'} icon={<AlertTriangle className="w-5 h-5" />} color={stats?.alerts.critical > 0 ? 'red' : 'yellow'} sub={`${stats?.alerts.critical ?? 0} critical`} />
          <StatsCard title="SLA Breached" value={stats?.tickets.sla_breached ?? '–'} icon={<Clock className="w-5 h-5" />} color={stats?.tickets.sla_breached > 0 ? 'red' : 'green'} sub={`${stats?.tickets.closed_this_week ?? 0} closed this week`} />
        </div>
      )}

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Tickets by Status</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ticketChartData} barCategoryGap="45%">
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.replace(/_/g, ' ')} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TooltipStyle} formatter={(val, _n, p) => [val, p.payload.status?.replace(/_/g, ' ')]} labelFormatter={() => ''} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {ticketChartData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Device Health</h2>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={deviceChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="value">
                    {deviceChartData.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={TooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-sm text-slate-500">{stats?.devices.total ?? 0} devices total</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent data */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent tickets */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Recent Tickets</h2>
              <Link to="/tickets" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-all duration-200">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {!stats?.recent_tickets?.length ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <CheckCircle className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No tickets yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.recent_tickets.map((t) => (
                  <Link key={t.id} to={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-all duration-200">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">{t.ticket_number}</p>
                    </div>
                    <AlertBadge priority={t.priority} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Active alerts */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900">Active Alerts</h2>
              <Link to="/alerts" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-all duration-200">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {!stats?.recent_alerts?.length ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <CheckCircle className="w-8 h-8 text-emerald-300 mb-2" />
                <p className="text-sm text-slate-400">All clear — no active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.recent_alerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === 'critical' ? 'text-red-500' : a.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                      <p className="text-xs text-slate-500 capitalize">{a.alert_type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-400" /> Activity
              </h2>
            </div>
            {!activity.length ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <Activity className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 capitalize">
                        {log.action.replace(/_/g, ' ')}{' '}
                        <span className="text-slate-400">{log.resource_type}</span>
                      </p>
                      <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
