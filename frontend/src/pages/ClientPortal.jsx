import { useState, useEffect } from 'react'
import { ticketsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import AlertBadge from '../components/AlertBadge'
import { Monitor, Ticket, Plus, LogIn, ArrowRight, Shield } from 'lucide-react'
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
      <div className="min-h-screen flex">
        {/* Left panel */}
        <div className="hidden lg:flex lg:w-2/5 bg-brand-500 flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">NetSupportAI</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-4">
              Client Support Portal
            </h1>
            <p className="text-brand-100 text-base mb-8">
              Submit tickets, track issues, and get AI-powered IT support.
            </p>
            <div className="space-y-3">
              {[
                ['Submit Tickets', 'Report issues directly from this portal'],
                ['Track Progress', 'Monitor your ticket status in real-time'],
                ['AI-Assisted', 'Automatic diagnosis and faster resolutions'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium text-sm">{title}</p>
                    <p className="text-brand-200 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-brand-300 text-xs">
            © {new Date().getFullYear()} NetSupportAI. All rights reserved.
          </p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center bg-zoho-body p-8">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <Monitor className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-zoho-text">NetSupportAI Client Portal</span>
            </div>

            <div className="bg-white rounded-xl border border-zoho-border shadow-card p-8">
              <h2 className="text-xl font-bold text-zoho-text mb-1">Client Sign In</h2>
              <p className="text-sm text-zoho-muted mb-6">Enter your credentials to access the portal</p>

              <form onSubmit={doLogin} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    className="input"
                    type="email"
                    required
                    value={creds.email}
                    onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={creds.password}
                    onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={logging}>
                  {logging ? 'Signing in…' : <><LogIn className="w-4 h-4" /> Sign in</>}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zoho-border">
                <p className="text-xs text-zoho-muted text-center">
                  Staff member?{' '}
                  <a href="/login" className="text-brand-500 hover:text-brand-600 font-medium">
                    Staff login <ArrowRight className="inline w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-gray-400">
              <Shield className="w-3 h-3" />
              <span>Secured with JWT + bcrypt</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zoho-body">
      {/* Portal header */}
      <header className="bg-white border-b border-zoho-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zoho-text text-sm">NetSupportAI</span>
          <span className="text-zoho-muted text-sm">/ Client Portal</span>
        </div>
        <span className="text-sm text-zoho-muted">Welcome, <span className="text-zoho-text font-medium">{user?.full_name}</span></span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My Support Tickets</h1>
            <p className="page-sub">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zoho-text mb-4">Submit a Support Request</h2>
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className="label">Issue Title *</label>
                <input
                  className="input"
                  required
                  value={newTicket.title}
                  onChange={(e) => setNewTicket((t) => ({ ...t, title: e.target.value }))}
                  placeholder="Brief description of the issue"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input h-28 resize-none"
                  value={newTicket.description}
                  onChange={(e) => setNewTicket((t) => ({ ...t, description: e.target.value }))}
                  placeholder="Please describe the issue in detail…"
                />
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  className="input w-40"
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket((t) => ({ ...t, priority: e.target.value }))}
                >
                  {['low', 'medium', 'high', 'critical'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1 border-t border-zoho-border">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Ticket'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tickets list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-zoho-muted text-sm">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center">
              <Ticket className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p className="text-zoho-muted text-sm mb-3">No tickets yet.</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                Submit your first ticket
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zoho-border">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zoho-text">{t.title}</p>
                    <p className="text-xs text-zoho-muted mt-0.5">
                      {t.ticket_number} · {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <AlertBadge priority={t.priority} />
                  <StatusIndicator status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
