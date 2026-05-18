import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonCard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { Plus, Search, Activity, Cpu, HardDrive, MapPin, Zap, Server, X, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const DEVICE_ICONS = {
  router: '🔀', switch: '🔌', server: '🖥️', workstation: '💻',
  printer: '🖨️', access_point: '📡', firewall: '🛡️', nas: '💾', camera: '📷', other: '📦',
}

const DEVICE_TYPES = ['router','switch','firewall','server','workstation','access_point','nas','camera','other']
const VENDORS      = ['cisco','mikrotik','juniper','huawei','linux','windows','paloalto','fortinet','other']

const EMPTY_FORM = {
  name: '', ip_address: '', hostname: '', model: '', os_version: '', location: '',
  device_type: 'other', vendor: 'other',
  monitoring_enabled: true,
  snmp_enabled: false, snmp_community: 'public', snmp_version: '2c',
  ssh_enabled: false, ssh_port: 22, ssh_username: '', ssh_password: '',
}

function AddDeviceModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim())       return toast.error('Device name is required')
    if (!form.ip_address.trim()) return toast.error('IP address is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        name:       form.name.trim(),
        ip_address: form.ip_address.trim(),
        hostname:   form.hostname.trim()   || undefined,
        model:      form.model.trim()      || undefined,
        os_version: form.os_version.trim() || undefined,
        location:   form.location.trim()   || undefined,
        ssh_port:   Number(form.ssh_port) || 22,
        snmp_community: form.snmp_enabled ? form.snmp_community : undefined,
        snmp_version:   form.snmp_enabled ? form.snmp_version   : undefined,
        ssh_username:   form.ssh_enabled  ? form.ssh_username   || undefined : undefined,
        ssh_password:   form.ssh_enabled  ? form.ssh_password   || undefined : undefined,
      }
      await devicesAPI.create(payload)
      toast.success('Device added successfully')
      onCreated()
      onClose()
    } catch (err) {
      if (!err.response) {
        toast.error('Cannot reach server — make sure the backend is running')
      } else {
        const detail = err.response.data?.detail
        if (Array.isArray(detail)) {
          toast.error(detail.map(d => d.msg ?? d).join(', '))
        } else {
          toast.error(detail ?? `Server error ${err.response.status}`)
        }
      }
      console.error('[AddDevice]', err.response?.status, err.response?.data ?? err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4"
         style={{ background: 'rgba(0,0,0,0.7)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl mx-auto my-8 rounded-2xl border overflow-hidden flex flex-col"
           style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="font-semibold text-slate-200">Add Device</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Register a new network device for monitoring</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="p-6 space-y-5">

          {/* Basic Info */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  Device Name <span className="text-red-400">*</span>
                </label>
                <input className="input w-full" placeholder="core-router-01"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  IP Address <span className="text-red-400">*</span>
                </label>
                <input className="input w-full font-mono" placeholder="192.168.1.1"
                  value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Hostname</label>
                <input className="input w-full font-mono" placeholder="router.local"
                  value={form.hostname} onChange={(e) => set('hostname', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Location</label>
                <input className="input w-full" placeholder="Server Room A"
                  value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Device Type</label>
                <select className="input w-full" value={form.device_type} onChange={(e) => set('device_type', e.target.value)}>
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Vendor</label>
                <select className="input w-full" value={form.vendor} onChange={(e) => set('vendor', e.target.value)}>
                  {VENDORS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Model</label>
                <input className="input w-full" placeholder="ISR 4431"
                  value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>OS / Firmware Version</label>
                <input className="input w-full font-mono" placeholder="IOS 15.7"
                  value={form.os_version} onChange={(e) => set('os_version', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Monitoring */}
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Monitoring</p>
            <Toggle label="Enable monitoring (ICMP ping)" checked={form.monitoring_enabled}
              onChange={(v) => set('monitoring_enabled', v)} />
          </section>

          {/* SNMP */}
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <Toggle label="SNMP polling" checked={form.snmp_enabled}
              onChange={(v) => set('snmp_enabled', v)} />
            {form.snmp_enabled && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Community String</label>
                  <input className="input w-full font-mono" placeholder="public"
                    value={form.snmp_community} onChange={(e) => set('snmp_community', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>SNMP Version</label>
                  <select className="input w-full" value={form.snmp_version} onChange={(e) => set('snmp_version', e.target.value)}>
                    <option value="1">v1</option>
                    <option value="2c">v2c</option>
                    <option value="3">v3</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* SSH */}
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <Toggle label="SSH remote access" checked={form.ssh_enabled}
              onChange={(v) => set('ssh_enabled', v)} />
            {form.ssh_enabled && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>SSH Port</label>
                  <input className="input w-full font-mono" type="number" placeholder="22"
                    value={form.ssh_port} onChange={(e) => set('ssh_port', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Username</label>
                  <input className="input w-full font-mono" placeholder="admin"
                    value={form.ssh_username} onChange={(e) => set('ssh_username', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Password</label>
                  <input className="input w-full font-mono" type="password" placeholder="Encrypted at rest"
                    value={form.ssh_password} onChange={(e) => set('ssh_password', e.target.value)} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Plus className="w-3.5 h-3.5" />Add Device</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200"
        style={{ background: checked ? 'var(--blue)' : 'var(--surface-2)', border: '1px solid var(--border-mid)' }}>
        <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      </button>
      <span className="text-xs" style={{ color: checked ? 'var(--text-2)' : 'var(--text-3)' }}>{label}</span>
    </label>
  )
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pinging, setPinging] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await devicesAPI.list({ limit: 50, search: search || undefined })
      setDevices(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('[Devices] load failed', err.response?.status, err.message)
      toast.error('Failed to load devices')
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
      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onCreated={load} />}
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Devices</h1><p className="page-sub">{total} total</p></div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" />Add Device</button>
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
            <Link key={d.id} to={`/devices/${d.id}`} className="card p-5 hover:shadow-lg hover:bg-[#162033] transition-all duration-200 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: '#162033' }}>
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
