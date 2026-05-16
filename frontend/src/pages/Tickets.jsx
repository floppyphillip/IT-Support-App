import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ticketsAPI } from '../api/client'
import AlertBadge from '../components/AlertBadge'
import StatusIndicator from '../components/StatusIndicator'
import { SkeletonTable } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { Plus, Search, ChevronLeft, ChevronRight, Bot, User, Ticket } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const STATUSES = ['', 'open', 'in_progress', 'pending', 'ai_resolved', 'escalated', 'resolved', 'closed']

function TicketRow({ t }) {
  return (
    <Link to={`/tickets/${t.id}`} className="block group">
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[120px_1fr_130px_100px_140px_120px] items-center gap-4 px-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-all duration-200">
        <span className="text-xs font-mono text-slate-400 truncate">{t.ticket_number}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-all duration-200 truncate">{t.title}</p>
          <p className="text-xs text-slate-400 capitalize mt-0.5">{t.category}</p>
        </div>
        <StatusIndicator status={t.status} />
        <AlertBadge priority={t.priority} />
        <span className="text-xs text-slate-500">
          {t.assigned_technician
            ? <span className="flex items-center gap-1"><User className="w-3 h-3" />{t.assigned_technician.full_name}</span>
            : <span className="text-slate-300">Unassigned</span>}
        </span>
        <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
      </div>

      {/* Mobile card */}
      <div className="md:hidden card mb-2 p-4 hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono text-slate-400">{t.ticket_number}</span>
            <p className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-all duration-200">{t.title}</p>
          </div>
          <AlertBadge priority={t.priority} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusIndicator status={t.status} />
          <span className="text-xs text-slate-400 capitalize">{t.category}</span>
          <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  )
}

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
      const { data } = await ticketsAPI.list({ skip: page * limit, limit, status: statusFilter || undefined, search: search || undefined })
      setTickets(data.items)
      setTotal(data.total)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, statusFilter])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tickets</h1>
          <p className="page-sub">{total} total</p>
        </div>
        <Link to="/tickets/new" className="btn-primary"><Plus className="w-4 h-4" /> New Ticket</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-9 w-52" placeholder="Search tickets…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <select className="input w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : tickets.length === 0 ? (
        <div className="card">
          <EmptyState icon={Ticket} title="No tickets found" description="Create your first ticket to get started tracking issues." action={() => window.location.href = '/tickets/new'} actionLabel="Create Ticket" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[120px_1fr_130px_100px_140px_120px] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100">
            <span className="th">Ticket #</span>
            <span className="th">Title</span>
            <span className="th">Status</span>
            <span className="th">Priority</span>
            <span className="th">Assigned</span>
            <span className="th">Created</span>
          </div>
          {tickets.map((t) => <TicketRow key={t.id} t={t} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage((p) => p - 1)} disabled={page === 0}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-slate-700">{page + 1} / {totalPages}</span>
            <button className="btn-secondary py-1.5 px-3" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= total}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
