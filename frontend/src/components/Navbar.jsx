import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { Bell, Plus, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { alertsAPI } from '../api/client'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    alertsAPI.list({ is_resolved: false, limit: 1 })
      .then(({ data }) => setAlertCount(data.active_count ?? 0))
      .catch(() => {})
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) navigate(`/tickets?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <header className="h-14 flex items-center gap-3 px-4 flex-shrink-0" style={{ background: '#182035', borderBottom: '1px solid #1e2d47' }}>
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, devices, clients…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg text-slate-300 placeholder-slate-600 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            style={{ background: '#0d1526', border: '1px solid #253046' }}
          />
        </div>
      </form>

      <div className="flex-1" />

      {/* New Ticket */}
      <button onClick={() => navigate('/tickets/new')} className="btn-primary py-1.5 text-xs hidden sm:inline-flex">
        <Plus className="w-3.5 h-3.5" />New Ticket
      </button>

      {/* Alerts bell */}
      <button
        onClick={() => navigate('/alerts')}
        className="relative p-2 text-slate-500 hover:text-slate-200 rounded-lg transition-all duration-200"
        style={{ background: 'transparent' }}
        title="Alerts"
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* User avatar */}
      <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid #1e2d47' }}>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
          {user?.full_name?.[0] ?? '?'}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-slate-200 leading-none">{user?.full_name}</p>
          <p className="text-[10px] text-slate-500 capitalize leading-none mt-0.5">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>
    </header>
  )
}
