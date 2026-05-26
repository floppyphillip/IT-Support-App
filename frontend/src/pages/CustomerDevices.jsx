import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { devicesAPI } from '../api/client'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonCard } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { Plus, Search, Activity, Cpu, HardDrive, MapPin, Zap, Server, X, Loader2, Play, Square, Pencil, Trash2, AlertTriangle, ChevronDown, Link2 } from 'lucide-react'
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

function DeviceFormModal({ device, onClose, onSaved, category = 'customer' }) {
  const isEdit = !!device
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const [form, setForm] = useState(isEdit ? {
    name:               device.name           ?? '',
    ip_address:         device.ip_address     ?? '',
    hostname:           device.hostname       ?? '',
    model:              device.model          ?? '',
    os_version:         device.os_version     ?? '',
    location:           device.location       ?? '',
    device_type:        device.device_type    ?? 'other',
    vendor:             device.vendor         ?? 'other',
    monitoring_enabled: device.monitoring_enabled ?? true,
    snmp_enabled:       device.snmp_enabled   ?? false,
    snmp_community:     device.snmp_community ?? 'public',
    snmp_version:       device.snmp_version   ?? '2c',
    ssh_enabled:        device.ssh_enabled    ?? false,
    ssh_port:           device.ssh_port       ?? 22,
    ssh_username:       device.ssh_username   ?? '',
    ssh_password:       '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim())       return toast.error('Device name is required')
    if (!form.ip_address.trim()) return toast.error('IP address is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        category,
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
      if (isEdit) {
        await devicesAPI.update(device.id, payload)
        toast.success('Device updated')
      } else {
        await devicesAPI.create(payload)
        toast.success('Device added successfully')
      }
      onSaved()
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
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <>
      <div className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="absolute inset-0 z-50 flex items-stretch justify-center px-6" style={{ pointerEvents: 'none' }}>
      <div className="w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
           style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)', pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="font-semibold text-gray-900">{isEdit ? 'Edit Device' : 'Add Device'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {isEdit ? `Editing ${device.name}` : 'Register a new customer device for monitoring'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <section>
            <p className="text-[15px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  Device Name <span className="text-red-400">*</span>
                </label>
                <input className="input w-full" placeholder="core-router-01"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  IP Address <span className="text-red-400">*</span>
                </label>
                <input className="input w-full font-mono" placeholder="192.168.1.1"
                  value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Hostname</label>
                <input className="input w-full font-mono" placeholder="router.local"
                  value={form.hostname} onChange={(e) => set('hostname', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Location</label>
                <input className="input w-full" placeholder="Customer Site A"
                  value={form.location} onChange={(e) => set('location', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Device Type</label>
                <select className="input w-full" value={form.device_type} onChange={(e) => set('device_type', e.target.value)}>
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Vendor</label>
                <select className="input w-full" value={form.vendor} onChange={(e) => set('vendor', e.target.value)}>
                  {VENDORS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Model</label>
                <input className="input w-full" placeholder="ISR 4431"
                  value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>
              <div>
                <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>OS / Firmware Version</label>
                <input className="input w-full font-mono" placeholder="IOS 15.7"
                  value={form.os_version} onChange={(e) => set('os_version', e.target.value)} />
              </div>
            </div>
          </section>
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[15px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Monitoring</p>
            <Toggle label="Enable monitoring (ICMP ping)" checked={form.monitoring_enabled}
              onChange={(v) => set('monitoring_enabled', v)} />
          </section>
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <Toggle label="SNMP polling" checked={form.snmp_enabled}
              onChange={(v) => set('snmp_enabled', v)} />
            {form.snmp_enabled && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Community String</label>
                  <input className="input w-full font-mono" placeholder="public"
                    value={form.snmp_community} onChange={(e) => set('snmp_community', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>SNMP Version</label>
                  <select className="input w-full" value={form.snmp_version} onChange={(e) => set('snmp_version', e.target.value)}>
                    <option value="1">v1</option>
                    <option value="2c">v2c</option>
                    <option value="3">v3</option>
                  </select>
                </div>
              </div>
            )}
          </section>
          <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <Toggle label="SSH remote access" checked={form.ssh_enabled}
              onChange={(v) => set('ssh_enabled', v)} />
            {form.ssh_enabled && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>SSH Port</label>
                  <input className="input w-full font-mono" type="number" placeholder="22"
                    value={form.ssh_port} onChange={(e) => set('ssh_port', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Username</label>
                  <input className="input w-full font-mono" placeholder="admin"
                    value={form.ssh_username} onChange={(e) => set('ssh_username', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Password</label>
                  <input className="input w-full font-mono" type="password" placeholder="Encrypted at rest"
                    value={form.ssh_password} onChange={(e) => set('ssh_password', e.target.value)} />
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={saving}>
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
              : isEdit
                ? <><Pencil className="w-3.5 h-3.5" />Save Changes</>
                : <><Plus className="w-3.5 h-3.5" />Add Device</>}
          </button>
        </div>
      </div>
      </div>
    </>,
    document.getElementById('overlay-root')
  )
}

function DeleteConfirmModal({ device, onClose, onDeleted }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const [deleting, setDeleting] = useState(false)

  const confirm = async () => {
    setDeleting(true)
    try {
      await devicesAPI.delete(device.id)
      toast.success(`${device.name} deleted`)
      onDeleted()
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(detail ?? `Delete failed (${err.response?.status ?? 'network error'})`)
    } finally {
      setDeleting(false)
    }
  }

  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.75)' }}
         onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose() }}>
      <div className="w-full max-w-sm rounded-2xl border overflow-hidden"
           style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)' }}>
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="font-semibold text-gray-900 mb-1">Delete Device</p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Are you sure you want to delete{' '}
            <span className="font-mono font-semibold text-gray-900">{device.name}</span>?
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-4)' }}>
            This will remove all associated metrics, backups, and alerts. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} disabled={deleting} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={confirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20
                       text-red-400 hover:bg-red-500/20 text-sm font-semibold px-4 py-2 rounded-lg
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {deleting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</>
              : <><Trash2 className="w-3.5 h-3.5" />Delete</>}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('overlay-root')
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

function PingModal({ device, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const isLink = device.tags?.includes('link')
  const bEndpoints = (() => {
    const fromExtra = device.extra_data?.endpoints_b?.filter(ip => ip?.trim()) ?? []
    return fromExtra.length > 0 ? fromExtra : (device.management_ip ? [device.management_ip] : [])
  })()
  const endpoints = isLink
    ? [
        { label: 'A', ip: device.ip_address },
        ...bEndpoints.map((ip, i) => ({ label: bEndpoints.length > 1 ? `B${i + 1}` : 'B', ip })),
      ]
    : null
  const [selectedIp, setSelectedIp] = useState(device.ip_address)
  const [count, setCount]       = useState('4')
  const [infinite, setInfinite] = useState(false)
  const [running, setRunning]   = useState(false)
  const [results, setResults]   = useState([])
  const [summary, setSummary]   = useState(null)
  const stopRef   = useRef(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [results])

  const buildSummary = (sent, received, latencies) => ({
    sent, received,
    loss: sent > 0 ? ((sent - received) / sent * 100).toFixed(0) : '0',
    min:  latencies.length ? Math.min(...latencies).toFixed(1) : '—',
    max:  latencies.length ? Math.max(...latencies).toFixed(1) : '—',
    avg:  latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : '—',
  })

  const start = async () => {
    const pingIp = isLink ? selectedIp : null
    setResults([]); setSummary(null); setRunning(true); stopRef.current = false
    if (infinite) {
      let sent = 0, received = 0, latencies = []
      while (!stopRef.current) {
        try {
          const { data } = await devicesAPI.ping(device.id, 1, pingIp)
          sent++
          if (data.reachable && data.latency_ms != null) { received++; latencies.push(data.latency_ms) }
          setResults(prev => [...prev, { key: Date.now() + Math.random(), reachable: data.reachable, latency: data.latency_ms, ip: data.ip_address }])
          setSummary(buildSummary(sent, received, latencies))
        } catch {
          sent++
          setResults(prev => [...prev, { key: Date.now() + Math.random(), error: true }])
          setSummary(buildSummary(sent, received, latencies))
        }
        if (!stopRef.current) await new Promise(r => setTimeout(r, 1000))
      }
    } else {
      const n = Math.max(1, Math.min(100, parseInt(count) || 4))
      try {
        const { data } = await devicesAPI.ping(device.id, n, pingIp)
        setResults([{ key: Date.now(), reachable: data.reachable, latency: data.latency_ms, ip: data.ip_address, packets_sent: data.packets_sent, packets_received: data.packets_received, loss: data.packet_loss_pct }])
        setSummary({ sent: data.packets_sent, received: data.packets_received, loss: data.packet_loss_pct?.toFixed(0) ?? '100', avg: data.latency_ms != null ? data.latency_ms.toFixed(1) : '—', min: '—', max: '—' })
      } catch (err) {
        setResults([{ key: Date.now(), error: true, msg: err?.response?.data?.detail ?? err.message }])
      }
    }
    setRunning(false); stopRef.current = false
  }

  const stop = () => { stopRef.current = true }
  const lossColor = (loss) => { const n = parseFloat(loss); return n === 0 ? 'text-emerald-400' : n < 50 ? 'text-amber-400' : 'text-red-400' }

  return createPortal(
    <>
      <div className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => { if (!running) onClose() }} />
      <div className="absolute inset-0 z-50 flex items-stretch justify-center px-6" style={{ pointerEvents: 'none' }}>
      <div className="w-full max-w-lg flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
           style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)', pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /> Ping Test</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-3)' }}>{device.name} — {device.ip_address}</p>
          </div>
          <button onClick={onClose} disabled={running} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-30">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* IP selector — link devices only */}
        {isLink && endpoints && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-4)' }}>Ping target</span>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-mid)' }}>
              {endpoints.map(({ label, ip }) => (
                <button
                  key={ip}
                  disabled={running}
                  onClick={() => { setSelectedIp(ip); setResults([]); setSummary(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                  style={{
                    background: selectedIp === ip ? 'var(--blue)' : 'transparent',
                    color: selectedIp === ip ? '#fff' : 'var(--text-3)',
                    borderRight: label !== endpoints[endpoints.length - 1].label ? '1px solid var(--border-mid)' : 'none',
                  }}
                >
                  <span className="font-sans font-bold" style={{ fontSize: 10 }}>{label}</span>
                  {ip}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <div className="flex items-center gap-2">
            <label className="text-[15px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>Count</label>
            <input type="number" min="1" max="100" className="input w-16 text-center font-mono py-1 text-xs"
              value={count} onChange={e => setCount(e.target.value)} disabled={infinite || running} />
          </div>
          <Toggle label="Infinite" checked={infinite} onChange={v => setInfinite(v)} />
          <div className="ml-auto">
            {running
              ? <button onClick={stop} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"><Square className="w-3 h-3" /> Stop</button>
              : <button onClick={start} className="btn-primary text-xs py-1.5 px-3"><Play className="w-3 h-3" /> Start</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ background: 'var(--bg)' }}>
          {results.length === 0 && !running && <p className="text-gray-400 text-center pt-16">Set count and press Start</p>}
          {results.map(r => (
            <div key={r.key} className={r.error ? 'text-red-400' : r.reachable ? 'text-emerald-400' : 'text-amber-400'}>
              {r.error ? `Error: ${r.msg ?? 'request failed'}` : r.reachable ? `Reply from ${r.ip}: time=${r.latency != null ? r.latency.toFixed(1) : '?'}ms` : `Request timeout for icmp_seq from ${r.ip}`}
            </div>
          ))}
          {running && <div className="text-blue-400 flex items-center gap-1.5 mt-1"><Loader2 className="w-3 h-3 animate-spin" /> sending…</div>}
          <div ref={bottomRef} />
        </div>
        <div className="border-t px-5 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          {summary ? (
            <div className="grid grid-cols-4 gap-3 text-center">
              {[['Sent', summary.sent, 'text-gray-900'], ['Received', summary.received, 'text-emerald-400'], ['Loss', `${summary.loss}%`, lossColor(summary.loss)], ['Avg RTT', summary.avg !== '—' ? `${summary.avg}ms` : '—', 'text-blue-400']].map(([label, val, cls]) => (
                <div key={label}>
                  <p className="text-[13px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-4)' }}>{label}</p>
                  <p className={`font-mono text-sm font-bold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-center" style={{ color: 'var(--text-4)' }}>— stats appear after first ping —</p>
          )}
        </div>
      </div>
      </div>
    </>,
    document.getElementById('overlay-root')
  )
}

const LINK_TYPES = ['fiber', 'radio']
const TOPOLOGY_OPTIONS = {
  fiber: ['point_to_point', 'point_to_multipoint'],
  radio: ['point_to_point', 'point_to_multipoint'],
}
const LINK_EMPTY = {
  name: '', link_type: 'fiber', topology: 'point_to_point', endpoint_a: '', endpoints_b: [''],
  bandwidth: '', provider: '', circuit_id: '', location: '', monitoring_enabled: true,
}

function LinkFormModal({ onClose, onSaved, category = 'customer', device = null }) {
  const isEdit = !!device
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const [form, setForm] = useState(isEdit ? {
    name:               device.name ?? '',
    link_type:          device.extra_data?.link_type ?? 'fiber',
    topology:           device.extra_data?.topology  ?? 'point_to_point',
    endpoint_a:         device.ip_address ?? '',
    endpoints_b:        (() => {
      const fromExtra = device.extra_data?.endpoints_b?.filter(ip => ip?.trim()) ?? []
      return fromExtra.length > 0 ? fromExtra : [device.management_ip ?? '']
    })(),
    bandwidth:          device.extra_data?.bandwidth ?? '',
    provider:           device.extra_data?.provider  ?? '',
    circuit_id:         device.serial_number ?? '',
    location:           device.location ?? '',
    monitoring_enabled: device.monitoring_enabled ?? true,
  } : LINK_EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setEndpointB = (i, val) => setForm(f => { const a = [...f.endpoints_b]; a[i] = val; return { ...f, endpoints_b: a } })
  const addEndpointB = () => setForm(f => ({ ...f, endpoints_b: [...f.endpoints_b, ''] }))
  const removeEndpointB = (i) => setForm(f => ({ ...f, endpoints_b: f.endpoints_b.filter((_, j) => j !== i) }))

  const submit = async () => {
    if (!form.name.trim())       return toast.error('Link name is required')
    if (!form.endpoint_a.trim()) return toast.error('Endpoint A IP is required')
    const validB = form.endpoints_b.filter(ip => ip.trim())
    setSaving(true)
    try {
      const payload = {
        name:               form.name.trim(),
        ip_address:         form.endpoint_a.trim(),
        management_ip:      validB[0] || undefined,
        serial_number:      form.circuit_id.trim()  || undefined,
        location:           form.location.trim()    || undefined,
        monitoring_enabled: form.monitoring_enabled,
        extra_data: {
          link_type:   form.link_type,
          topology:    form.topology,
          bandwidth:   form.bandwidth.trim() || undefined,
          provider:    form.provider.trim()  || undefined,
          endpoints_b: validB.length > 0 ? validB : undefined,
        },
      }
      if (isEdit) {
        await devicesAPI.update(device.id, payload)
        toast.success('Link updated')
      } else {
        await devicesAPI.create({ ...payload, tags: ['link'], category, device_type: 'other', vendor: 'other' })
        toast.success('Link added successfully')
      }
      onSaved()
      onClose()
    } catch (err) {
      if (!err.response) {
        toast.error('Cannot reach server — make sure the backend is running')
      } else {
        const detail = err.response.data?.detail
        if (Array.isArray(detail)) toast.error(detail.map(d => d.msg ?? d).join(', '))
        else toast.error(detail ?? `Server error ${err.response.status}`)
      }
    } finally { setSaving(false) }
  }

  return createPortal(
    <>
      <div className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="absolute inset-0 z-50 flex items-stretch justify-center px-6" style={{ pointerEvents: 'none' }}>
        <div className="w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
             style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)', pointerEvents: 'auto' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="font-semibold text-gray-900">{isEdit ? 'Edit Link' : 'Add Link'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{isEdit ? `Editing ${device.name}` : 'Register a network link or circuit'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <section>
              <p className="text-[15px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Link Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                    Link Name <span className="text-red-400">*</span>
                  </label>
                  <input className="input w-full" placeholder="Lagos-Abuja-MPLS"
                    value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Link Type</label>
                  <select className="input w-full" value={form.link_type}
                    onChange={e => {
                      const t = e.target.value
                      set('link_type', t)
                      set('topology', TOPOLOGY_OPTIONS[t]?.[0] ?? 'point_to_point')
                    }}>
                    {LINK_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Topology</label>
                  <select className="input w-full" value={form.topology} onChange={e => set('topology', e.target.value)}>
                    {(TOPOLOGY_OPTIONS[form.link_type] ?? []).map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, '-').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Bandwidth</label>
                  <input className="input w-full font-mono" placeholder="100 Mbps"
                    value={form.bandwidth} onChange={e => set('bandwidth', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                    Endpoint A <span className="text-red-400">*</span>
                  </label>
                  <input className="input w-full font-mono" placeholder="192.168.1.1"
                    value={form.endpoint_a} onChange={e => set('endpoint_a', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[15px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>Endpoint B</label>
                    <button
                      type="button"
                      disabled={form.topology !== 'point_to_multipoint'}
                      onClick={addEndpointB}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                    >
                      <Plus className="w-3 h-3" /> Add Point B
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.endpoints_b.map((ip, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-blue-400 font-mono w-5 flex-shrink-0 text-center">
                          {form.endpoints_b.length > 1 ? `B${i + 1}` : 'B'}
                        </span>
                        <input className="input flex-1 font-mono" placeholder="10.0.0.1"
                          value={ip} onChange={e => setEndpointB(i, e.target.value)} />
                        {form.endpoints_b.length > 1 && (
                          <button type="button" onClick={() => removeEndpointB(i)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Provider / Carrier</label>
                  <input className="input w-full" placeholder="MTN Business"
                    value={form.provider} onChange={e => set('provider', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Circuit ID</label>
                  <input className="input w-full font-mono" placeholder="MTN-MPLS-004921"
                    value={form.circuit_id} onChange={e => set('circuit_id', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[15px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>Location / Route</label>
                  <input className="input w-full" placeholder="Lagos → Abuja"
                    value={form.location} onChange={e => set('location', e.target.value)} />
                </div>
              </div>
            </section>
            <section className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[15px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-4)' }}>Monitoring</p>
              <Toggle label="Enable monitoring (ICMP ping on Endpoint A)" checked={form.monitoring_enabled}
                onChange={v => set('monitoring_enabled', v)} />
            </section>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
            <button onClick={submit} className="btn-primary" disabled={saving}>
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                : isEdit
                  ? <><Pencil className="w-3.5 h-3.5" />Save Changes</>
                  : <><Link2 className="w-3.5 h-3.5" />Add Link</>}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.getElementById('overlay-root')
  )
}

const LINE_COLOR = {
  online: '#10b981', offline: '#ef4444', degraded: '#f59e0b',
  maintenance: '#8b5cf6', unknown: '#ef4444',
}
const NODE_B_CLS = {
  online:      'bg-emerald-500/10 border-emerald-400 text-emerald-400',
  offline:     'bg-red-500/10 border-red-400 text-red-400',
  degraded:    'bg-amber-500/10 border-amber-400 text-amber-400',
  maintenance: 'bg-purple-500/10 border-purple-400 text-purple-400',
  unknown:     'bg-red-500/10 border-red-400 text-red-400',
}
const CARD_BORDER = {
  online:      'rgba(16,185,129,0.30)',
  offline:     'rgba(239,68,68,0.45)',
  degraded:    'rgba(245,158,11,0.30)',
  maintenance: 'rgba(139,92,246,0.30)',
  unknown:     'rgba(239,68,68,0.35)',
}

function LinkCard({ d, detailPath, onPing, onEdit, onDelete }) {
  const status    = d.status ?? 'unknown'
  const lineColor = LINE_COLOR[status] ?? LINE_COLOR.unknown
  const nodeBCls  = NODE_B_CLS[status]  ?? NODE_B_CLS.unknown
  const isOnline  = status === 'online'
  const linkType  = d.extra_data?.link_type ?? 'link'
  const bandwidth = d.extra_data?.bandwidth
  const provider  = d.extra_data?.provider
  const endpointsB = (() => {
    const fromExtra = d.extra_data?.endpoints_b?.filter(ip => ip?.trim()) ?? []
    return fromExtra.length > 0 ? fromExtra : (d.management_ip ? [d.management_ip] : ['—'])
  })()

  return (
    <Link to={detailPath}
      className="card p-4 hover:shadow-lg hover:bg-gray-50 transition-all duration-200 group block"
      style={{ borderColor: CARD_BORDER[status] }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-400 transition-colors truncate">{d.name}</p>
          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 uppercase tracking-wide"
            style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
            {linkType.replace('_', ' ')}
          </span>
        </div>
        <StatusIndicator status={d.status} dot />
      </div>

      {/* Topology diagram */}
      <div className="flex gap-2 my-4">
        {/* Node A — vertically centered */}
        <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ width: 64 }}>
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border-2 border-blue-400 flex items-center justify-center text-xs font-bold text-blue-400 mb-1">
            A
          </div>
          <p className="text-[10px] font-mono text-gray-500 truncate w-full text-center">{d.ip_address}</p>
        </div>

        {/* Lines + B nodes */}
        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
          {endpointsB.map((bIp, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="relative w-full flex items-center">
                  <div className="w-full" style={{
                    borderTop: `2px ${isOnline ? 'solid' : 'dashed'} ${lineColor}`,
                    opacity: status === 'unknown' ? 0.35 : 1,
                  }} />
                  {endpointsB.length === 1 && (
                    <div className="absolute w-2.5 h-2.5 rounded-full"
                      style={{
                        left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                        background: lineColor,
                        boxShadow: isOnline ? `0 0 8px ${lineColor}` : 'none',
                      }} />
                  )}
                </div>
                {bandwidth && endpointsB.length === 1 && (
                  <p className="text-[9px] font-mono mt-1 truncate" style={{ color: lineColor }}>{bandwidth}</p>
                )}
              </div>
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 60 }}>
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold mb-0.5 ${nodeBCls}`}>
                  {endpointsB.length > 1 ? `B${i + 1}` : 'B'}
                </div>
                <p className="text-[10px] font-mono text-gray-500 truncate w-full text-center">{bIp}</p>
              </div>
            </div>
          ))}
          {bandwidth && endpointsB.length > 1 && (
            <p className="text-[9px] font-mono truncate" style={{ color: lineColor }}>{bandwidth}</p>
          )}
        </div>
      </div>

      {/* Metadata */}
      {(provider || d.serial_number || d.location) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[10px] text-gray-400">
          {provider && <span>{provider}</span>}
          {d.serial_number && <span className="font-mono">{provider ? '· ' : ''}{d.serial_number}</span>}
          {d.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />{d.location}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button className="btn-secondary flex-1 justify-center text-xs py-1.5"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPing(d) }}>
          <Zap className="w-3 h-3" /> Ping
        </button>
        <button className="btn-secondary justify-center text-xs py-1.5 px-3" title="Edit"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(d) }}>
          <Pencil className="w-3 h-3" />
        </button>
        <button className="flex items-center justify-center text-xs py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
          title="Delete"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(d) }}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </Link>
  )
}

function AddDropdown({ onNetworkDevice, onLink }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="btn-primary">
        <Plus className="w-4 h-4" />Add Device<ChevronDown className="w-3.5 h-3.5 ml-1" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl shadow-xl border z-50 overflow-hidden py-1"
             style={{ background: 'var(--surface)', borderColor: 'var(--border-mid)' }}>
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => { setOpen(false); onNetworkDevice() }}
          >
            <Server className="w-4 h-4 text-blue-400 flex-shrink-0" />
            Network Device
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => { setOpen(false); onLink() }}
          >
            <Link2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            Link
          </button>
        </div>
      )}
    </div>
  )
}

