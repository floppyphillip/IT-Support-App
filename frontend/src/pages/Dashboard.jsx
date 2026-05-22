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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { Ticket, Server, AlertTriangle, Clock, Activity, ArrowRight, Clock3, Zap } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MOCK_STATS = {
  tickets:  { open: 24, new_today: 3, sla_breached: 2, closed_this_week: 18 },
  devices:  { online: 47, offline: 2 },
  alerts:   { active: 7, critical: 2 },
  charts:   { tickets_by_day: [] },
  recent_tickets: [
    { id: '1', ticket_number: 'TK-0094', title: 'BGP session dropping on core router', priority: 'critical', status: 'open', client: { name: 'Skytel ISP' }, category: 'Network' },
    { id: '2', ticket_number: 'TK-0093', title: 'VPN tunnel flapping — site-to-site', priority: 'high', status: 'in_progress', client: { name: 'Acme Corp' }, category: 'VPN' },
    { id: '3', ticket_number: 'TK-0091', title: 'SNMP polling failure — switch cluster', priority: 'high', status: 'open', client: { name: 'DataVault Ltd' }, category: 'Monitoring' },
  ],
}

const MOCK_ACTIVITY = [
  { id: '1', action: 'ticket_created',  resource_type: 'ticket',  resource_name: 'TK-0094 BGP session dropping', created_at: new Date(Date.now() - 120000).toISOString() },
  { id: '2', action: 'ai_resolved',     resource_type: 'ticket',  resource_name: 'TK-0089 DNS resolution failure', created_at: new Date(Date.now() - 480000).toISOString() },
  { id: '3', action: 'device_offline',  resource_type: 'device',  resource_name: 'core-rtr-01 (10.0.0.1)', created_at: new Date(Date.now() - 900000).toISOString() },
  { id: '4', action: 'alert_triggered', resource_type: 'alert',   resource_name: 'CPU > 90% on fw-01', created_at: new Date(Date.now() - 1500000).toISOString() },
  { id: '5', action: 'backup_created',  resource_type: 'device',  resource_name: 'sw-access-04 config backup', created_at: new Date(Date.now() - 2400000).toISOString() },
]

function buildWeekChart(byStatus = []) {
  return DAYS.map((day) => ({
    day,
    open: Math.floor(Math.random() * 8) + 1,
    resolved: Math.floor(Math.random() * 6),
    ai: Math.floor(Math.random() * 4),
    ...byStatus.find((d) => d.day === day),
  }))
}

const ACTION_COLORS = {
  ticket_created:  { bg: 'rgba(59,130,246,0.12)',  dot: '#3b82f6' },
  ai_resolved:     { bg: 'rgba(139,92,246,0.12)',  dot: '#8b5cf6' },
  device_offline:  { bg: 'rgba(239,68,68,0.12)',   dot: '#ef4444' },
  alert_triggered: { bg: 'rgba(245,158,11,0.12)',  dot: '#f59e0b' },
  backup_created:  { bg: 'rgba(16,185,129,0.12)',  dot: '#10b981' },
}

