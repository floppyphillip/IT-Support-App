import { useEffect, useState } from 'react'
import { clientsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Plus, Search, Phone, Mail, Edit2, X, Building2 } from 'lucide-react'
import { SkeletonTable } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const CONTRACT_STYLES = {
  basic: 'bg-slate-100 text-slate-600 border-slate-200',
  pro: 'bg-blue-50 text-blue-700 border-blue-100',
  enterprise: 'bg-violet-50 text-violet-700 border-violet-100',
}

function ClientModal({ client, onClose, onSave }) {
  const isEdit = !!client?.id
  const [form, setForm] = useState({
    name: client?.name ?? '', company: client?.company ?? '',
    email: client?.email ?? '', phone: client?.phone ?? '',
    address: client?.address ?? '', contract_type: client?.contract_type ?? '',
    sla_hours: client?.sla_hours ?? 24, notes: client?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = isEdit ? await clientsAPI.update(client.id, form) : await clientsAPI.create(form)
      onSave(data)
      onClose()
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-dropdown w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={set('name')} /></div>
            <div><label className="label">Company</label><input className="input" value={form.company} onChange={set('company')} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" required value={form.email} onChange={set('email')} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
            <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={set('address')} /></div>
            <div>
              <label className="label">Contract</label>
              <select className="input" value={form.contract_type} onChange={set('contract_type')}>
                {['', 'basic', 'pro', 'enterprise'].map((c) => <option key={c} value={c}>{c || '— None —'}</option>)}
              </select>
            </div>
            <div><label className="label">SLA (hours)</label><input className="input" type="number" value={form.sla_hours} onChange={set('sla_hours')} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input h-20 resize-none" value={form.notes} onChange={set('notes')} /></div>
          <div className="flex gap-3 pt-1 border-t border-slate-100">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClientRow({ c, onEdit }) {
  return (
    <>
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[40px_1fr_200px_100px_80px_40px] items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-all duration-200">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm">
          {c.name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{c.name}</p>
            {!c.is_active && <span className="badge bg-red-50 text-red-600 border border-red-100">inactive</span>}
          </div>
          <p className="text-xs text-slate-500">{c.company}</p>
        </div>
        <div className="text-xs text-slate-500 space-y-0.5 min-w-0">
          <div className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{c.email}</div>
          {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" />{c.phone}</div>}
        </div>
        <div>
          {c.contract_type
            ? <span className={`badge border ${CONTRACT_STYLES[c.contract_type] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{c.contract_type}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </div>
        <span className="text-xs text-slate-500">{c.sla_hours ? `${c.sla_hours}h` : '—'}</span>
        <button className="btn-ghost p-1.5" onClick={() => onEdit(c)}><Edit2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* Mobile card */}
      <div className="md:hidden card mb-3 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-semibold">
              {c.name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500">{c.company}</p>
            </div>
          </div>
          <button className="btn-ghost p-1" onClick={() => onEdit(c)}><Edit2 className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-2">
          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
          {c.contract_type && <span className={`badge border ${CONTRACT_STYLES[c.contract_type]}`}>{c.contract_type}</span>}
        </div>
      </div>
    </>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await clientsAPI.list({ limit: 50, search: search || undefined })
      setClients(data.items)
      setTotal(data.total)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  const handleSave = (client) => {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = client; return n }
      return [client, ...prev]
    })
    toast.success('Client saved')
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {modal !== null && <ClientModal client={modal} onClose={() => setModal(null)} onSave={handleSave} />}

      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Clients</h1><p className="page-sub">{total} total</p></div>
        <button className="btn-primary" onClick={() => setModal({})}><Plus className="w-4 h-4" /> Add Client</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input className="input pl-9 w-52" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <SkeletonTable rows={6} cols={5} /> : clients.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title="No clients yet" description="Add your first client to start managing their IT support." action={() => setModal({})} actionLabel="Add Client" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[40px_1fr_200px_100px_80px_40px] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100">
            <span className="th" />
            <span className="th">Client</span>
            <span className="th">Contact</span>
            <span className="th">Contract</span>
            <span className="th">SLA</span>
            <span className="th" />
          </div>
          <div className="md:divide-y md:divide-slate-100">
            {clients.map((c) => <ClientRow key={c.id} c={c} onEdit={setModal} />)}
          </div>
        </div>
      )}
    </div>
  )
}
