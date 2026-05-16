import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { Bell, Plus, Search, HelpCircle, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { alertsAPI } from '../api/client'

export default function Navbar() {
  const { user, logout } = useAuth()
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
    <header className="h-12 bg-white border-b border-zoho-border flex items-center gap-3 px-4 flex-shrink-0">

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, devices, clients…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zoho-body border border-zoho-border rounded-md
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                       placeholder-gray-400 transition"
          />
        </div>
      </form>

      <div className="flex-1" />

      {/* New Ticket */}
      <button
        onClick={() => navigate('/tickets/new')}
        className="btn-primary py-1.5 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> New Ticket
      </button>

      {/* Help */}
      <button className="p-1.5 text-zoho-muted hover:text-zoho-text hover:bg-zoho-body rounded-md transition">
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Alerts bell */}
      <button
        onClick={() => navigate('/alerts')}
        className="relative p-1.5 text-zoho-muted hover:text-zoho-text hover:bg-zoho-body rounded-md transition"
        title="Alerts"
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* User */}
      <div className="flex items-center gap-1.5 pl-3 border-l border-zoho-border cursor-pointer group">
        <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold">
          {user?.full_name?.[0] ?? '?'}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-zoho-text leading-none">{user?.full_name}</p>
          <p className="text-[10px] text-zoho-muted capitalize leading-none mt-0.5">{user?.role?.replace('_', ' ')}</p>
        </div>
        <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
      </div>
    </header>
  )
}