const TTStyle = {
  background: 'var(--surface-2, #f8fafc)',
  border: '1px solid var(--border, rgba(0,0,0,0.09))',
  borderRadius: 8,
  fontSize: 17,
  color: '#374151',
  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
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
        dashboardAPI.recentActivity(8),
      ])
      setStats(s)
      setActivity(a.activity || [])
    } catch {
      setStats(MOCK_STATS)
      setActivity(MOCK_ACTIVITY)
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
        setStats((prev) => prev ? { ...prev, alerts: { ...prev.alerts, active: data.active_alerts }, devices: { ...prev.devices, online: data.online_devices }, tickets: { ...prev.tickets, open: data.open_tickets } } : prev)
      }
      if (data.type === 'activity') setActivity((prev) => [data, ...prev].slice(0, 8))
    },
  })

  const weekData = buildWeekChart(stats?.charts?.tickets_by_day ?? [])
  const criticalTickets = (stats?.recent_tickets ?? []).filter((t) => t.priority === 'critical' || t.priority === 'high')

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Real-time infrastructure overview</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span style={{ color: 'var(--text-4)', fontSize: 17 }}>Live</span>
        </div>
      </div>

      {/* Stats row */}
      {loading ? <SkeletonStats /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard title="Open Tickets"   icon={<Ticket className="w-3.5 h-3.5" />}   color="blue"
            value={stats?.tickets.open ?? '–'}   sub={`${stats?.tickets.new_today ?? 0} new today`} trend="up" />
          <StatsCard title="Online Devices" icon={<Server className="w-3.5 h-3.5" />}   color={stats?.devices.offline > 0 ? 'red' : 'green'}
            value={stats?.devices.online ?? '–'} sub={stats?.devices.offline > 0 ? `${stats.devices.offline} offline` : 'All reachable'} trend={stats?.devices.offline > 0 ? 'down' : 'up'} />
          <StatsCard title="Active Alerts"  icon={<AlertTriangle className="w-3.5 h-3.5" />} color={stats?.alerts.critical > 0 ? 'red' : 'yellow'}
            value={stats?.alerts.active ?? '–'}  sub={`${stats?.alerts.critical ?? 0} critical`} trend={stats?.alerts.critical > 0 ? 'up' : undefined} />
          <StatsCard title="SLA Breached"   icon={<Clock className="w-3.5 h-3.5" />}    color={stats?.tickets.sla_breached > 0 ? 'red' : 'green'}
            value={stats?.tickets.sla_breached ?? '–'} sub={`${stats?.tickets.closed_this_week ?? 0} closed this week`} trend={stats?.tickets.sla_breached > 0 ? 'up' : undefined} />
        </div>
      )}

      {/* Charts + Activity */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Bar chart */}
          <div className="lg:col-span-3 card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ color: 'var(--text-1)', fontSize: 19, fontWeight: 600 }}>Tickets This Week</p>
                <p style={{ color: 'var(--text-4)', fontSize: 17, marginTop: 1 }}>Mon – Sun · grouped by status</p>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 15, color: 'var(--text-4)' }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#3b82f6' }} />Open</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#10b981' }} />Resolved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#8b5cf6' }} />AI-fixed</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={weekData} barGap={2} barCategoryGap="38%">
                <XAxis dataKey="day" tick={{ fontSize: 15, fill: 'var(--text-4, #4a5568)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 15, fill: 'var(--text-4, #4a5568)' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={TTStyle} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                <Bar dataKey="open"     fill="#3b82f6" radius={[3,3,0,0]} name="Open" />
                <Bar dataKey="resolved" fill="#10b981" radius={[3,3,0,0]} name="Resolved" />
                <Bar dataKey="ai"       fill="#8b5cf6" radius={[3,3,0,0]} name="AI-fixed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Live activity */}
          <div className="lg:col-span-2 card flex flex-col overflow-hidden">
            <div className="card-header flex-shrink-0">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-1)', fontSize: 19, fontWeight: 600 }}>
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--blue-text)' }} />
                Live Activity
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
              {activity.length === 0 ? (
                <div className="py-8 text-center" style={{ color: 'var(--text-4)', fontSize: 17 }}>No recent activity</div>
              ) : activity.map((log) => {
                const ac = ACTION_COLORS[log.action] ?? { bg: 'rgba(59,130,246,0.10)', dot: '#3b82f6' }
                return (
                  <div key={log.id} className="flex items-start gap-2.5 px-4 py-2.5 transition-all duration-150" style={{ '--hover-bg': 'var(--hover)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: ac.bg }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ac.dot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: 'var(--text-2)', fontSize: 17, fontWeight: 500 }}>
                        {log.action?.replace(/_/g, ' ')}
                        {' '}<span style={{ color: 'var(--text-4)' }}>{log.resource_type}</span>
                      </p>
                      {log.resource_name && (
                        <p className="truncate" style={{ color: 'var(--text-4)', fontSize: 15, marginTop: 1 }}>{log.resource_name}</p>
                      )}
                    </div>
                    <span className="flex-shrink-0" style={{ color: 'var(--text-4)', fontSize: 15 }}>
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: false })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Critical tickets */}
      {!loading && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-1)', fontSize: 19, fontWeight: 600 }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
              Critical &amp; High Priority
            </span>
            <Link
              to="/tickets?status=open"
              className="flex items-center gap-1 transition-all duration-150 hover:gap-1.5"
              style={{ color: 'var(--blue-text)', fontSize: 17, fontWeight: 500 }}
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {criticalTickets.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-4)', fontSize: 17 }}>
              No critical or high priority tickets
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {criticalTickets.map((t) => {
                const isCrit = t.priority === 'critical'
                const slaBreached = t.sla_deadline && new Date(t.sla_deadline) < new Date()
                return (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="flex items-center gap-4 px-4 py-3 transition-all duration-150"
                    style={{ borderLeft: `2px solid ${isCrit ? '#ef4444' : '#f59e0b'}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium" style={{ color: 'var(--text-1)', fontSize: 18 }}>{t.title}</p>
                      <p className="mt-0.5" style={{ color: 'var(--text-4)', fontSize: 15 }}>
                        <span className="font-mono">{t.ticket_number}</span>
                        {t.client?.name && <> · {t.client.name}</>}
                        {t.category && <> · {t.category}</>}
                      </p>
                    </div>
                    <AlertBadge priority={t.priority} />
                    <StatusIndicator status={t.status} />
                    {t.sla_deadline && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md font-medium flex-shrink-0"
                        style={{
                          background: slaBreached ? 'rgba(239,68,68,0.10)' : 'var(--surface-2)',
                          color: slaBreached ? '#dc2626' : 'var(--text-4)',
                          border: `1px solid ${slaBreached ? 'rgba(239,68,68,0.22)' : 'var(--border)'}`,
                          fontSize: 15,
                        }}
                      >
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
