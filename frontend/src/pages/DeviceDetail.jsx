import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import { Skeleton } from '../components/Skeleton'
import { ArrowLeft, Terminal, RefreshCw, Database, Download, Zap, Cpu, HardDrive,
         Activity, Wifi, Square, Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDistanceToNow } from 'date-fns'

const METRIC_COLORS = {
  blue:    { bg: 'bg-blue-500/20 text-blue-400' },
  violet:  { bg: 'bg-violet-500/20 text-violet-400' },
  emerald: { bg: 'bg-emerald-500/20 text-emerald-400' },
  amber:   { bg: 'bg-amber-500/20 text-amber-400' },
}

function MetricTile({ label, value, icon: Icon, color }) {
  const c = METRIC_COLORS[color] ?? METRIC_COLORS.blue
  return (
    <div className={`rounded-xl p-4 ${c.bg}`} style={{ background: 'rgba(30,40,64,0.6)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

const POLL_INTERVAL = 10_000  // ms between traffic polls

function fmtBps(bps) {
  if (bps == null || bps < 0) return '—'
  if (bps < 1_000)       return `${bps.toFixed(0)} bps`
  if (bps < 1_000_000)   return `${(bps / 1_000).toFixed(1)} Kbps`
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`
  return `${(bps / 1_000_000_000).toFixed(2)} Gbps`
}

const IF_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16']

function SNMPMonitor({ device }) {
  const [open, setOpen]             = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [interfaces, setInterfaces] = useState([])
  const [selected, setSelected]     = useState(new Set())
  const [monitoring, setMonitoring] = useState(false)
  const [chartData, setChartData]   = useState({})   // {ifIdx: [{t, in_bps, out_bps}]}
  const [lastReading, setLastReading] = useState(null)
  const stopRef   = useRef(false)
  const timerRef  = useRef(null)

  const TTStyle = { background: '#0b0f1a', border: '1px solid #1a2540', borderRadius: 6, fontSize: 10, color: '#e2e8f0' }

  const discover = async () => {
    setDiscovering(true)
    setInterfaces([])
    setSelected(new Set())
    setChartData({})
    setLastReading(null)
    try {
      const { data } = await devicesAPI.snmpInterfaces(device.id)
      setInterfaces(data.interfaces)
      if (data.interfaces.length === 0) toast('No interfaces found via SNMP', { icon: 'ℹ️' })
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const pollOnce = async (prev) => {
    const indexes = [...selected]
    if (!indexes.length) return prev

    const { data } = await devicesAPI.snmpTraffic(device.id, { if_indexes: indexes })
    const now = new Date(data.timestamp).getTime()
    const traffic = data.traffic  // {str(idx): {in_octets, out_octets}}

    if (prev) {
      const elapsed = (now - prev.ts) / 1000
      if (elapsed > 0) {
        setChartData(old => {
          const next = { ...old }
          indexes.forEach(idx => {
            const key    = String(idx)
            const cur    = traffic[key]
            const p      = prev.traffic[key]
            if (!cur || !p || cur.in_octets == null || p.in_octets == null) return
            const in_bps  = Math.max(0, (cur.in_octets  - p.in_octets)  * 8 / elapsed)
            const out_bps = Math.max(0, (cur.out_octets - p.out_octets) * 8 / elapsed)
            const point   = { t: new Date(now).toLocaleTimeString(), in_bps, out_bps }
            const series  = [...(next[key] ?? []), point].slice(-30)
            next[key] = series
          })
          return next
        })
      }
    }

    return { ts: now, traffic }
  }

  const startMonitor = async () => {
    if (!selected.size) return toast.error('Select at least one interface')
    stopRef.current = false
    setMonitoring(true)
    setChartData({})
    setLastReading(null)

    let prev = null
    const loop = async () => {
      if (stopRef.current) { setMonitoring(false); return }
      try {
        prev = await pollOnce(prev)
        setLastReading(prev)
      } catch (err) {
        console.error('[SNMP traffic]', err.message)
      }
      if (!stopRef.current) timerRef.current = setTimeout(loop, POLL_INTERVAL)
    }
    loop()
  }

  const stopMonitor = () => {
    stopRef.current = true
    clearTimeout(timerRef.current)
    setMonitoring(false)
  }

  useEffect(() => () => { stopRef.current = true; clearTimeout(timerRef.current) }, [])

  if (!device.snmp_enabled) return null

  const selectedArr = [...selected]

  return (
    <div className="card p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-emerald-400" /> SNMP Interface Monitor
        </h2>
        <button onClick={() => setOpen(o => !o)} className="text-slate-500 hover:text-slate-300 transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {open && (
        <>
          {/* Discover + Start/Stop controls */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button onClick={discover} disabled={discovering || monitoring}
              className="btn-secondary text-xs py-1.5 px-3">
              {discovering
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Discovering…</>
                : <><RefreshCw className="w-3 h-3" /> Discover Interfaces</>}
            </button>
            {interfaces.length > 0 && !monitoring && (
              <button onClick={startMonitor} disabled={!selected.size}
                className="btn-primary text-xs py-1.5 px-3">
                <Play className="w-3 h-3" /> Start Monitoring
              </button>
            )}
            {monitoring && (
              <button onClick={stopMonitor}
                className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all">
                <Square className="w-3 h-3" /> Stop
              </button>
            )}
            {monitoring && (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-online" />
                Live — polling every {POLL_INTERVAL / 1000}s
              </span>
            )}
          </div>

          {/* Interface checklist */}
          {interfaces.length > 0 && (
            <div className="mb-5 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 w-8"></th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500">Index</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500">Name</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500">Status</th>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500">Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: 'var(--border)' }}>
                  {interfaces.map((iface) => (
                    <tr key={iface.index}
                      className="transition-colors cursor-pointer hover:bg-white/[0.02]"
                      onClick={() => !monitoring && toggleSelect(iface.index)}>
                      <td className="px-3 py-2">
                        <input type="checkbox" readOnly checked={selected.has(iface.index)}
                          disabled={monitoring}
                          className="accent-blue-500 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{iface.index}</td>
                      <td className="px-3 py-2 font-mono text-slate-200">{iface.name || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          iface.status === 'up'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>{iface.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {iface.speed_bps ? fmtBps(iface.speed_bps) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Live charts — one per selected interface */}
          {selectedArr.length > 0 && Object.keys(chartData).length > 0 && (
            <div className="space-y-4">
              {selectedArr.map((idx, ci) => {
                const key    = String(idx)
                const series = chartData[key] ?? []
                const iface  = interfaces.find(i => i.index === idx)
                const color  = IF_COLORS[ci % IF_COLORS.length]
                const lastPt = series[series.length - 1]
                return (
                  <div key={idx} className="rounded-xl p-4 border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <p className="text-xs font-mono font-semibold text-slate-200">
                          {iface?.name ?? `ifIndex ${idx}`}
                        </p>
                      </div>
                      {lastPt && (
                        <div className="flex items-center gap-4 text-[10px] font-mono">
                          <span className="text-blue-400">↓ {fmtBps(lastPt.in_bps)}</span>
                          <span className="text-emerald-400">↑ {fmtBps(lastPt.out_bps)}</span>
                        </div>
                      )}
                    </div>
                    {series.length < 2 ? (
                      <div className="h-20 flex items-center justify-center text-xs text-slate-600">
                        <Loader2 className="w-3 h-3 animate-spin mr-2" /> Collecting data…
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={series} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                          <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tickFormatter={v => fmtBps(v)} tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={false} width={54} />
                          <Tooltip formatter={(v, name) => [fmtBps(v), name === 'in_bps' ? 'In' : 'Out']} contentStyle={TTStyle} />
                          <Line type="monotone" dataKey="in_bps"  stroke="#3b82f6" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                          <Line type="monotone" dataKey="out_bps" stroke="#10b981" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {interfaces.length === 0 && !discovering && (
            <p className="text-xs text-slate-600 text-center py-6">
              Click "Discover Interfaces" to query the device via SNMP
            </p>
          )}
        </>
      )}
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
      setDevice(d); setMetrics([...m].reverse()); setBackups(b)
    } catch { navigate('/devices') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const ping = async () => {
    setPinging(true)
    try {
      const { data } = await devicesAPI.ping(id)
      toast[data.reachable ? 'success' : 'error'](data.reachable ? `Reachable — ${data.latency_ms?.toFixed(1)}ms` : 'Unreachable')
      await load()
    } catch { toast.error('Ping failed') }
    finally { setPinging(false) }
  }

  const pollSnmp = async () => {
    setSnmpPolling(true)
    try { await devicesAPI.snmp(id); toast.success('SNMP poll complete'); await load() }
    catch (err) { toast.error(err.response?.data?.detail || 'SNMP failed') }
    finally { setSnmpPolling(false) }
  }

  const triggerBackup = async () => {
    setBackingUp(true)
    try { await devicesAPI.backupConfig(id); toast.success('Backup created'); await load() }
    catch (err) { toast.error(err.response?.data?.detail || 'Backup failed') }
    finally { setBackingUp(false) }
  }

  const downloadBackup = async (backupId) => {
    try {
      const { data } = await devicesAPI.getConfigBackup(id, backupId)
      const blob = new Blob([data.config_text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${device.name}-config-${backupId.slice(0, 8)}.txt`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Download failed') }
  }

  const TTStyle = { background: '#0e1525', border: '1px solid #1a2540', borderRadius: 6, fontSize: 11, color: '#e2e8f0' }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-40 w-full" /></div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }
  if (!device) return null

  const latencyData = metrics.map((m, i) => ({ i, v: m.latency_ms }))
  const cpuData = metrics.map((m, i) => ({ i, v: m.cpu_percent }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Link to="/devices" className="p-2 text-slate-500 hover:text-slate-200 rounded-lg transition-all duration-200 mt-0.5 flex-shrink-0"
          style={{ background: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.background = '#162033'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{device.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <code className="text-sm text-slate-500 font-mono">{device.ip_address}</code>
            <StatusIndicator status={device.status} />
            <span className="text-xs text-slate-500 capitalize">{device.vendor} · {device.device_type?.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          <button onClick={ping} className="btn-secondary" disabled={pinging}><Zap className="w-4 h-4" />{pinging ? 'Pinging…' : 'Ping'}</button>
          {device.snmp_enabled && <button onClick={pollSnmp} className="btn-secondary" disabled={snmpPolling}><RefreshCw className={`w-4 h-4 ${snmpPolling ? 'animate-spin' : ''}`} />SNMP</button>}
          {device.ssh_enabled && (
            <>
              <button onClick={triggerBackup} className="btn-secondary" disabled={backingUp}><Database className="w-4 h-4" />{backingUp ? 'Backing up…' : 'Backup'}</button>
              <Link to={`/remote-access?host=${device.management_ip || device.ip_address}&user=${device.ssh_username || 'admin'}`} className="btn-primary"><Terminal className="w-4 h-4" />SSH</Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Live Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <MetricTile label="Latency" value={device.last_ping_ms != null ? `${device.last_ping_ms.toFixed(1)}ms` : '—'} icon={Activity} color="blue" />
              <MetricTile label="CPU" value={device.cpu_usage != null ? `${device.cpu_usage.toFixed(1)}%` : '—'} icon={Cpu} color="violet" />
              <MetricTile label="Memory" value={device.memory_usage != null ? `${device.memory_usage.toFixed(1)}%` : '—'} icon={HardDrive} color="emerald" />
              <MetricTile label="Disk" value={device.disk_usage != null ? `${device.disk_usage.toFixed(1)}%` : '—'} icon={Database} color="amber" />
            </div>
            {metrics.length > 1 && (
              <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid #1a2540' }}>
                <div>
                  <p className="text-xs text-slate-500 mb-2">Latency (ms) — last {metrics.length} polls</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={latencyData}>
                      <Line type="monotone" dataKey="v" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      <Tooltip formatter={(v) => [`${v?.toFixed(1)}ms`, 'Latency']} labelFormatter={() => ''} contentStyle={TTStyle} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {cpuData.some((d) => d.v != null) && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">CPU % — last {metrics.length} polls</p>
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={cpuData}>
                        <Line type="monotone" dataKey="v" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                        <Tooltip formatter={(v) => [`${v?.toFixed(1)}%`, 'CPU']} labelFormatter={() => ''} contentStyle={TTStyle} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>

          <SNMPMonitor device={device} />

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />Config Backups ({backups.length})
            </h2>
            {backups.length === 0 ? (
              <p className="text-sm text-slate-500">No backups yet. Click "Backup" to create one.</p>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#162033' }}>
                    <Database className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{new Date(b.backed_up_at).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(b.backed_up_at), { addSuffix: true })}{b.notes && ` · ${b.notes}`}</p>
                    </div>
                    <button onClick={() => downloadBackup(b.id)} className="btn-secondary text-xs py-1.5"><Download className="w-3 h-3" />Download</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <p className="label mb-3">Device Info</p>
          <dl className="space-y-2.5 text-sm">
            {[
              ['Vendor', device.vendor], ['Type', device.device_type?.replace('_', ' ')],
              ['OS', device.os_version], ['Model', device.model], ['Serial', device.serial_number],
              ['Location', device.location], ['MAC', device.mac_address],
              ['SNMP', device.snmp_enabled ? `v${device.snmp_version ?? '2c'}` : 'Disabled'],
              ['SSH', device.ssh_enabled ? `Port ${device.ssh_port}` : 'Disabled'],
              ['Last seen', device.last_seen ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true }) : 'Never'],
            ].filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-slate-500 capitalize flex-shrink-0">{k}</dt>
                <dd className="text-right text-slate-300 capitalize truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
