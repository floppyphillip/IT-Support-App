import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonCard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { Plus, Search, Activity, Cpu, HardDrive, MapPin, Zap, Server } from 'lucide-react'
import { toast } from 'react-hot-toast'

const DEVICE_ICONS = {
  router: '🔀', switch: '🔌', server: '🖥️', workstation: '💻',
  printer: '🖨️', access_point: '📡', firewall: '🛡️', nas: '💾', camera: '📷', other: '📦',
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pinging, setPinging] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await devicesAPI.list({ limit: 50, search: search || undefined })
      setDevices(data.items)
      setTotal(data.total)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  const pingDevice = async (id, e) => {
    e.preventDefault(); e.stopPropagation()
    setPinging(id)
    try {
      const { data } = await devicesAPI.ping(id)
      if (data.reachable) toast.success(`Reachable — ${data.latency_ms}ms`)
      else toast.error('Device unreachable')
      load()
    } catch { toast.error('Ping failed') }
    finally { setPinging(null) }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Devices</h1><p className="page-sub">{total} total</p></div>
        <Link to="#" className="btn-primary"><Plus className="w-4 h-4" />Add Device</Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input className="input pl-9 w-52" placeholder="Search devices…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} rows={3} />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="card">
          <EmptyState icon={Server} title="No devices found" description="Add your first device to start monitoring infrastructure." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <Link key={d.id} to={`/devices/${d.id}`} className="card p-5 hover:shadow-lg hover:bg-[#1e2840] transition-all duration-200 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: '#1e2840' }}>
                    {DEVICE_ICONS[d.device_type] ?? '📦'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-all duration-200">{d.name}</p>
                    <p className="text-xs font-mono text-slate-500">{d.ip_address}</p>
                  </div>
                </div>
                <StatusIndicator status={d.status} dot />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500 mb-4">
                {d.last_ping_ms != null && (
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-blue-400" />{d.last_ping_ms}ms</span>
                )}
                {d.cpu_usage != null && (
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-violet-400" />{d.cpu_usage.toFixed(0)}%</span>
                )}
                {d.memory_usage != null && (
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-emerald-400" />{d.memory_usage.toFixed(0)}%</span>
                )}
                {d.location && (
                  <span className="flex items-center gap-1 col-span-2 truncate"><MapPin className="w-3 h-3 text-amber-400" />{d.location}</span>
                )}
              </div>

              <button className="btn-secondary w-full justify-center text-xs py-1.5"
                onClick={(e) => pingDevice(d.id, e)} disabled={pinging === d.id}>
                <Zap className="w-3 h-3" />
                {pinging === d.id ? 'Pinging…' : 'Ping'}
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
