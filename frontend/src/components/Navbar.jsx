import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { Bell, Plus, Search, LogOut } from 'lucide-react'
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
    <header
      className="h-11 flex items-center gap-3 px-4 flex-shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--text-4)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, devices, clients…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg transition-all duration-150 focus:outline-none"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-mid)',
              color: 'var(--text-2)',
              fontSize: 17,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--blue-dim)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </form>

      <div className="flex-1" />

      {/* New Ticket */}
      <button onClick={() => navigate('/tickets/new')} className="btn-primary hidden sm:inline-flex">
        <Plus className="w-3 h-3" />New Ticket
      </button>

      {/* Alerts bell */}
      <button
        onClick={() => navigate('/alerts')}
        className="relative p-1.5 rounded-lg transition-all duration-150"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
        title="Alerts"
      >
        <Bell className="w-3.5 h-3.5" />
        {alertCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 w-3 h-3 text-white rounded-full flex items-center justify-center font-bold"
            style={{ background: '#ef4444', fontSize: 12 }}
          >
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-5" style={{ background: 'var(--border-mid)' }} />

      {/* User */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: 'var(--blue)', fontSize: 15, fontWeight: 700 }}
        >
          {user?.full_name?.[0] ?? '?'}
        </div>
        <div className="hidden sm:block">
          <p style={{ color: 'var(--text-1)', fontSize: 17, fontWeight: 600, lineHeight: 'var(--lh-small)' }}>
            {user?.full_name}
          </p>
          <p style={{ color: 'var(--text-4)', fontSize: 15, lineHeight: 'var(--lh-small)' }} className="capitalize">
            {user?.role?.replace('_', ' ')}
          </p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 rounded-lg transition-all duration-150 ml-1"
          style={{ color: 'var(--text-4)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = '#f87171'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)'; }}
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  )
}
