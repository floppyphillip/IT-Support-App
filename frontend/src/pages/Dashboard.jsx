import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI } from '../api/client'
import StatsCard from '../components/StatsCard'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import useWebSocket from '../hooks/useWebSocket'
import useAuth from '../hooks/useAuth'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Ticket, Server, AlertTriangle, CheckCircle, Activity, Clock } from 'lucide-react'

const STATUS_COLORS = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  ai_resolved: '#8b5cf6',
  escalated: '#ef4444',
}

const DEVICE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#94a3b8', '#64748b']

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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard…</div>

  const ticketChartData = stats?.charts?.tickets_by_status ?? []
  const deviceChartData = [
    { name: 'Online', value: stats?.devices.online ?? 0 },
    { name: 'Offline', value: stats?.devices.offline ?? 0 },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time infrastructure overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Open Tickets"
          value={stats?.tickets.open ?? '–'}
          icon={<Ticket className="w-5 h-5" />}
          color="blue"
          sub={`${stats?.tickets.critical ?? 0} critical`}
        />
        <StatsCard
          title="Online Devices"
          value={stats?.devices.online ?? '–'}
          icon={<Server className="w-5 h-5" />}
          color="green"
          sub={`${stats?.devices.availability_pct ?? 0}% availability`}
        />
        <StatsCard
          title="Active Alerts"
          value={stats?.alerts.active ?? '–'}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={stats?.alerts.critical > 0 ? 'red' : 'yellow'}
          sub={`${stats?.alerts.critical ?? 0} critical`}
        />
        <StatsCard
          title="SLA Breached"
          value={stats?.tickets.sla_breached ?? '–'}
          icon={<Clock className="w-5 h-5" />}
          color={stats?.tickets.sla_breached > 0 ? 'red' : 'green'}
          sub={`${stats?.tickets.closed_this_week ?? 0} closed this week`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tickets by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ticketChartData} barCategoryGap="40%">
              <XAxis dataKey="status" tick={{ fontSize: 12 }} tickFormatter={(v) => v.replace('_', ' ')} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(val, _name, props) => [val, props.payload.status]}
                labelFormatter={() => ''}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {ticketChartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-4">Device Health</h2>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={deviceChartData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {deviceChartData.map((_, i) => (
                    <Cell key={i} fill={DEVICE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-sm text-gray-500">
            {stats?.devices.total ?? 0} devices total
          </p>
        </div>
      </div>

      {/* Recent data + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tickets */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Tickets</h2>
            <Link to="/tickets" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {stats?.recent_tickets?.length === 0 && (
              <p className="text-sm text-gray-400">No tickets yet.</p>
            )}
            {stats?.recent_tickets?.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">{t.ticket_number}</p>
                </div>
                <AlertBadge priority={t.priority} />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent alerts */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Active Alerts</h2>
            <Link to="/alerts" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {stats?.recent_alerts?.length === 0 && (
              <p className="text-sm text-gray-400">No active alerts.</p>
            )}
            {stats?.recent_alerts?.map((a) => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    a.severity === 'critical' ? 'text-red-500' :
                    a.severity === 'warning'  ? 'text-yellow-500' : 'text-blue-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.alert_type.replace(/_/g,' ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {activity.length === 0 && (
              <p className="text-sm text-gray-400">No activity yet.</p>
            )}
            {activity.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 capitalize">
                    {log.action.replace(/_/g, ' ')} <span className="text-gray-400">{log.resource_type}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
