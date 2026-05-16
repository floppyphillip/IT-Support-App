import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import { ArrowLeft, Terminal, Activity, RefreshCw, Database, Download, Zap } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { formatDistanceToNow } from 'date-fns'

const MetricBox = ({ label, value, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className={`rounded-lg p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [device, setDevice] = useState(null)
  const [metrics, setMetrics] = useState([])
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [pinging, setPinging] = useState(false)
  const [snmpPolling, setSnmpPolling] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  const load = async () => {
    try {
      const [{ data: d }, { data: m }, { data: b }] = await Promise.all([
        devicesAPI.get(id),
        devicesAPI.getMetrics(id, { limit: 30 }),
        devicesAPI.getConfigBackups(id),
      ])
      setDevice(d)
      setMetrics([...m].reverse())
      setBackups(b)
    } catch { navigate('/devices') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const ping = async () => {
    setPinging(true)
    try {
      const { data } = await devicesAPI.ping(id)
      toast[data.reachable ? 'success' : 'error'](
        data.reachable ? `Reachable — ${data.latency_ms?.toFixed(1)}ms` : 'Device unreachable'
      )
      await load()
    } catch { toast.error('Ping failed') }
    finally { setPinging(false) }
  }

  const pollSnmp = async () => {
    setSnmpPolling(true)
    try {
      await devicesAPI.snmp(id)
      toast.success('SNMP poll complete')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'SNMP poll failed')
    } finally { setSnmpPolling(false) }
  }

  const triggerBackup = async () => {
    setBackingUp(true)
    try {
      await devicesAPI.backupConfig(id)
      toast.success('Config backup created')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Backup failed')
    } finally { setBackingUp(false) }
  }

  const downloadBackup = async (backupId) => {
    try {
      const { data } = await devicesAPI.getConfigBackup(id, backupId)
      const blob = new Blob([data.config_text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${device.name}-config-${backupId.slice(0, 8)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Download failed') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zoho-muted text-sm">Loading…</div>
      </div>
    )
  }
  if (!device) return null

  const latencyData = metrics.map((m, i) => ({ i, latency: m.latency_ms }))
  const cpuData = metrics.map((m, i) => ({ i, cpu: m.cpu_percent }))

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/devices" className="text-zoho-muted hover:text-zoho-text transition-colors mt-0.5">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{device.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <code className="text-sm text-zoho-muted">{device.ip_address}</code>
            {device.management_ip && (
              <code className="text-sm text-gray-400">mgmt: {device.management_ip}</code>
            )}
            <StatusIndicator status={device.status} />
            <span className="text-xs text-zoho-muted capitalize">
              {device.vendor} · {device.device_type?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          <button onClick={ping} className="btn-secondary" disabled={pinging}>
            <Zap className="w-4 h-4" /> {pinging ? 'Pinging…' : 'Ping'}
          </button>
          {device.snmp_enabled && (
            <button onClick={pollSnmp} className="btn-secondary" disabled={snmpPolling}>
              <RefreshCw className={`w-4 h-4 ${snmpPolling ? 'animate-spin' : ''}`} /> SNMP
            </button>
          )}
          {device.ssh_enabled && (
            <>
              <button onClick={triggerBackup} className="btn-secondary" disabled={backingUp}>
                <Database className="w-4 h-4" /> {backingUp ? 'Backing up…' : 'Backup'}
              </button>
              <Link
                to={`/remote-access?host=${device.management_ip || device.ip_address}&user=${device.ssh_username || 'admin'}`}
                className="btn-primary"
              >
                <Terminal className="w-4 h-4" /> SSH
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Live metrics */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zoho-text mb-4">Live Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <MetricBox
                label="Latency"
                value={device.last_ping_ms != null ? `${device.last_ping_ms.toFixed(1)}ms` : '—'}
                color="blue"
              />
              <MetricBox
                label="CPU"
                value={device.cpu_usage != null ? `${device.cpu_usage.toFixed(1)}%` : '—'}
                color="violet"
              />
              <MetricBox
                label="Memory"
                value={device.memory_usage != null ? `${device.memory_usage.toFixed(1)}%` : '—'}
                color="green"
              />
              <MetricBox
                label="Disk"
                value={device.disk_usage != null ? `${device.disk_usage.toFixed(1)}%` : '—'}
                color="amber"
              />
            </div>

            {metrics.length > 1 && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zoho-border">
                <div>
                  <p className="text-xs text-zoho-muted mb-2">Latency (ms) — last {metrics.length} polls</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={latencyData}>
                      <Line type="monotone" dataKey="latency" stroke="#0073EA" dot={false} strokeWidth={1.5} />
                      <Tooltip
                        formatter={(v) => [`${v?.toFixed(1)}ms`, 'Latency']}
                        labelFormatter={() => ''}
                        contentStyle={{ fontSize: 11, border: '1px solid #E8E8E8' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {cpuData.some((d) => d.cpu != null) && (
                  <div>
                    <p className="text-xs text-zoho-muted mb-2">CPU % — last {metrics.length} polls</p>
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={cpuData}>
                        <Line type="monotone" dataKey="cpu" stroke="#8b5cf6" dot={false} strokeWidth={1.5} />
                        <Tooltip
                          formatter={(v) => [`${v?.toFixed(1)}%`, 'CPU']}
                          labelFormatter={() => ''}
                          contentStyle={{ fontSize: 11, border: '1px solid #E8E8E8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Config backups */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zoho-text mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-zoho-muted" />
              Config Backups ({backups.length})
            </h2>
            {backups.length === 0 ? (
              <p className="text-sm text-zoho-muted">No backups yet. Click "Backup" to create one.</p>
            ) : (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center gap-3 p-3 rounded-lg bg-zoho-body">
                    <Database className="w-4 h-4 text-zoho-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zoho-text">
                        {new Date(backup.backed_up_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-zoho-muted">
                        {formatDistanceToNow(new Date(backup.backed_up_at), { addSuffix: true })}
                        {backup.notes && ` · ${backup.notes}`}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadBackup(backup.id)}
                      className="btn-secondary text-xs py-1.5"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="card p-4">
          <p className="label mb-3">Device Info</p>
          <dl className="space-y-2 text-sm">
            {[
              ['Vendor', device.vendor],
              ['Type', device.device_type?.replace('_', ' ')],
              ['OS', device.os_version],
              ['Model', device.model],
              ['Serial', device.serial_number],
              ['Location', device.location],
              ['MAC', device.mac_address],
              ['SNMP', device.snmp_enabled ? `Enabled (v${device.snmp_version ?? '2c'})` : 'Disabled'],
              ['SSH', device.ssh_enabled ? `Port ${device.ssh_port} (${device.ssh_username})` : 'Disabled'],
              ['Monitoring', device.monitoring_enabled ? 'Enabled' : 'Disabled'],
              ['Last seen', device.last_seen
                ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
                : 'Never'],
            ].map(([k, v]) => v != null && (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-zoho-muted flex-shrink-0 capitalize">{k}</dt>
                <dd className="text-right text-zoho-text capitalize truncate">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
