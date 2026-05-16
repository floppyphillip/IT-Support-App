import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ticketsAPI } from '../api/client'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { Plus, Search, ChevronLeft, ChevronRight, Bot, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUSES = ['', 'open', 'in_progress', 'pending', 'ai_resolved', 'escalated', 'resolved', 'closed']

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 25

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await ticketsAPI.list({
        skip: page * limit, limit,
        status: statusFilter || undefined,
        search: search || undefined,
      })
      setTickets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, statusFilter])
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-sub">{total} total</p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zoho-muted" />
          <input
            className="input pl-9 w-56 text-sm"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <select
          className="input w-44 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-gray-50 border-b border-zoho-border">
          <span className="th w-20">Ticket #</span>
          <span className="th">Title</span>
          <span className="th">Status</span>
          <span className="th">Priority</span>
          <span className="th">Assigned</span>
          <span className="th">Created</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zoho-muted text-sm">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-zoho-muted text-sm mb-3">No tickets found.</p>
            <Link to="/tickets/new" className="btn-primary">Create first ticket</Link>
          </div>
        ) : (
          <div>
            {tickets.map((t) => (
              <Link key={t.id} to={`/tickets/${t.id}`} className="block group">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-zoho-border last:border-0 hover:bg-zoho-body transition-colors">
                  <span className="text-xs font-mono text-zoho-muted w-20 truncate">{t.ticket_number}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zoho-text group-hover:text-brand-500 transition-colors truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zoho-muted">
                      <span className="capitalize">{t.category}</span>
                      {t.ai_diagnosis && !t.ai_diagnosis.error && (
                        <span className="flex items-center gap-0.5 text-violet-600"><Bot className="w-3 h-3" /> AI</span>
                      )}
                    </div>
                  </div>
                  <StatusIndicator status={t.status} />
                  <AlertBadge priority={t.priority} />
                  <span className="text-xs text-zoho-muted">
                    {t.assigned_technician ? (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{t.assigned_technician.full_name}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </span>
                  <span className="text-xs text-zoho-muted whitespace-nowrap">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-zoho-muted">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-zoho-text font-medium">{page + 1} / {totalPages}</span>
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
