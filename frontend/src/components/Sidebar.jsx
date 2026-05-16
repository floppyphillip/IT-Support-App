import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Ticket, Server, Users, Bot, Terminal,
  AlertTriangle, Settings, Monitor, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import useAuth from '../hooks/useAuth'

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
      { to: '/tickets',        label: 'Tickets',        icon: Ticket          },
      { to: '/alerts',         label: 'Alerts',         icon: AlertTriangle   },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/ai-diagnostics', label: 'AI Diagnostics', icon: Bot      },
      { to: '/devices',        label: 'Devices',        icon: Server   },
      { to: '/remote-access',  label: 'Remote Access',  icon: Terminal },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/clients',  label: 'Clients',  icon: Users     },
      { to: '/settings', label: 'Settings', icon: Settings  },
    ],
  },
]

const MOBILE_NAV = [
  { to: '/dashboard',      label: 'Home',    icon: LayoutDashboard },
  { to: '/tickets',        label: 'Tickets', icon: Ticket          },
  { to: '/devices',        label: 'Devices', icon: Server          },
  { to: '/alerts',         label: 'Alerts',  icon: AlertTriangle   },
  { to: '/settings',       label: 'More',    icon: Settings        },
]

function NavItem({ to, label, icon: Icon, collapsed, badge }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative ${
          isActive
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-200'
        }`
      }
      style={({ isActive }) => isActive ? { background: 'rgba(59,130,246,0.18)' } : {}}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
          )}
          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
          {!collapsed && (
            <span className="flex-1 truncate">{label}</span>
          )}
          {!collapsed && badge != null && badge > 0 && (
            <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout, isSuperadmin, isEngineer } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const isStaff = isSuperadmin?.() || isEngineer?.()

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: isStaff
      ? group.items
      : group.items.filter((n) => ['/tickets', '/settings'].includes(n.to)),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
        style={{ background: '#090e1b', borderRight: '1px solid #1e2d47' }}
      >
        {/* Logo */}
        <div
          className={`flex items-center flex-shrink-0 ${collapsed ? 'justify-center p-4' : 'gap-2.5 px-4 py-4'}`}
          style={{ borderBottom: '1px solid #1e2d47' }}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none truncate">NetSupportAI</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-none">Network Operations</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon }) => (
                  <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 text-slate-600 hover:text-slate-300 rounded-lg transition-all duration-200"
            style={{ background: 'transparent' }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User footer */}
        <div className="px-2 py-3" style={{ borderTop: '1px solid #1e2d47' }}>
          <div className={`flex items-center rounded-lg p-2 transition-all duration-200 group cursor-pointer ${collapsed ? 'justify-center' : 'gap-2.5'}`}
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#1e2840'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.full_name?.[0] ?? '?'}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{user?.full_name}</p>
                  <p className="text-[10px] text-slate-500 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1 text-slate-600 hover:text-red-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex" style={{ background: '#090e1b', borderTop: '1px solid #1e2d47' }}>
        {(isStaff ? MOBILE_NAV : MOBILE_NAV.filter((n) => ['/tickets', '/settings'].includes(n.to))).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition-all duration-200 ${
                isActive ? 'text-blue-400' : 'text-slate-600'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
