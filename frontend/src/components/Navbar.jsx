import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { LogOut, Bell, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { alertsAPI } from '../api/client'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    alertsAPI.list({ is_resolved: false, limit: 1 })
      .then(({ data }) => setAlertCount(data.active_count ?? 0))
      .catch(() => {})
  }, [])

  const doLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/tickets/new')} className="btn-primary py-1.5">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          title="Alerts"
        >
          <Bell className="w-5 h-5" />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold">
            {user?.full_name?.[0] ?? '?'}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.full_name}</span>
        </div>

        <button
          onClick={doLogout}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
