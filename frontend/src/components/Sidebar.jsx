import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Ticket, Server, Users, Bot, Terminal,
  AlertTriangle, Settings, Monitor, LogOut, ChevronRight,
} from 'lucide-react'
import useAuth from '../hooks/useAuth'

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, color: '#0073EA' },
      { to: '/tickets',        label: 'Tickets',        icon: Ticket,          color: '#00875A' },
      { to: '/devices',        label: 'Devices',        icon: Server,          color: '#7C3AED' },
      { to: '/clients',        label: 'Clients',        icon: Users,           color: '#D97706' },
      { to: '/alerts',         label: 'Alerts',         icon: AlertTriangle,   color: '#DC2626' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/ai-diagnostics', label: 'AI Diagnostics', icon: Bot,             color: '#0891B2' },
      { to: '/remote-access',  label: 'Remote Access',  icon: Terminal,        color: '#374151' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/settings',       label: 'Settings',       icon: Settings,        color: '#6B7280' },
    ],
  },
]

export default function Sidebar() {
  const { user, logout, isSuperadmin, isEngineer } = useAuth()
  const isStaff = isSuperadmin?.() || isEngineer?.()

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: isStaff
      ? group.items
      : group.items.filter((n) => ['/tickets', '/settings'].includes(n.to)),
  })).filter((g) => g.items.length > 0)

  return (
    <aside className="w-56 flex flex-col flex-shrink-0 bg-white border-r border-zoho-border">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zoho-border">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0">
          <Monitor className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zoho-text leading-none truncate">NetSupportAI</p>
          <p className="text-[10px] text-zoho-muted mt-0.5 leading-none">IT Support Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, color }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative',
                      isActive
                        ? 'bg-brand-50 text-brand-600'
                        : 'text-zoho-muted hover:bg-zoho-body hover:text-zoho-text'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-r-full" />
                      )}
                      <Icon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: isActive ? '#0073EA' : color }}
                      />
                      <span className="truncate">{label}</span>
                      {isActive && (
                        <ChevronRight className="w-3 h-3 ml-auto text-brand-400" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-zoho-border">
        <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-zoho-body transition group">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zoho-text truncate">{user?.full_name}</p>
            <p className="text-[10px] text-zoho-muted capitalize truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
