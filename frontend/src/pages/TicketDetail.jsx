import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ticketsAPI, aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { Skeleton } from '../components/Skeleton'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Bot, MessageSquare, Trash2, Send, Clock, Shield } from 'lucide-react'

const STATUS_OPTIONS = ['open', 'in_progress', 'ai_resolved', 'escalated', 'pending', 'resolved', 'closed']

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)

  const load = async () => {
    try {
      const { data } = await ticketsAPI.get(id)
      setTicket(data)
    } catch { navigate('/tickets') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const updateStatus = async (status) => {
    try {
      const { data } = await ticketsAPI.update(id, { status })
      setTicket(data)
      toast.success('Status updated')
    } catch { toast.error('Failed') }
  }

  const submitMessage = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    try {
      await ticketsAPI.addMessage(id, { message, is_internal: isInternal })
      setMessage('')
      await load()
    } catch { toast.error('Failed to post message') }
    finally { setSubmitting(false) }
  }

  const runAI = async () => {
    setDiagnosing(true)
    try {
      await aiAPI.diagnose({ ticket_id: id, description: ticket?.description || ticket?.title })
      toast.success('AI diagnosis complete')
      await load()
    } catch { toast.error('AI diagnosis failed') }
    finally { setDiagnosing(false) }
  }

  const deleteTicket = async () => {
    if (!confirm('Delete this ticket?')) return
    await ticketsAPI.delete(id)
    toast.success('Ticket deleted')
    navigate('/tickets')
  }

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }
  if (!ticket) return null

  const slaOk = ticket.sla_deadline && new Date(ticket.sla_deadline) > new Date()

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex items-start gap-3">
        <Link to="/tickets" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200 mt-0.5 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono text-slate-400">{ticket.ticket_number}</span>
            <AlertBadge priority={ticket.priority} />
            <StatusIndicator status={ticket.status} />
            {ticket.sla_deadline && (
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${slaOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                <Clock className="w-3 h-3" />
                SLA {slaOk ? formatDistanceToNow(new Date(ticket.sla_deadline), { addSuffix: true }) : 'BREACHED'}
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold text-slate-900">{ticket.title}</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={runAI} className="btn-secondary" disabled={diagnosing}>
            <Bot className="w-4 h-4" />{diagnosing ? 'Analysing…' : 'AI Diagnose'}
          </button>
          <button onClick={deleteTicket} className="btn-danger py-2 px-3"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Description</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{ticket.description || 'No description provided.'}</p>
            {ticket.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                {ticket.tags.map((tag) => <span key={tag} className="badge bg-slate-100 text-slate-600 border border-slate-200">#{tag}</span>)}
              </div>
            )}
          </div>

          {/* AI Diagnosis */}
          {ticket.ai_diagnosis && (
            <div className="card p-5 border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-blue-700">AI Diagnosis</h2>
                {ticket.ai_confidence_score != null && (
                  <span className="badge bg-blue-50 text-blue-700 border border-blue-100 ml-auto">
                    {Math.round(ticket.ai_confidence_score * 100)}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 mb-3 leading-relaxed">{ticket.ai_diagnosis}</p>
              {ticket.ai_structured?.root_cause && (
                <div className="mb-3">
                  <p className="label">Root Cause</p>
                  <p className="text-sm text-slate-700">{ticket.ai_structured.root_cause}</p>
                </div>
              )}
              {ticket.ai_structured?.fix_steps?.length > 0 && (
                <div className="mb-3">
                  <p className="label">Fix Steps</p>
                  <ol className="space-y-1.5">
                    {ticket.ai_structured.fix_steps.map((step, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="font-semibold text-slate-400 flex-shrink-0">{i + 1}.</span>{step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {ticket.ai_cli_commands?.length > 0 && (
                <div>
                  <p className="label">CLI Commands</p>
                  <div className="space-y-1">
                    {ticket.ai_cli_commands.map((cmd, i) => (
                      <code key={i} className="cli-block">{cmd}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              Messages ({ticket.messages?.length ?? 0})
            </h2>
            <div className="space-y-4 mb-5">
              {!ticket.messages?.length && <p className="text-sm text-slate-400">No messages yet.</p>}
              {ticket.messages?.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.is_internal ? 'opacity-70' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${m.is_ai_generated ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {m.is_ai_generated ? <Bot className="w-4 h-4" /> : (m.sender?.full_name?.[0] ?? '?')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{m.is_ai_generated ? 'AI Assistant' : (m.sender?.full_name ?? 'System')}</span>
                      {m.is_internal && (
                        <span className="badge bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> internal
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitMessage} className="space-y-2 pt-4 border-t border-slate-100">
              <textarea className="input resize-none h-20" placeholder="Add a message…" value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
                  Internal note
                </label>
                <button type="submit" className="btn-primary" disabled={submitting || !message.trim()}>
                  <Send className="w-3.5 h-3.5" />{submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <p className="label mb-2">Status</p>
            <select className="input" value={ticket.status} onChange={(e) => updateStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="card p-4">
            <p className="label mb-3">Details</p>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Category', <span className="capitalize">{ticket.category}</span>],
                ['Priority', <AlertBadge priority={ticket.priority} />],
                ['Created by', ticket.created_by?.full_name ?? '—'],
                ['Assigned to', ticket.assigned_engineer?.full_name ?? 'Unassigned'],
                ['Created', new Date(ticket.created_at).toLocaleDateString()],
                ...(ticket.closed_at ? [['Closed', new Date(ticket.closed_at).toLocaleDateString()]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 flex-shrink-0">{k}</dt>
                  <dd className="text-right text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {ticket.resolution_notes && (
            <div className="card p-4">
              <p className="label mb-2">Resolution</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ticket.resolution_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
