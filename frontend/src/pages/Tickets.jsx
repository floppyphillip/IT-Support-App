import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ticketsAPI } from '../api/client'
import TicketCard from '../components/TicketCard'
import { Plus, Search, Filter } from 'lucide-react'

const STATUSES = ['', 'open', 'in_progress', 'pending', 'resolved', 'closed']
const PRIORITIES = ['', 'low', 'medium', 'high', 'critical']

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 20

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

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <Link to="/tickets/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-56"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p>No tickets found.</p>
          <Link to="/tickets/new" className="btn-primary mt-4 inline-flex">Create first ticket</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center gap-3 justify-center pt-2">
          <button className="btn-secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1} of {Math.ceil(total / limit)}</span>
          <button className="btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= total}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
