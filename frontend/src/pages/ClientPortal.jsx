import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import StatusIndicator from '../components/StatusIndicator'
import AlertBadge from '../components/AlertBadge'
import { Skeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import useAuth from '../hooks/useAuth'
import { Monitor, LogIn, ArrowRight, Shield, Plus, Ticket, X, CheckCircle, Clock, Users } from 'lucide-react'

const FEATURES = [
  { icon: CheckCircle, title: 'Submit Tickets',   desc: 'Report issues directly from this portal' },
  { icon: Clock,       title: 'Track Progress',   desc: 'Monitor ticket status in real-time' },
  { icon: Users,       title: 'AI-Assisted',      desc: 'Faster resolutions with Claude AI diagnosis' },
]

export default function ClientPortal() {
  const { isAuthenticated, login, user } = useAuth()
  const navigate = useNavigate()
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [logging, setLogging] = useState(false)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' })
  const [submitting, setSubmitting] = useState(false)

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
    if (isAuthenticated) {
      if (user?.role !== 'client' && user?.role !== 'client_user') {
        navigate('/dashboard')
        return
      }
      loadTickets()
    }
  }, [isAuthenticated, user])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data } = await ticketsAPI.list({ limit: 30 })
      setTickets(data.items || [])
    } catch { /* handled silently */ }
    finally { setLoading(false) }
  }

  const submitTicket = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await ticketsAPI.create(newTicket)
      toast.success('Ticket submitted — our team will be in touch shortly.')
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
        <div className="hidden lg:flex lg:w-5/12 bg-slate-900 flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">NetSupportAI</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Client Support<br />Portal
            </h1>
            <p className="text-slate-400 text-lg mb-10">
              Submit tickets, track issues, and get AI-powered IT support.
            </p>
            <div className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-slate-400 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} NetSupportAI. All rights reserved.</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <Monitor className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">NetSupportAI Client Portal</span>
            </div>

            <div className="card p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Client Sign In</h2>
              <p className="text-sm text-slate-500 mb-6">Enter your credentials to access the portal</p>

              <form onSubmit={doLogin} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input className="input" type="email" required autoFocus placeholder="you@company.com"
                    value={creds.email} onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" required placeholder="••••••••"
                    value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} />
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-1" disabled={logging}>
                  {logging ? 'Signing in…' : <><LogIn className="w-4 h-4" />Sign in</>}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-xs text-slate-400 text-center">
                  Staff member?{' '}
                  <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium transition-all duration-200">
                    Go to staff login <ArrowRight className="inline w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              <span>Secured with JWT + bcrypt</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal header */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-sm">NetSupportAI</span>
          <span className="text-slate-400 text-sm">/</span>
          <span className="text-slate-500 text-sm">Client Portal</span>
        </div>
        <span className="text-sm text-slate-500">
          Welcome, <span className="text-slate-900 font-medium">{user?.full_name}</span>
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">My Support Tickets</h1>
            <p className="page-sub">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />New Ticket
          </button>
        </div>

        {/* New ticket form */}
        {showForm && (
          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Submit a Support Request</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className="label">Issue Title *</label>
                <input className="input" required placeholder="Brief description of the issue"
                  value={newTicket.title} onChange={(e) => setNewTicket((t) => ({ ...t, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input h-28 resize-none" placeholder="Please describe the issue in detail…"
                  value={newTicket.description} onChange={(e) => setNewTicket((t) => ({ ...t, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input w-40" value={newTicket.priority}
                  onChange={(e) => setNewTicket((t) => ({ ...t, priority: e.target.value }))}>
                  {['low', 'medium', 'high', 'critical'].map((p) => (
                    <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-1 border-t border-slate-100">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Ticket'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Ticket list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No tickets yet"
              description="Submit a support request and our team will get back to you."
              action={() => setShowForm(true)}
              actionLabel="Submit your first ticket"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-all duration-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
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
