import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ticketsAPI, clientsAPI, devicesAPI, aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Sparkles } from 'lucide-react'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const CATEGORIES = ['network', 'hardware', 'software', 'security', 'connectivity', 'performance', 'other']

export default function NewTicket() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: 'other', client_id: '', device_id: '', tags: '' })
  const [clients, setClients] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)

  useEffect(() => {
    Promise.all([clientsAPI.list({ limit: 100 }), devicesAPI.list({ limit: 100 })]).then(([c, d]) => {
      setClients(c.data.items)
      setDevices(d.data.items)
    })
  }, [])

  const autoClassify = async () => {
    if (!form.title) return toast.error('Enter a title first')
    setClassifying(true)
    try {
      const { data } = await aiAPI.classifyTicket({ title: form.title, description: form.description })
      setForm((f) => ({ ...f, category: data.category, priority: data.priority }))
      toast.success(`Classified: ${data.category} / ${data.priority}`)
    } catch { toast.error('Classification failed') }
    finally { setClassifying(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, client_id: form.client_id || undefined, device_id: form.device_id || undefined, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] }
      const { data } = await ticketsAPI.create(payload)
      toast.success(`Ticket ${data.ticket_number} created`)
      navigate(`/tickets/${data.id}`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create ticket') }
    finally { setLoading(false) }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/tickets" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title">New Ticket</h1>
          <p className="page-sub">Report a new issue for triage</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-5">
        <div>
          <label className="label">Title *</label>
          <div className="flex gap-2">
            <input className="input flex-1" required value={form.title} onChange={set('title')} placeholder="Brief description of the issue" />
            <button type="button" className="btn-secondary flex-shrink-0" onClick={autoClassify} disabled={classifying} title="Auto-classify with AI">
              <Sparkles className="w-4 h-4" />
              {classifying ? '…' : 'AI Classify'}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input h-28 resize-none" value={form.description} onChange={set('description')} placeholder="Describe symptoms, affected users, recent changes…" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client</label>
            <select className="input" value={form.client_id} onChange={set('client_id')}>
              <option value="">— Select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Device</label>
            <select className="input" value={form.device_id} onChange={set('device_id')}>
              <option value="">— No device —</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.ip_address})</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={set('tags')} placeholder="dns, vpn, firewall" />
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Ticket'}</button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/tickets')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
