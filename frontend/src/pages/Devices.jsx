import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import StatusIndicator from '../components/StatusIndicator'
import { Plus, Search, Server, Wifi, WifiOff, Activity } from 'lucide-react'
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <Link to="#" className="btn-primary"><Plus className="w-4 h-4" /> Add Device</Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9 w-64" placeholder="Search devices…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <Link
              key={d.id}
              to={`/devices/${d.id}`}
              className="card p-5 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{DEVICE_ICONS[d.device_type] ?? '📦'}</span>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-brand-600 transition">{d.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{d.ip_address}</p>
                  </div>
                </div>
                <StatusIndicator status={d.status} dot />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                {d.last_ping_ms != null && (
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {d.last_ping_ms}ms
                  </span>
                )}
                {d.cpu_usage != null && <span>CPU {d.cpu_usage?.toFixed(0)}%</span>}
                {d.memory_usage != null && <span>MEM {d.memory_usage?.toFixed(0)}%</span>}
                {d.location && <span className="truncate">{d.location}</span>}
              </div>

              <button
                className="btn-secondary text-xs py-1 w-full"
                onClick={(e) => pingDevice(d.id, e)}
                disabled={pinging === d.id}
              >
                {pinging === d.id ? 'Pinging…' : '⚡ Ping'}
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
