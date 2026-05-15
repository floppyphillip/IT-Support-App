import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Ticket, Server, Users, Bot, Terminal,
  AlertTriangle, Settings, Monitor, LogOut,
} from 'lucide-react'
import useAuth from '../hooks/useAuth'

const NAV_ALL = [
  { to: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/tickets',       label: 'Tickets',         icon: Ticket },
  { to: '/devices',       label: 'Devices',         icon: Server },
  { to: '/clients',       label: 'Clients',         icon: Users },
  { to: '/alerts',        label: 'Alerts',          icon: AlertTriangle },
  { to: '/ai-diagnostics',label: 'AI Diagnostics',  icon: Bot },
  { to: '/remote-access', label: 'Remote Access',   icon: Terminal },
  { to: '/settings',      label: 'Settings',        icon: Settings },
]

export default function Sidebar() {
  const { user, logout, isSuperadmin, isEngineer } = useAuth()

  // Clients only see tickets and settings
  const nav = (isSuperadmin?.() || isEngineer?.())
    ? NAV_ALL
    : NAV_ALL.filter((n) => ['/tickets', '/settings'].includes(n.to))

  return (
    <aside className="w-60 flex flex-col flex-shrink-0" style={{ backgroundColor: '#0f172a' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Monitor className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-none">NetSupportAI</p>
          <p className="text-slate-500 text-xs mt-0.5">IT Support Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-xs font-bold">
            {user?.full_name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-slate-400 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-white p-1 transition"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
