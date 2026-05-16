import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI } from '../api/client'
import StatsCard from '../components/StatsCard'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonStats } from '../components/Skeleton'
import useWebSocket from '../hooks/useWebSocket'
import useAuth from '../hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Ticket, Server, AlertTriangle, Clock, Activity, ArrowRight, Clock3 } from 'lucide-react'

const STATUS_COLORS = {
  open: '#3b82f6', in_progress: '#f59e0b', ai_resolved: '#8b5cf6',
  escalated: '#ef4444', pending: '#f97316', resolved: '#10b981', closed: '#475569',
}

const TTStyle = {
  background: '#182035', border: '1px solid #1e2d47',
  borderRadius: 8, fontSize: 11, color: '#e2e8f0',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildWeekChart(byStatus = []) {
  return DAYS.map((day) => ({ day, open: 0, resolved: 0, ai_fixed: 0, ...byStatus.find((d) => d.day === day) }))
}

export default function Dashboard() {
  const { accessToken } = useAuth()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const [{ data: s }, { data: a }] = await Promise.all([
        dashboardAPI.stats(),
        dashboardAPI.recentActivity(10),
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
          alerts:  { ...prev.alerts,  active: data.active_alerts },
          devices: { ...prev.devices, online: data.online_devices },
          tickets: { ...prev.tickets, open:   data.open_tickets },
        } : prev)
      }
      if (data.type === 'activity') {
        setActivity((prev) => [data, ...prev].slice(0, 10))
      }
    },
  })

  const weekData = buildWeekChart(stats?.charts?.tickets_by_day ?? [])
  const criticalTickets = (stats?.recent_tickets ?? []).filter((t) => t.priority === 'critical' || t.priority === 'high')

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Real-time infrastructure overview</p>
      </div>

      {/* Stats row */}
      {loading ? <SkeletonStats /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Open Tickets" icon={<Ticket className="w-5 h-5" />} color="blue"
            value={stats?.tickets.open ?? '–'}
            sub={`${stats?.tickets.new_today ?? 0} new today`} trend="up"
          />
          <StatsCard
            title="Online Devices" icon={<Server className="w-5 h-5" />}
            color={stats?.devices.offline > 0 ? 'red' : 'green'}
            value={stats?.devices.online ?? '–'}
            sub={stats?.devices.offline > 0 ? `${stats.devices.offline} offline` : 'All reachable'}
            trend={stats?.devices.offline > 0 ? 'down' : 'up'}
          />
          <StatsCard
            title="Active Alerts" icon={<AlertTriangle className="w-5 h-5" />}
            color={stats?.alerts.critical > 0 ? 'red' : 'yellow'}
            value={stats?.alerts.active ?? '–'}
            sub={`${stats?.alerts.critical ?? 0} critical`}
            trend={stats?.alerts.critical > 0 ? 'up' : undefined}
          />
          <StatsCard
            title="SLA Breached" icon={<Clock className="w-5 h-5" />}
            color={stats?.tickets.sla_breached > 0 ? 'red' : 'green'}
            value={stats?.tickets.sla_breached ?? '–'}
            sub={`${stats?.tickets.closed_this_week ?? 0} closed this week`}
            trend={stats?.tickets.sla_breached > 0 ? 'up' : undefined}
          />
        </div>
      )}

      {/* Charts + Live Activity */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Weekly ticket chart */}
          <div className="lg:col-span-3 card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Tickets This Week</h2>
                <p className="text-xs text-slate-500 mt-0.5">Mon – Sun</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Open</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Resolved</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />AI-fixed</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={weekData} barGap={3} barCategoryGap="35%">
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TTStyle} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="open"     fill="#3b82f6" radius={[4,4,0,0]} name="Open" />
                <Bar dataKey="resolved" fill="#10b981" radius={[4,4,0,0]} name="Resolved" />
                <Bar dataKey="ai_fixed" fill="#8b5cf6" radius={[4,4,0,0]} name="AI-fixed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Live activity */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="card-header">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-blue-400" />Live Activity
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            {activity.length === 0 ? (
              <div className="py-10 text-center text-slate-600 text-sm">No recent activity</div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#1e2d47' }}>
                {activity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#1e2840] transition-all duration-200">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-500/20">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 capitalize truncate">
                        {log.action?.replace(/_/g, ' ')}{' '}
                        <span className="text-slate-500">{log.resource_type}</span>
                      </p>
                      {log.resource_name && <p className="text-xs text-slate-500 truncate">{log.resource_name}</p>}
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Critical & High Priority Tickets */}
      {!loading && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />Critical &amp; High Priority Tickets
            </h2>
            <Link to="/tickets?status=open" className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-all duration-200">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {criticalTickets.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-sm">No critical or high priority tickets</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#1e2d47' }}>
              {criticalTickets.map((t) => {
                const slaOk = t.sla_deadline && new Date(t.sla_deadline) > new Date()
                const slaBreached = t.sla_deadline && !slaOk
                return (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#1e2840] transition-all duration-200"
                    style={{ borderLeft: t.priority === 'critical' ? '3px solid #ef4444' : '3px solid #f59e0b' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t.ticket_number}
                        {t.client?.name && <> · {t.client.name}</>}
                        {t.category && <> · {t.category}</>}
                      </p>
                    </div>
                    <AlertBadge priority={t.priority} />
                    <StatusIndicator status={t.status} />
                    {t.sla_deadline && (
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${slaBreached ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/50 text-slate-400'}`}>
                        <Clock3 className="w-3 h-3" />
                        {slaBreached ? 'BREACHED' : formatDistanceToNow(new Date(t.sla_deadline), { addSuffix: true })}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
