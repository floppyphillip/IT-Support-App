import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import { Skeleton } from '../components/Skeleton'
import {
  ArrowLeft, Terminal, RefreshCw, Database, Download, Zap, Cpu, HardDrive,
  Activity, Wifi, Loader2, Plus, X, BarChart2, Gauge, ArrowDown, ArrowUp,
  ChevronLeft, ChevronRight, Check, FileText, Clock,
} from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import { formatDistanceToNow } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL = 60_000
const newSid = () => `s${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// Numeric OIDs the backend polls — used as sensor data sources.
// vendors: null = standard IETF/HOST-RESOURCES MIB (all vendors); array = vendor-specific only.
const SNMP_VALUE_CATALOG = [
  // CPU
  { key: 'hrProcessorLoad',          label: 'CPU Load',             unit: '%',  cat: 'CPU',      vendors: null },
  { key: 'hrProcessorLoad_alt',      label: 'CPU Load (alt)',       unit: '%',  cat: 'CPU',      vendors: ['cisco'] },
  { key: 'jnxOperatingCPU',          label: 'CPU Utilization',      unit: '%',  cat: 'CPU',      vendors: ['juniper'] },
  { key: 'hwEntityCpuUsage',         label: 'CPU Usage',            unit: '%',  cat: 'CPU',      vendors: ['huawei'] },
  { key: 'fgSysCpuUsage',            label: 'CPU Usage',            unit: '%',  cat: 'CPU',      vendors: ['fortinet'] },
  { key: 'panSysCPULoadAverage',     label: 'CPU Load Avg',         unit: '%',  cat: 'CPU',      vendors: ['paloalto'] },
  // Memory
  { key: 'hrMemorySize',             label: 'Memory Size',          unit: 'KB', cat: 'Memory',   vendors: null },
  { key: 'jnxOperatingBuffer',       label: 'Buffer Utilization',   unit: '%',  cat: 'Memory',   vendors: ['juniper'] },
  { key: 'hwEntityMemUsage',         label: 'Memory Usage',         unit: '%',  cat: 'Memory',   vendors: ['huawei'] },
  { key: 'fgSysMemUsage',            label: 'Memory Usage',         unit: '%',  cat: 'Memory',   vendors: ['fortinet'] },
  { key: 'ciscoMemPoolUsed',         label: 'Mem Pool Used',        unit: 'B',  cat: 'Memory',   vendors: ['cisco'] },
  { key: 'ciscoMemPoolFree',         label: 'Mem Pool Free',        unit: 'B',  cat: 'Memory',   vendors: ['cisco'] },
  // Sessions
  { key: 'panSysSessionUtilization', label: 'Session Utilization',  unit: '%',  cat: 'Sessions', vendors: ['paloalto'] },
  // Storage
  { key: 'hrStorageUsed_1',          label: 'Storage Used (idx 1)', unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_2',          label: 'Storage Used (idx 2)', unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_31',         label: 'Storage Used (31)',    unit: '',   cat: 'Storage',  vendors: null },
  { key: 'hrStorageUsed_32',         label: 'Storage Used (32)',    unit: '',   cat: 'Storage',  vendors: null },
  // System
  { key: 'sysUpTime',                label: 'System Uptime',        unit: 's',  cat: 'System',   vendors: null },
  { key: 'ifNumber',                 label: 'Interface Count',      unit: '',   cat: 'System',   vendors: null },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtKbps(kbps) {
  if (kbps == null || kbps < 0) return '—'
  if (kbps < 1_000)       return `${kbps.toFixed(1)} kbit/s`
  if (kbps < 1_000_000)   return `${(kbps / 1_000).toFixed(2)} Mbit/s`
  return `${(kbps / 1_000_000).toFixed(2)} Gbit/s`
}

function fmtBps(bps) {
  if (bps == null || bps < 0) return '—'
  if (bps < 1_000)            return `${bps.toFixed(0)} bps`
  if (bps < 1_000_000)        return `${(bps / 1_000).toFixed(1)} Kbps`
  if (bps < 1_000_000_000)    return `${(bps / 1_000_000).toFixed(2)} Mbps`
  return `${(bps / 1_000_000_000).toFixed(2)} Gbps`
}

// sysUpTime is in SNMP TimeTicks (hundredths of a second)
function fmtUptime(ticks) {
  if (ticks == null) return '—'
  const totalSec = Math.floor(Number(ticks) / 100)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${String(d).padStart(2, '0')}d:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const CHART_STYLE = {
  background: '#f9fafb', border: '1px solid #e5e7eb',
  borderRadius: 6, fontSize: 15, color: '#374151',
}

// ─── MetricTile ───────────────────────────────────────────────────────────────
const METRIC_COLORS = {
  blue:    'bg-blue-500/20 text-blue-400',
  violet:  'bg-violet-500/20 text-violet-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  amber:   'bg-amber-500/20 text-amber-400',
}

function MetricTile({ label, value, icon: Icon, color }) {
  const cls = METRIC_COLORS[color] ?? METRIC_COLORS.blue
  return (
    <div className={`rounded-xl p-4 ${cls}`} style={{ background: 'rgba(243,244,246,0.9)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <p className="text-xs font-medium opacity-70">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

// ─── SparklineChart ───────────────────────────────────────────────────────────
function SparklineChart({ data, type }) {
  if (data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center">
        <span className="text-[15px] text-gray-400">Collecting data…</span>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        {type === 'bandwidth' ? (
          <>
            <Area type="monotone" dataKey="in_kbps"  stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Area type="monotone" dataKey="out_kbps" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </>
        ) : type === 'snmp' ? (
          <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
        ) : (
          <Area type="monotone" dataKey="latency_ms" stroke="#10b981" fill="#10b981" fillOpacity={0.2} dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls={false} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── SensorTile ───────────────────────────────────────────────────────────────
function SensorTile({ sensor, onOpen, onRemove }) {
  const last   = sensor.data[sensor.data.length - 1]
  const isBw   = sensor.type === 'bandwidth'
  const isSnmp = sensor.type === 'snmp'
  const latColor = !last || last.latency_ms == null ? 'text-red-400'
    : last.latency_ms > 100 ? 'text-amber-400'
    : 'text-emerald-400'

  return (
    <div
      onClick={onOpen}
      className="relative bg-white border border-gray-200 rounded-xl p-4 cursor-pointer
                 transition-all duration-150 hover:border-gray-300 hover:-translate-y-0.5
                 hover:shadow-lg hover:shadow-black/10 group"
    >
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="absolute top-3 right-3 p-1 rounded text-gray-400 hover:text-red-400
                   hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
      >
        <X size={11} />
      </button>

      {/* Header */}
      <p className="text-xs font-mono font-semibold text-gray-900 truncate pr-6 mb-1">
        {isSnmp ? sensor.label : sensor.ifName}
      </p>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded border ${
          isBw
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : isSnmp
            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {isBw ? 'Bandwidth' : isSnmp ? 'SNMP Value' : 'Latency'}
        </span>
        {sensor.ifSpeed && (
          <span className="text-[13px] text-gray-400 font-mono">{fmtBps(sensor.ifSpeed)}</span>
        )}
      </div>

      {/* Current value */}
      {isBw ? (
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <ArrowDown size={10} className="text-blue-400 flex-shrink-0" />
            <span className="text-[17px] font-mono text-blue-400 font-semibold">
              {last ? fmtKbps(last.in_kbps) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUp size={10} className="text-amber-400 flex-shrink-0" />
            <span className="text-[17px] font-mono text-amber-400 font-semibold">
              {last ? fmtKbps(last.out_kbps) : '—'}
            </span>
          </div>
        </div>
      ) : isSnmp ? (
        <div className="mb-3">
          <span className="text-xl font-bold font-mono text-violet-400">
            {last && last.value != null
              ? `${typeof last.value === 'number' ? last.value.toFixed(1) : last.value}${sensor.unit ? ' ' + sensor.unit : ''}`
              : '—'
            }
          </span>
        </div>
      ) : (
        <div className="mb-3">
          <span className={`text-xl font-bold font-mono ${latColor}`}>
            {last
              ? last.latency_ms != null ? `${last.latency_ms.toFixed(1)} ms` : 'Timeout'
              : '—'
            }
          </span>
        </div>
      )}

      {/* Sparkline */}
      <SparklineChart data={sensor.data} type={sensor.type} />

      {/* Footer */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-online flex-shrink-0" />
        <span className="text-[13px] text-gray-400">Live · every {POLL_INTERVAL / 1000}s</span>
      </div>
    </div>
  )
}

// ─── LegendItem ───────────────────────────────────────────────────────────────
function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-2 rounded-sm" style={{ background: color, opacity: 0.7 }} />
      <span className="text-[15px] text-gray-500">{label}</span>
    </div>
  )
}

// ─── Report helpers ───────────────────────────────────────────────────────────
const REPORT_PERIODS = [
  { key: 'live', label: 'Live' },
  { key: '2d',   label: '2 Days' },
  { key: '1w',   label: '1 Week' },
  { key: '1m',   label: '1 Month' },
  { key: '1y',   label: '1 Year' },
  { key: 'custom', label: 'Custom' },
]

const PERIOD_MS = { live: 2 * 3600000, '2d': 2 * 86400000, '1w': 7 * 86400000, '1m': 30 * 86400000, '1y': 365 * 86400000 }

// Used only for CSV export — returns raw data points within the period
function filterByPeriod(data, period, customFrom, customTo) {
  if (period === 'live') return data.slice(-120)
  const now = Date.now()
  return data.filter(p => {
    if (!p.ts) return false
    const t = new Date(p.ts).getTime()
    if (period === 'custom') {
      const from = customFrom ? new Date(customFrom).getTime() : 0
      const to   = customTo   ? new Date(customTo).getTime() + 86400000 : now
      return t >= from && t <= to
    }
    return t >= now - PERIOD_MS[period]
  })
}

// Builds a full time-axis for the selected period, bucketing actual data into it.
// Buckets with no data have null values so Recharts renders visible gaps.
function buildChartData(data, type, period, customFrom, customTo) {
  const isBw   = type === 'bandwidth'
  const isSnmp = type === 'snmp'
  const now = Date.now()
  let startMs, endMs

  if (period === 'custom') {
    startMs = customFrom ? new Date(customFrom).getTime() : now - 86400000
    endMs   = customTo   ? new Date(customTo).getTime() + 86400000 : now
  } else {
    endMs   = now
    startMs = now - (PERIOD_MS[period] ?? 2 * 3600000)
  }

  const rangeMs = endMs - startMs
  // Snap bucket size to a sensible interval, targeting ≤120 buckets
  const SNAPS = [60000, 5*60000, 15*60000, 30*60000, 3600000, 4*3600000, 12*3600000, 86400000, 7*86400000]
  const bucketMs = SNAPS.find(s => rangeMs / s <= 120) ?? 7 * 86400000
  const bucketCount = Math.ceil(rangeMs / bucketMs)

  const fmt = ms => {
    const d = new Date(ms)
    if (period === 'live')
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    if (period === '2d')
      return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
             d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    if (period === '1w')
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const days = rangeMs / 86400000
    if (days <= 3)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
             d.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false }) + 'h'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const acc = Array.from({ length: bucketCount }, () => ({
    sumIn: 0, sumOut: 0, sumLat: 0, sumVal: 0, cntBw: 0, cntLat: 0, cntVal: 0,
  }))

  data.forEach(pt => {
    if (!pt.ts) return
    const ptMs = new Date(pt.ts).getTime()
    if (ptMs < startMs || ptMs > endMs) return
    const idx = Math.min(Math.floor((ptMs - startMs) / bucketMs), bucketCount - 1)
    if (idx < 0) return
    if (isBw) {
      if (pt.in_kbps  != null) { acc[idx].sumIn  += pt.in_kbps;  acc[idx].cntBw++ }
      if (pt.out_kbps != null)   acc[idx].sumOut += pt.out_kbps
    } else if (isSnmp) {
      if (pt.value != null) { acc[idx].sumVal += pt.value; acc[idx].cntVal++ }
    } else {
      if (pt.latency_ms != null) { acc[idx].sumLat += pt.latency_ms; acc[idx].cntLat++ }
    }
  })

  return acc.map((a, i) => ({
    t:          fmt(startMs + i * bucketMs),
    ts:         new Date(startMs + i * bucketMs).toISOString(),
    in_kbps:    a.cntBw  > 0 ? a.sumIn  / a.cntBw  : null,
    out_kbps:   a.cntBw  > 0 ? a.sumOut / a.cntBw  : null,
    latency_ms: a.cntLat > 0 ? a.sumLat / a.cntLat : null,
    value:      a.cntVal > 0 ? a.sumVal / a.cntVal  : null,
  }))
}

function exportCSV(sensor, points) {
  const isBw   = sensor.type === 'bandwidth'
  const isSnmp = sensor.type === 'snmp'
  const header = isBw
    ? 'Timestamp,Traffic In (kbit/s),Traffic Out (kbit/s)'
    : isSnmp
    ? `Timestamp,${sensor.label}${sensor.unit ? ' (' + sensor.unit + ')' : ''}`
    : 'Timestamp,RTT (ms)'
  const rows = points.map(p =>
    isBw
      ? `${p.ts ?? p.t},${p.in_kbps  != null ? p.in_kbps.toFixed(2)  : ''},${p.out_kbps != null ? p.out_kbps.toFixed(2) : ''}`
      : isSnmp
      ? `${p.ts ?? p.t},${p.value != null ? (typeof p.value === 'number' ? p.value.toFixed(2) : p.value) : ''}`
      : `${p.ts ?? p.t},${p.latency_ms != null ? p.latency_ms.toFixed(1) : 'Timeout'}`
  )
  const name = isSnmp ? (sensor.label ?? sensor.oidKey) : sensor.ifName
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_${sensor.type}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── FullSensorModal ──────────────────────────────────────────────────────────
function FullSensorModal({ sensor, onClose }) {
  const isBw   = sensor?.type === 'bandwidth'
  const isSnmp = sensor?.type === 'snmp'

  const [period, setPeriod]           = useState('live')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const [displayData, setDisplayData] = useState(() =>
    sensor ? buildChartData(sensor.data, sensor.type, 'live', '', '') : []
  )

  useEffect(() => {
    if (sensor) setDisplayData(buildChartData(sensor.data, sensor.type, period, customFrom, customTo))
  }, [sensor?.data, sensor?.type, period, customFrom, customTo])

  if (!sensor) return null

  let maxVal = null, minVal = null
  displayData.forEach(pt => {
    const v = isBw ? (pt.in_kbps ?? 0) + (pt.out_kbps ?? 0)
            : isSnmp ? pt.value
            : pt.latency_ms
    if (v == null) return
    if (maxVal === null || v > maxVal) maxVal = v
    if (minVal === null || v < minVal) minVal = v
  })

  const fmtVal = v =>
    v == null ? '—'
    : isBw ? fmtKbps(v)
    : isSnmp ? `${typeof v === 'number' ? v.toFixed(2) : v}${sensor.unit ? ' ' + sensor.unit : ''}`
    : `${v.toFixed(1)} ms`

  const title = isSnmp
    ? sensor.label
    : `${sensor.ifName}${sensor.ifSpeed ? ` · ${fmtBps(sensor.ifSpeed)}` : ''}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200"
          style={{ background: 'linear-gradient(135deg,#ffffff 0%,#f9fafb 100%)' }}
        >
          <div className="flex items-center gap-3">
            {isBw
              ? <BarChart2 size={15} className="text-blue-400 flex-shrink-0" />
              : isSnmp
              ? <Activity  size={15} className="text-violet-400 flex-shrink-0" />
              : <Gauge     size={15} className="text-emerald-400 flex-shrink-0" />
            }
            <div>
              <p className="text-sm font-bold text-gray-900 font-mono leading-tight">{title}</p>
              <p className="text-[15px] text-gray-400 mt-0.5">
                {isBw ? 'Bandwidth Utilization' : isSnmp ? `SNMP Value · ${sensor.oidKey}` : 'Ping Latency (RTT)'}
                {' · '}{displayData.length} samples shown · {sensor.data.length} total
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 flex-wrap" style={{ background: '#f9fafb' }}>
          {REPORT_PERIODS.map(rp => (
            <button
              key={rp.key}
              onClick={() => setPeriod(rp.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                period === rp.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {rp.key === 'live' && (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${period === 'live' ? 'bg-white status-online' : 'bg-emerald-400'}`} />
              )}
              {rp.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-500/50 transition-colors"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="px-5 pt-5 pb-4" style={{ background: '#f9fafb' }}>
          {(() => {
            const hasData = displayData.some(p =>
              isBw ? p.in_kbps != null : isSnmp ? p.value != null : p.latency_ms != null
            )
            return !hasData ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                {sensor.data.length < 2 ? (
                  <>
                    <Loader2 size={24} className="animate-spin mb-3 text-gray-400" />
                    <p className="text-sm">Collecting data… ({sensor.data.length} sample{sensor.data.length !== 1 ? 's' : ''})</p>
                    <p className="text-xs text-gray-400 mt-1">First reading arrives in ~{POLL_INTERVAL / 1000}s</p>
                  </>
                ) : (
                  <>
                    <FileText size={28} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium text-gray-500">No data for this period</p>
                    <p className="text-xs text-gray-400 mt-1">Try a wider time range or select Custom</p>
                  </>
                )}
              </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={displayData} margin={{ top: 20, right: 100, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gLat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gSnmp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 13, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={v =>
                      isBw
                        ? v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} Gb/s`
                          : v >= 1_000 ? `${(v / 1_000).toFixed(1)} Mb/s`
                          : `${v.toFixed(0)} kb/s`
                        : isSnmp
                        ? `${typeof v === 'number' ? v.toFixed(1) : v}${sensor.unit ? ' ' + sensor.unit : ''}`
                        : `${v} ms`
                    }
                    tick={{ fontSize: 13, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    formatter={(v, name) => {
                      if (isBw)   return [fmtKbps(v), name === 'in_kbps' ? 'Traffic In' : 'Traffic Out']
                      if (isSnmp) return [v != null ? `${typeof v === 'number' ? v.toFixed(2) : v}${sensor.unit ? ' ' + sensor.unit : ''}` : '—', sensor.label]
                      return [v != null ? `${v.toFixed(1)} ms` : 'Timeout', 'RTT']
                    }}
                    labelStyle={{ color: '#6b7280', fontSize: 15 }}
                    contentStyle={CHART_STYLE}
                  />
                  {maxVal != null && (
                    <ReferenceLine
                      y={maxVal}
                      stroke="rgba(0,0,0,0.20)"
                      strokeDasharray="4 3"
                      label={{ value: `Max: ${fmtVal(maxVal)}`, position: 'right', fontSize: 13, fill: '#6b7280' }}
                    />
                  )}
                  {minVal != null && minVal !== maxVal && (
                    <ReferenceLine
                      y={minVal}
                      stroke="rgba(0,0,0,0.12)"
                      strokeDasharray="4 3"
                      label={{ value: `Min: ${fmtVal(minVal)}`, position: 'right', fontSize: 13, fill: '#9ca3af' }}
                    />
                  )}
                  {isBw ? (
                    <>
                      <Area type="monotone" dataKey="in_kbps"  name="in_kbps"  stroke="#3b82f6" fill="url(#gIn)"  dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                      <Area type="monotone" dataKey="out_kbps" name="out_kbps" stroke="#f59e0b" fill="url(#gOut)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                    </>
                  ) : isSnmp ? (
                    <Area type="monotone" dataKey="value" name="value" stroke="#8b5cf6" fill="url(#gSnmp)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                  ) : (
                    <Area type="monotone" dataKey="latency_ms" name="latency_ms" stroke="#10b981" fill="url(#gLat)" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>

              {/* Legend + export */}
              <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100">
                {isBw ? (
                  <>
                    <LegendItem color="#3b82f6" label="Traffic In (kbit/s)" />
                    <LegendItem color="#f59e0b" label="Traffic Out (kbit/s)" />
                  </>
                ) : isSnmp ? (
                  <LegendItem color="#8b5cf6" label={`${sensor.label}${sensor.unit ? ' (' + sensor.unit + ')' : ''}`} />
                ) : (
                  <LegendItem color="#10b981" label="RTT (ms)" />
                )}
                <div className="ml-auto flex items-center gap-4">
                  <div className="flex items-center gap-4 text-[15px] font-mono text-gray-400">
                    {maxVal != null && <span>Max: <span className="text-gray-500">{fmtVal(maxVal)}</span></span>}
                    {minVal != null && <span>Min: <span className="text-gray-500">{fmtVal(minVal)}</span></span>}
                  </div>
                  <button
                    onClick={() => exportCSV(sensor, displayData)}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                  >
                    <Download size={12} /> Export CSV
                  </button>
                </div>
              </div>
            </>
          )})()}
        </div>
      </div>
    </div>
  )
}

// ─── SensorWizard ─────────────────────────────────────────────────────────────
function SensorWizard({ open, onClose, onAdd, deviceId, deviceIp, cachedInterfaces, setCachedInterfaces, device }) {
  const [step, setStep]               = useState(1)
  const [type, setType]               = useState(null)
  const [selected, setSelected]       = useState(new Set())
  const [discovering, setDiscovering] = useState(false)
  const [oidSearch, setOidSearch]     = useState('')

  useEffect(() => {
    if (open) { setStep(1); setType(null); setSelected(new Set()); setOidSearch('') }
  }, [open])

  const selectType = t => { setType(t); setSelected(new Set()) }

  const discover = async () => {
    setDiscovering(true)
    setCachedInterfaces([])
    setSelected(new Set())
    try {
      const { data } = await devicesAPI.snmpInterfaces(deviceId)
      setCachedInterfaces(data.interfaces)
      if (!data.interfaces.length) toast('No interfaces found via SNMP', { icon: 'ℹ️' })
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  const toggleSelect = idx =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })

  const handleNext = async () => {
    if (step === 1) {
      if (type === 'latency') {
        setStep(3)
      } else if (type === 'snmp') {
        setStep(2)
      } else {
        setStep(2)
        if (!cachedInterfaces.length && !discovering) discover()
      }
    } else if (step === 2) {
      if (!selected.size) return toast.error(`Select at least one ${type === 'snmp' ? 'OID' : 'interface'}`)
      setStep(3)
    }
  }

  const handleAdd = () => {
    if (type === 'latency') {
      onAdd([{ id: newSid(), type: 'latency', ifIndex: null, ifName: deviceIp || 'Device', ifSpeed: null, data: [] }])
    } else if (type === 'snmp') {
      const sensors = [...selected].map(oidKey => {
        const entry = SNMP_VALUE_CATALOG.find(e => e.key === oidKey)
        return {
          id: newSid(),
          type: 'snmp',
          oidKey,
          label: entry?.label ?? oidKey,
          unit:  entry?.unit  ?? '',
          ifName: entry?.label ?? oidKey,
          ifIndex: null,
          ifSpeed: null,
          data: [],
        }
      })
      onAdd(sensors)
    } else {
      const sensors = [...selected].map(ifIndex => {
        const iface = cachedInterfaces.find(i => i.index === ifIndex)
        return {
          id: newSid(),
          type,
          ifIndex,
          ifName: iface?.name ?? `ifIndex ${ifIndex}`,
          ifSpeed: iface?.speed_bps ?? null,
          data: [],
        }
      })
      onAdd(sensors)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Add New Sensor</h2>
            <p className="text-[15px] text-gray-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1.5 px-5 pt-4">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1 rounded-full flex-1 transition-all duration-300 ${n <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="p-5">

          {/* Step 1 — choose type */}
          {step === 1 && (
            <div>
              <p className="text-xs text-gray-500 mb-4">What would you like to monitor?</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    key: 'bandwidth',
                    icon: BarChart2,
                    label: 'Bandwidth',
                    desc: 'SNMP interface traffic. Shows in/out kbit/s.',
                    activeColor: 'border-blue-500/40 bg-blue-500/[0.07]',
                    iconBg: 'bg-blue-500/20',
                    iconCls: 'text-blue-400',
                    checkCls: 'text-blue-400',
                  },
                  {
                    key: 'latency',
                    icon: Gauge,
                    label: 'Ping Latency',
                    desc: 'ICMP ping RTT to this device in ms.',
                    activeColor: 'border-emerald-500/40 bg-emerald-500/[0.07]',
                    iconBg: 'bg-emerald-500/20',
                    iconCls: 'text-emerald-400',
                    checkCls: 'text-emerald-400',
                  },
                  {
                    key: 'snmp',
                    icon: Activity,
                    label: 'SNMP Value',
                    desc: 'Any numeric OID — CPU, memory, sessions.',
                    activeColor: 'border-violet-500/40 bg-violet-500/[0.07]',
                    iconBg: 'bg-violet-500/20',
                    iconCls: 'text-violet-400',
                    checkCls: 'text-violet-400',
                  },
                ].map(opt => {
                  const active = type === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => selectType(opt.key)}
                      className={`flex flex-col items-start gap-3 p-4 rounded-xl border transition-all duration-150 text-left ${
                        active ? opt.activeColor : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${active ? opt.iconBg : 'bg-gray-100'}`}>
                        <opt.icon size={18} className={active ? opt.iconCls : 'text-gray-400'} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-[13px] text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                      </div>
                      {active && <Check size={13} className={`self-end ${opt.checkCls}`} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2 — OID picker (snmp type) */}
          {step === 2 && type === 'snmp' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Select OIDs to monitor as live sensors
                {device?.vendor && (
                  <span className="ml-1.5 text-gray-400">
                    · showing OIDs supported by <span className="font-semibold capitalize">{device.vendor}</span>
                  </span>
                )}
              </p>
              <input
                type="text"
                placeholder="Search by name or key…"
                value={oidSearch}
                onChange={e => setOidSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 outline-none focus:border-violet-500/50 transition-colors mb-3"
              />
              <div style={{ maxHeight: 300, overflowY: 'auto' }} className="space-y-3 pr-0.5">
                {['CPU', 'Memory', 'Sessions', 'Storage', 'System'].map(cat => {
                  const vendorKey = (device?.vendor ?? '').toLowerCase()
                  const items = SNMP_VALUE_CATALOG.filter(e =>
                    e.cat === cat &&
                    (!e.vendors || e.vendors.includes(vendorKey)) && (
                      !oidSearch ||
                      e.label.toLowerCase().includes(oidSearch.toLowerCase()) ||
                      e.key.toLowerCase().includes(oidSearch.toLowerCase())
                    )
                  )
                  if (!items.length) return null
                  return (
                    <div key={cat}>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{cat}</p>
                      <div className="rounded-xl overflow-hidden border border-gray-200">
                        {items.map((entry, idx) => {
                          const isSel  = selected.has(entry.key)
                          const rawVal = device?.extra_data?.[entry.key]
                          const numVal = rawVal != null ? parseFloat(rawVal) : null
                          return (
                            <div
                              key={entry.key}
                              onClick={() => toggleSelect(entry.key)}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                idx < items.length - 1 ? 'border-b border-gray-100' : ''
                              } ${isSel ? 'bg-violet-500/[0.06]' : 'hover:bg-gray-50'}`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0 ${isSel ? 'bg-violet-500 border-violet-500' : 'border-gray-300'}`}>
                                {isSel && <Check size={10} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900">{entry.label}</p>
                                <p className="text-[11px] font-mono text-gray-400 truncate">{entry.key}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {numVal != null ? (
                                  <>
                                    <p className="text-xs font-mono font-semibold text-violet-400">
                                      {numVal.toFixed(1)}{entry.unit ? ' ' + entry.unit : ''}
                                    </p>
                                    <p className="text-[11px] text-gray-400">last poll</p>
                                  </>
                                ) : (
                                  <p className="text-[11px] text-gray-400">no data yet</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              {selected.size > 0 && (
                <p className="text-[13px] text-gray-400 mt-3">
                  {selected.size} OID{selected.size !== 1 ? 's' : ''} selected → {selected.size} sensor{selected.size !== 1 ? 's' : ''} will be created
                </p>
              )}
            </div>
          )}

          {/* Step 2 — select interfaces (bandwidth / latency) */}
          {step === 2 && type !== 'snmp' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">
                  {type === 'latency'
                    ? 'Select label interfaces (sensor pings device IP)'
                    : 'Select interfaces to monitor'}
                </p>
                <button
                  onClick={discover}
                  disabled={discovering}
                  className="flex items-center gap-1.5 text-[15px] text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40"
                >
                  {discovering ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {discovering ? 'Discovering…' : 'Re-discover'}
                </button>
              </div>

              {type === 'latency' && deviceIp && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3 bg-emerald-500/[0.05] border border-emerald-500/20">
                  <Gauge size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[15px] text-emerald-300/70 leading-relaxed">
                    RTT is measured by pinging <code className="font-mono">{deviceIp}</code>. Interface names below are used as sensor labels only.
                  </p>
                </div>
              )}

              {discovering && !cachedInterfaces.length ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
                </div>
              ) : cachedInterfaces.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Wifi size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No interfaces discovered yet</p>
                  <button onClick={discover} className="text-xs text-blue-400 hover:underline mt-2 block mx-auto">Discover now</button>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: '#f9fafb' }}>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 w-8" />
                        <th className="text-left px-3 py-2 text-[13px] uppercase tracking-wider text-gray-400">Idx</th>
                        <th className="text-left px-3 py-2 text-[13px] uppercase tracking-wider text-gray-400">Name</th>
                        <th className="text-left px-3 py-2 text-[13px] uppercase tracking-wider text-gray-400">Status</th>
                        <th className="text-left px-3 py-2 text-[13px] uppercase tracking-wider text-gray-400">Speed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cachedInterfaces.map(iface => {
                        const isSelected = selected.has(iface.index)
                        return (
                          <tr
                            key={iface.index}
                            onClick={() => toggleSelect(iface.index)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/[0.06]' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-3 py-2.5">
                              <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-gray-500">{iface.index}</td>
                            <td className="px-3 py-2.5 font-mono text-gray-900">{iface.name || '—'}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded-full ${
                                iface.status === 'up'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}>{iface.status}</span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-gray-400 text-[15px]">
                              {iface.speed_bps ? fmtBps(iface.speed_bps) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {selected.size > 0 && (
                <p className="text-[15px] text-gray-400 mt-2">
                  {selected.size} interface{selected.size !== 1 ? 's' : ''} selected → {selected.size} sensor{selected.size !== 1 ? 's' : ''} will be created
                </p>
              )}
            </div>
          )}

          {/* Step 3 — review */}
          {step === 3 && (
            <div>
              <p className="text-xs text-gray-500 mb-4">
                {type === 'latency'
                  ? 'Adding 1 Ping Latency sensor:'
                  : type === 'snmp'
                  ? <>Adding <span className="text-gray-900 font-semibold">{selected.size}</span>{' '}SNMP Value sensor{selected.size !== 1 ? 's' : ''}:</>
                  : <>Adding <span className="text-gray-900 font-semibold">{selected.size}</span>{' '}Bandwidth sensor{selected.size !== 1 ? 's' : ''}:</>
                }
              </p>
              <div className="space-y-2 mb-4" style={{ maxHeight: 240, overflowY: 'auto' }}>
                {type === 'latency' ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="p-1.5 rounded flex-shrink-0 bg-emerald-500/20">
                      <Gauge size={12} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold text-gray-900 truncate">{deviceIp}</p>
                      <p className="text-[15px] text-gray-400">ICMP ping · RTT in ms</p>
                    </div>
                  </div>
                ) : type === 'snmp' ? (
                  [...selected].map(oidKey => {
                    const entry = SNMP_VALUE_CATALOG.find(e => e.key === oidKey)
                    return (
                      <div key={oidKey} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="p-1.5 rounded flex-shrink-0 bg-violet-500/20">
                          <Activity size={12} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-gray-900 truncate">{entry?.label ?? oidKey}</p>
                          <p className="text-[13px] text-gray-400 font-mono truncate">{oidKey}{entry?.unit ? ` · ${entry.unit}` : ''}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  [...selected].map(ifIndex => {
                    const iface = cachedInterfaces.find(i => i.index === ifIndex)
                    return (
                      <div key={ifIndex} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="p-1.5 rounded flex-shrink-0 bg-blue-500/20">
                          <BarChart2 size={12} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-gray-900 truncate">
                            {iface?.name ?? `ifIndex ${ifIndex}`}
                          </p>
                          <p className="text-[15px] text-gray-400">
                            ifIndex {ifIndex}{iface?.speed_bps ? ` · ${fmtBps(iface.speed_bps)}` : ''}
                          </p>
                        </div>
                        <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          iface?.status === 'up'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>{iface?.status ?? '—'}</span>
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-[15px] text-gray-400">
                Sensor{type === 'latency' ? '' : selected.size !== 1 ? 's' : ''} begin polling immediately. First data point arrives in ~{POLL_INTERVAL / 1000}s.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
          <button
            onClick={step === 1 ? onClose : () => setStep(type === 'latency' && step === 3 ? 1 : s => s - 1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {step > 1 && <ChevronLeft size={14} />}
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && !type}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Sensor{selected.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SNMPMonitor ──────────────────────────────────────────────────────────────
const SENSOR_STORAGE_KEY = id => `netsupportai-sensors-${id}`

function loadPersistedSensors(deviceId) {
  try {
    const raw = localStorage.getItem(SENSOR_STORAGE_KEY(deviceId))
    if (!raw) return []
    const seen = new Set()
    const now  = Date.now()
    return JSON.parse(raw)
      .map(s => {
        const data = (s.data ?? []).map((pt, i, arr) => {
          if (pt.ts) return pt
          // Reconstruct approximate timestamp for old data without ts
          const msAgo = (arr.length - 1 - i) * POLL_INTERVAL
          return { ...pt, ts: new Date(now - msAgo).toISOString() }
        })
        return { ...s, data }
      })
      .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
  } catch { return [] }
}

function persistSensors(deviceId, sensors) {
  localStorage.setItem(SENSOR_STORAGE_KEY(deviceId), JSON.stringify(sensors))
}

function SNMPMonitor({ device }) {
  const [sensors, setSensors]               = useState(() => loadPersistedSensors(device.id))
  const [wizardOpen, setWizardOpen]         = useState(false)
  const [fullViewId, setFullViewId]         = useState(null)
  const [cachedInterfaces, setCachedInterfaces] = useState([])

  const stopRef    = useRef(false)
  const timerRef   = useRef(null)
  const prevBwRef  = useRef(null)
  const sensorsRef = useRef(sensors)
  useEffect(() => {
    sensorsRef.current = sensors
    persistSensors(device.id, sensors)
  }, [sensors])

  const isPolling = sensors.length > 0

  const pollAll = async () => {
    const cur = sensorsRef.current
    const ts  = new Date().toISOString()
    const t   = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const bwSensors   = cur.filter(s => s.type === 'bandwidth')
    const latSensors  = cur.filter(s => s.type === 'latency')
    const snmpSensors = cur.filter(s => s.type === 'snmp')

    if (bwSensors.length) {
      try {
        const { data } = await devicesAPI.snmpTraffic(device.id, { if_indexes: bwSensors.map(s => s.ifIndex) })
        const now     = new Date(data.timestamp).getTime()
        const traffic = data.traffic
        const prev    = prevBwRef.current
        if (prev) {
          const elapsed = (now - prev.ts) / 1000
          if (elapsed > 0) {
            setSensors(old => old.map(sensor => {
              if (sensor.type !== 'bandwidth') return sensor
              const key = String(sensor.ifIndex)
              const c = traffic[key], p = prev.traffic[key]
              if (!c || !p || c.in_octets == null || p.in_octets == null) return sensor
              const in_kbps  = Math.max(0, (c.in_octets  - p.in_octets)  * 8 / elapsed / 1000)
              const out_kbps = Math.max(0, (c.out_octets - p.out_octets) * 8 / elapsed / 1000)
              return { ...sensor, data: [...sensor.data, { t, ts, in_kbps, out_kbps }].slice(-10080) }
            }))
          }
        }
        prevBwRef.current = { ts: now, traffic }
      } catch (err) { console.error('[BW]', err.message) }
    }

    if (latSensors.length) {
      try {
        const { data }   = await devicesAPI.ping(device.id)
        const latency_ms = data.reachable && data.latency_ms != null ? data.latency_ms : null
        setSensors(old => old.map(sensor => {
          if (sensor.type !== 'latency') return sensor
          return { ...sensor, data: [...sensor.data, { t, ts, latency_ms }].slice(-10080) }
        }))
      } catch (err) { console.error('[Latency]', err.message) }
    }

    if (snmpSensors.length) {
      try {
        // Read the device's last-polled extra_data rather than triggering a new
        // SNMP scan — avoids any risk of overwriting snmp_oids on the backend.
        const { data: deviceData } = await devicesAPI.get(device.id)
        const extraData = deviceData.extra_data ?? {}
        setSensors(old => old.map(sensor => {
          if (sensor.type !== 'snmp') return sensor
          const raw   = extraData[sensor.oidKey]
          const value = raw != null ? parseFloat(raw) : null
          return { ...sensor, data: [...sensor.data, { t, ts, value }].slice(-10080) }
        }))
      } catch (err) { console.error('[SNMP]', err.message) }
    }
  }

  useEffect(() => {
    if (!isPolling) {
      stopRef.current = true
      clearTimeout(timerRef.current)
      return
    }
    stopRef.current = false
    const loop = async () => {
      if (stopRef.current) return
      await pollAll()
      if (!stopRef.current) timerRef.current = setTimeout(loop, POLL_INTERVAL)
    }
    loop()
    return () => { stopRef.current = true; clearTimeout(timerRef.current) }
  }, [isPolling, device.id])

  useEffect(() => () => { stopRef.current = true; clearTimeout(timerRef.current) }, [])

  if (!device.snmp_enabled) return null

  const fullViewSensor = sensors.find(s => s.id === fullViewId) ?? null

  return (
    <>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" /> SNMP Sensors
            </h2>
            {sensors.length > 0 && (
              <p className="text-[15px] text-gray-400 mt-0.5">
                {sensors.length} active · click any tile to view full graph
              </p>
            )}
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Sensor
          </button>
        </div>

        {sensors.length === 0 ? (
          <div className="text-center py-12">
            <BarChart2 size={36} className="mx-auto mb-3 text-gray-400 opacity-40" />
            <p className="text-sm font-medium text-gray-500">No sensors configured</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Add a sensor to start live monitoring</p>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={12} /> Add your first sensor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sensors.map(sensor => (
              <SensorTile
                key={sensor.id}
                sensor={sensor}
                onOpen={() => setFullViewId(sensor.id)}
                onRemove={() => {
                  setSensors(prev => prev.filter(s => s.id !== sensor.id))
                  if (fullViewId === sensor.id) setFullViewId(null)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <SensorWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onAdd={newSensors => setSensors(prev => [...prev, ...newSensors])}
        deviceId={device.id}
        deviceIp={device.ip_address}
        cachedInterfaces={cachedInterfaces}
        setCachedInterfaces={setCachedInterfaces}
        device={device}
      />

      {fullViewSensor && (
        <FullSensorModal key={fullViewSensor.id} sensor={fullViewSensor} onClose={() => setFullViewId(null)} />
      )}
    </>
  )
}

// ─── DeviceDetail ─────────────────────────────────────────────────────────────
export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const backPath = pathname.startsWith('/customer-devices') ? '/customer-devices' : '/devices'
  const [device, setDevice]   = useState(null)
  const [metrics, setMetrics] = useState([])
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [pinging, setPinging]       = useState(false)
  const [snmpPolling, setSnmpPolling] = useState(false)
  const [backingUp, setBackingUp]   = useState(false)

  const load = async () => {
    try {
      const [{ data: d }, { data: m }, { data: b }] = await Promise.all([
        devicesAPI.get(id),
        devicesAPI.getMetrics(id, { limit: 30 }),
        devicesAPI.getConfigBackups(id),
      ])
      setDevice(d); setMetrics([...m].reverse()); setBackups(b)
    } catch { navigate(backPath) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const ping = async () => {
    setPinging(true)
    try {
      const { data } = await devicesAPI.ping(id)
      toast[data.reachable ? 'success' : 'error'](
        data.reachable ? `Reachable — ${data.latency_ms?.toFixed(1)}ms` : 'Unreachable'
      )
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
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${device.name}-config-${backupId.slice(0, 8)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Download failed') }
  }

  const TTStyle = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 17, color: '#374151' }

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }
  if (!device) return null

  const latencyData = metrics.map((m, i) => ({ i, v: m.latency_ms }))
  const cpuData     = metrics.map((m, i) => ({ i, v: m.cpu_percent }))

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Link
          to={backPath}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg transition-all duration-200 mt-0.5 flex-shrink-0"
          style={{ background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{device.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <code className="text-sm text-gray-400 font-mono">{device.ip_address}</code>
            <StatusIndicator status={device.status} />
            <span className="text-xs text-gray-400 capitalize">{device.vendor} · {device.device_type?.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap flex-shrink-0">
          <button onClick={ping} className="btn-secondary" disabled={pinging}>
            <Zap className="w-4 h-4" />{pinging ? 'Pinging…' : 'Ping'}
          </button>
          {device.snmp_enabled && (
            <button onClick={pollSnmp} className="btn-secondary" disabled={snmpPolling}>
              <RefreshCw className={`w-4 h-4 ${snmpPolling ? 'animate-spin' : ''}`} />SNMP
            </button>
          )}
          <button onClick={triggerBackup} className="btn-secondary" disabled={backingUp}>
            <Database className="w-4 h-4" />{backingUp ? 'Backing up…' : 'Config Backup'}
          </button>
          {device.ssh_enabled && (
            <Link
              to={`/remote-access?host=${device.management_ip || device.ip_address}&user=${device.ssh_username || 'admin'}`}
              className="btn-primary"
            >
              <Terminal className="w-4 h-4" />SSH
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Live Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <MetricTile label="Latency" value={device.last_ping_ms != null ? `${device.last_ping_ms.toFixed(1)}ms` : '—'} icon={Activity} color="blue" />
              <MetricTile label="CPU"     value={device.cpu_usage    != null ? `${device.cpu_usage.toFixed(1)}%`    : '—'} icon={Cpu}      color="violet" />
              <MetricTile label="Memory"  value={device.memory_usage != null ? `${device.memory_usage.toFixed(1)}%` : '—'} icon={HardDrive} color="emerald" />
              <MetricTile label="Uptime"  value={fmtUptime(device.extra_data?.sysUpTime)} icon={Clock} color="amber" />
            </div>
            {metrics.length > 1 && (
              <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Latency (ms) — last {metrics.length} polls</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={latencyData}>
                      <Line type="monotone" dataKey="v" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      <Tooltip formatter={v => [`${v?.toFixed(1)}ms`, 'Latency']} labelFormatter={() => ''} contentStyle={TTStyle} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {cpuData.some(d => d.v != null) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">CPU % — last {metrics.length} polls</p>
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={cpuData}>
                        <Line type="monotone" dataKey="v" stroke="#8b5cf6" dot={false} strokeWidth={2} />
                        <Tooltip formatter={v => [`${v?.toFixed(1)}%`, 'CPU']} labelFormatter={() => ''} contentStyle={TTStyle} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>

          <SNMPMonitor device={device} />

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" />Config Backups ({backups.length})
            </h2>
            {backups.length === 0 ? (
              <p className="text-sm text-gray-400">No backups yet. Click "Backup" to create one.</p>
            ) : (
              <div className="space-y-2">
                {backups.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f3f4f6' }}>
                    <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{new Date(b.backed_up_at).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(b.backed_up_at), { addSuffix: true })}
                        {b.notes && ` · ${b.notes}`}
                      </p>
                    </div>
                    <button onClick={() => downloadBackup(b.id)} className="btn-secondary text-xs py-1.5">
                      <Download className="w-3 h-3" />Download
                    </button>
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
              ['Vendor',   device.vendor],
              ['Type',     device.device_type?.replace('_', ' ')],
              ['OS',       device.os_version],
              ['Model',    device.model],
              ['Serial',   device.serial_number],
              ['Location', device.location],
              ['MAC',      device.mac_address],
              ['SNMP',     device.snmp_enabled ? `v${device.snmp_version ?? '2c'}` : 'Disabled'],
              ['SSH',      device.ssh_enabled  ? `Port ${device.ssh_port}`          : 'Disabled'],
              ['Last seen', device.last_seen
                ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })
                : 'Never'],
            ].filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-gray-400 capitalize flex-shrink-0">{k}</dt>
                <dd className="text-right text-gray-700 capitalize truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