export default function CustomerDevices() {
  const [devices, setDevices]           = useState([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showAdd, setShowAdd]           = useState(false)
  const [showAddLink, setShowAddLink]   = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pingTarget, setPingTarget]     = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await devicesAPI.list({ limit: 50, search: search || undefined, category: 'customer' })
      setDevices(data.items)
      setTotal(data.total)
    } catch (err) {
      toast.error('Failed to load devices')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  return (
    <div className="space-y-4 animate-fade-in">
      {showAdd      && <DeviceFormModal category="customer" onClose={() => setShowAdd(false)} onSaved={load} />}
      {showAddLink  && <LinkFormModal category="customer" onClose={() => setShowAddLink(false)} onSaved={load} />}
      {editTarget && (editTarget.tags?.includes('link')
        ? <LinkFormModal category="customer" device={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
        : <DeviceFormModal category="customer" device={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />)}
      {deleteTarget && <DeleteConfirmModal device={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={load} />}
      {pingTarget   && <PingModal device={pingTarget} onClose={() => { setPingTarget(null); load() }} />}

      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Customer Devices</h1><p className="page-sub">{total} total</p></div>
        <AddDropdown onNetworkDevice={() => setShowAdd(true)} onLink={() => setShowAddLink(true)} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input className="input pl-9 w-52" placeholder="Search devices…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} rows={3} />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="card">
          <EmptyState icon={Server} title="No customer devices found" description="Add your first customer device to start monitoring." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => d.tags?.includes('link') ? (
            <LinkCard
              key={d.id} d={d} detailPath={`/customer-devices/${d.id}`}
              onPing={() => setPingTarget(d)}
              onEdit={() => setEditTarget(d)}
              onDelete={() => setDeleteTarget(d)}
            />
          ) : (
            <Link key={d.id} to={`/customer-devices/${d.id}`} className="card p-5 hover:shadow-lg hover:bg-gray-50 transition-all duration-200 group"
              style={{ borderColor: CARD_BORDER[d.status] }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#f3f4f6' }}>
                    {DEVICE_ICONS[d.device_type] ?? '📦'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-400 transition-all duration-200">{d.name}</p>
                    <p className="text-xs font-mono text-gray-400">{d.ip_address}</p>
                  </div>
                </div>
                <StatusIndicator status={d.status} dot />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-400 mb-4">
                {d.last_ping_ms != null && <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-blue-400" />{d.last_ping_ms}ms</span>}
                {d.cpu_usage != null && <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-violet-400" />{d.cpu_usage.toFixed(0)}%</span>}
                {d.memory_usage != null && <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-emerald-400" />{d.memory_usage.toFixed(0)}%</span>}
                {d.location && <span className="flex items-center gap-1 col-span-2 truncate"><MapPin className="w-3 h-3 text-amber-400" />{d.location}</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 justify-center text-xs py-1.5"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPingTarget(d) }}>
                  <Zap className="w-3 h-3" /> Ping
                </button>
                <button className="btn-secondary justify-center text-xs py-1.5 px-3" title="Edit device"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditTarget(d) }}>
                  <Pencil className="w-3 h-3" />
                </button>
                <button className="flex items-center justify-center text-xs py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                  title="Delete device"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(d) }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
