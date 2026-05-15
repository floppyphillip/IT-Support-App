import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsAPI, clientsAPI, devicesAPI, aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Bot, Sparkles } from 'lucide-react'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const CATEGORIES = ['network', 'hardware', 'software', 'security', 'connectivity', 'performance', 'other']

export default function NewTicket() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', category: 'other',
    client_id: '', device_id: '', tags: '',
  })
  const [clients, setClients] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)

  useEffect(() => {
    Promise.all([
      clientsAPI.list({ limit: 100 }),
      devicesAPI.list({ limit: 100 }),
    ]).then(([c, d]) => {
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
      toast.success(`AI classified: ${data.category} / ${data.priority}`)
    } catch { toast.error('Classification failed') }
    finally { setClassifying(false) }
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        client_id: form.client_id || undefined,
        device_id: form.device_id || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      }
      const { data } = await ticketsAPI.create(payload)
      toast.success(`Ticket ${data.ticket_number} created`)
      navigate(`/tickets/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Ticket</h1>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-5">
        {/* Title + AI classify */}
        <div>
          <label className="label">Title *</label>
          <div className="flex gap-2">
            <input className="input flex-1" required value={form.title} onChange={set('title')} placeholder="Brief issue description" />
            <button type="button" className="btn-secondary" onClick={autoClassify} disabled={classifying} title="Auto-classify with AI">
              <Sparkles className="w-4 h-4" />
              {classifying ? '…' : 'AI'}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input h-32 resize-none" value={form.description} onChange={set('description')} placeholder="Detailed description of the issue…" />
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

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Ticket'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/tickets')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
