import { useState, useEffect } from 'react'
import { ticketsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import AlertBadge from '../components/AlertBadge'
import { Monitor, Ticket, Plus, LogIn } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function ClientPortal() {
  const { isAuthenticated, login, user } = useAuth()
  const navigate = useNavigate()
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [logging, setLogging] = useState(false)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' })
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const doLogin = async (e) => {
    e.preventDefault()
    setLogging(true)
    try {
      await login(creds.email, creds.password)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally { setLogging(false) }
  }

  useEffect(() => {
    if (isAuthenticated && user?.role === 'client_user') {
      loadTickets()
    } else if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data } = await ticketsAPI.list({ limit: 20 })
      setTickets(data.items)
    } finally { setLoading(false) }
  }

  const submitTicket = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await ticketsAPI.create(newTicket)
      toast.success('Ticket submitted! Our team will be in touch shortly.')
      setShowForm(false)
      setNewTicket({ title: '', description: '', priority: 'medium' })
      loadTickets()
    } catch { toast.error('Failed to submit ticket') }
    finally { setSubmitting(false) }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-900 to-brand-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <Monitor className="w-10 h-10 text-brand-600 mx-auto mb-2" />
            <h1 className="text-2xl font-bold">NetSupportAI</h1>
            <p className="text-gray-500 text-sm">Client Portal</p>
          </div>
          <form onSubmit={doLogin} className="space-y-4">
            <div><label className="label">Email</label>
              <input className="input" type="email" required value={creds.email} onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))} /></div>
            <div><label className="label">Password</label>
              <input className="input" type="password" required value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} /></div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={logging}>
              <LogIn className="w-4 h-4" /> {logging ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center mt-4 text-sm text-gray-400">
            Staff? <a href="/login" className="text-brand-600 hover:underline">Staff login →</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Monitor className="w-5 h-5 text-brand-600" /> NetSupportAI</h1>
            <p className="text-sm text-gray-500">Welcome, {user?.full_name}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Ticket</button>
        </div>

        {showForm && (
          <div className="card p-6">
            <h2 className="font-semibold mb-4">Submit a Support Request</h2>
            <form onSubmit={submitTicket} className="space-y-4">
              <div><label className="label">Issue Title *</label>
                <input className="input" required value={newTicket.title} onChange={(e) => setNewTicket((t) => ({ ...t, title: e.target.value }))} /></div>
              <div><label className="label">Description</label>
                <textarea className="input h-28 resize-none" value={newTicket.description} onChange={(e) => setNewTicket((t) => ({ ...t, description: e.target.value }))} placeholder="Please describe the issue in detail…" /></div>
              <div><label className="label">Priority</label>
                <select className="input w-40" value={newTicket.priority} onChange={(e) => setNewTicket((t) => ({ ...t, priority: e.target.value }))}>
                  {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select></div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Ticket'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Ticket className="w-4 h-4" /> Your Tickets</h2>
          {loading ? <p className="text-gray-400 text-sm">Loading…</p> : tickets.length === 0 ? (
            <p className="text-gray-400 text-sm">No tickets yet.</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.ticket_number} · {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <AlertBadge priority={t.priority} />
                  <StatusIndicator status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
