import { useEffect, useState } from 'react'
import { clientsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Plus, Search, Phone, Mail, Edit2, X, Building2 } from 'lucide-react'

const CONTRACT_STYLES = {
  basic: 'bg-gray-100 text-gray-600',
  pro: 'bg-blue-50 text-blue-700',
  enterprise: 'bg-violet-50 text-violet-700',
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
      if (isEdit) {
        const { data } = await clientsAPI.update(client.id, form)
        onSave(data)
      } else {
        const { data } = await clientsAPI.create(form)
        onSave(data)
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-dropdown w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zoho-border">
          <h2 className="text-base font-semibold text-zoho-text">{isEdit ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="text-zoho-muted hover:text-zoho-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={set('company')} />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={set('address')} />
            </div>
            <div>
              <label className="label">Contract</label>
              <select className="input" value={form.contract_type} onChange={set('contract_type')}>
                {['', 'basic', 'pro', 'enterprise'].map((c) => (
                  <option key={c} value={c}>{c || '— None —'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">SLA (hours)</label>
              <input className="input" type="number" value={form.sla_hours} onChange={set('sla_hours')} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input h-20 resize-none" value={form.notes} onChange={set('notes')} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
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
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search])

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
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">{total} total</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted" />
        <input
          className="input pl-9 w-56 text-sm"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-zoho-border">
          <span className="th w-10" />
          <span className="th">Client</span>
          <span className="th">Contact</span>
          <span className="th">Contract</span>
          <span className="th">SLA</span>
          <span className="th" />
        </div>

        {loading ? (
          <div className="py-16 text-center text-zoho-muted text-sm">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-zoho-muted text-sm mb-3">No clients yet.</p>
            <button className="btn-primary" onClick={() => setModal({})}>Add first client</button>
          </div>
        ) : clients.map((c) => (
          <div key={c.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-zoho-border last:border-0 hover:bg-zoho-body transition-colors">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 font-semibold text-sm flex-shrink-0">
              {c.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zoho-text">{c.name}</p>
                {!c.is_active && <span className="badge bg-red-50 text-red-600">inactive</span>}
              </div>
              <p className="text-xs text-zoho-muted">{c.company}</p>
            </div>
            <div className="text-xs text-zoho-muted space-y-0.5">
              <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>
              {c.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</div>}
            </div>
            <div>
              {c.contract_type ? (
                <span className={`badge ${CONTRACT_STYLES[c.contract_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {c.contract_type}
                </span>
              ) : <span className="text-xs text-gray-300">—</span>}
            </div>
            <span className="text-xs text-zoho-muted">{c.sla_hours ? `${c.sla_hours}h` : '—'}</span>
            <button
              className="btn-ghost py-1.5 px-2"
              onClick={() => setModal(c)}
              title="Edit client"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
