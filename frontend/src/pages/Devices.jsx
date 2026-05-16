import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import StatusIndicator from '../components/StatusIndicator'
import { Plus, Search, Activity, Cpu, MemoryStick, MapPin, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'

const DEVICE_ICONS = {
  router: '🔀', switch: '🔌', server: '🖥️', workstation: '💻',
  printer: '🖨️', access_point: '📡', firewall: '🛡️', nas: '💾',
  camera: '📷', other: '📦',
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
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search])

  const pingDevice = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    setPinging(id)
    try {
      const { data } = await devicesAPI.ping(id)
      if (data.reachable) {
        toast.success(`Reachable — ${data.latency_ms}ms`)
      } else {
        toast.error('Device unreachable')
      }
      load()
    } catch { toast.error('Ping failed') }
    finally { setPinging(null) }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Devices</h1>
          <p className="page-sub">{total} total</p>
        </div>
        <Link to="#" className="btn-primary">
          <Plus className="w-4 h-4" /> Add Device
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted" />
        <input
          className="input pl-9 w-56 text-sm"
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-zoho-muted text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <Link key={d.id} to={`/devices/${d.id}`} className="card p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zoho-body flex items-center justify-center text-xl flex-shrink-0">
                    {DEVICE_ICONS[d.device_type] ?? '📦'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zoho-text group-hover:text-brand-500 transition-colors">{d.name}</p>
                    <p className="text-xs font-mono text-zoho-muted">{d.ip_address}</p>
                  </div>
                </div>
                <StatusIndicator status={d.status} dot />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zoho-muted mb-3">
                {d.last_ping_ms != null && (
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 flex-shrink-0" /> {d.last_ping_ms}ms
                  </span>
                )}
                {d.cpu_usage != null && (
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 flex-shrink-0" /> {d.cpu_usage.toFixed(0)}%
                  </span>
                )}
                {d.memory_usage != null && (
                  <span className="flex items-center gap-1">
                    <MemoryStick className="w-3 h-3 flex-shrink-0" /> {d.memory_usage.toFixed(0)}%
                  </span>
                )}
                {d.location && (
                  <span className="flex items-center gap-1 col-span-2 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {d.location}
                  </span>
                )}
              </div>

              <button
                className="btn-secondary text-xs py-1.5 w-full justify-center"
                onClick={(e) => pingDevice(d.id, e)}
                disabled={pinging === d.id}
              >
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
