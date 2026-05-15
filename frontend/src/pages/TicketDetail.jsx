import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ticketsAPI, aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Bot, MessageSquare, Trash2, Send, Clock, Shield } from 'lucide-react'

const STATUS_OPTIONS = ['open', 'in_progress', 'ai_resolved', 'escalated', 'closed']

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
      const { data: t } = await ticketsAPI.get(id)
      setTicket(t)
    } catch { navigate('/tickets') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const updateStatus = async (status) => {
    try {
      const { data } = await ticketsAPI.update(id, { status })
      setTicket(data)
      toast.success('Status updated')
    } catch { toast.error('Failed to update status') }
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

  const runAIDiagnosis = async () => {
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

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!ticket) return null

  const slaOk = ticket.sla_deadline && new Date(ticket.sla_deadline) > new Date()

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/tickets" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
            <AlertBadge priority={ticket.priority} />
            <StatusIndicator status={ticket.status} />
            {ticket.sla_deadline && (
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${slaOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <Clock className="w-3 h-3" />
                SLA {slaOk ? formatDistanceToNow(new Date(ticket.sla_deadline), { addSuffix: true }) : 'BREACHED'}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{ticket.title}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={runAIDiagnosis} className="btn-secondary" disabled={diagnosing}>
            <Bot className="w-4 h-4" />
            {diagnosing ? 'Analysing…' : 'AI Diagnose'}
          </button>
          <button onClick={deleteTicket} className="btn-danger"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap">{ticket.description || 'No description.'}</p>
            {ticket.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {ticket.tags.map((tag) => (
                  <span key={tag} className="badge bg-gray-100 text-gray-600">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* AI Diagnosis */}
          {ticket.ai_diagnosis && (
            <div className="card p-6 border-l-4 border-brand-500">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-brand-500" />
                <h2 className="font-semibold text-brand-700">AI Diagnosis</h2>
                {ticket.ai_confidence_score != null && (
                  <span className="badge bg-brand-50 text-brand-700 ml-auto">
                    {Math.round(ticket.ai_confidence_score * 100)}% confidence
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 mb-3">{ticket.ai_diagnosis}</p>
              {ticket.ai_structured?.root_cause && (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-1">Root Cause</p>
                  <p className="text-sm text-gray-800 mb-4">{ticket.ai_structured.root_cause}</p>
                </>
              )}
              {ticket.ai_structured?.fix_steps?.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-500 mb-2">Fix Steps</p>
                  <ol className="space-y-1.5">
                    {ticket.ai_structured.fix_steps.map((step, i) => (
                      <li key={i} className="text-sm text-gray-700">
                        <span className="font-medium text-gray-500">{i + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {ticket.ai_cli_commands?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">CLI Commands</p>
                  <div className="space-y-1">
                    {ticket.ai_cli_commands.map((cmd, i) => (
                      <code key={i} className="block text-xs bg-gray-900 text-green-400 rounded px-3 py-1.5 font-mono">
                        {cmd}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message thread */}
          <div className="card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Messages ({ticket.messages?.length ?? 0})
            </h2>
            <div className="space-y-4 mb-6">
              {ticket.messages?.length === 0 && (
                <p className="text-sm text-gray-400">No messages yet.</p>
              )}
              {ticket.messages?.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.is_internal ? 'opacity-80' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    m.is_ai_generated ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {m.is_ai_generated ? <Bot className="w-4 h-4" /> : (m.sender?.full_name?.[0] ?? '?')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium">
                        {m.is_ai_generated ? 'AI Assistant' : (m.sender?.full_name ?? 'System')}
                      </span>
                      {m.is_internal && (
                        <span className="badge bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> internal
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className={`text-sm whitespace-pre-wrap ${
                      m.is_ai_generated ? 'text-gray-700' : 'text-gray-800'
                    }`}>{m.message}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submitMessage} className="space-y-2">
              <textarea
                className="input resize-none h-20"
                placeholder="Add a message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded"
                  />
                  Internal note (not visible to client)
                </label>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Status</h3>
            <select
              className="input"
              value={ticket.status}
              onChange={(e) => updateStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="card p-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="capitalize">{ticket.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Priority</span>
              <AlertBadge priority={ticket.priority} />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created by</span>
              <span>{ticket.created_by?.full_name ?? '–'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Assigned to</span>
              <span>{ticket.assigned_engineer?.full_name ?? 'Unassigned'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
            </div>
            {ticket.closed_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Closed</span>
                <span>{new Date(ticket.closed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {ticket.resolution_notes && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Resolution</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.resolution_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
