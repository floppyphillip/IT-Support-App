import { useEffect, useState } from 'react'
import { clientsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Plus, Search, Building2, Phone, Mail, Edit2, X } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-semibold text-lg">{isEdit ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
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
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create client'}</button>
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
  const [modal, setModal] = useState(null) // null | {} | existing client

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

  const CONTRACT_COLORS = { basic: 'bg-gray-100 text-gray-600', pro: 'bg-blue-100 text-blue-700', enterprise: 'bg-purple-100 text-purple-700' }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal !== null && <ClientModal client={modal} onClose={() => setModal(null)} onSave={handleSave} />}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Clients</h1><p className="text-sm text-gray-500">{total} total</p></div>
        <button className="btn-primary" onClick={() => setModal({})}><Plus className="w-4 h-4" /> Add Client</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9 w-64" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">Loading…</div> : (
        <div className="grid gap-4">
          {clients.map((c) => (
            <div key={c.id} className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg flex-shrink-0">
                {c.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  {c.contract_type && (
                    <span className={`badge ${CONTRACT_COLORS[c.contract_type] ?? 'bg-gray-100 text-gray-600'}`}>{c.contract_type}</span>
                  )}
                  {!c.is_active && <span className="badge bg-red-100 text-red-600">inactive</span>}
                </div>
                <p className="text-sm text-gray-500">{c.company}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.sla_hours && <span>SLA {c.sla_hours}h</span>}
                </div>
              </div>
              <button className="btn-secondary py-1.5" onClick={() => setModal(c)}>
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
