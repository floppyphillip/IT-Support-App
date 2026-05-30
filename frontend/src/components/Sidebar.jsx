import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Ticket, Server, Users, Bot, Terminal,
  AlertTriangle, Settings, Monitor, LogOut, ChevronLeft, ChevronRight, UserCircle2, UserPlus, Layers,
} from 'lucide-react'
import useAuth from '../hooks/useAuth'

const NAV = [
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
      { to: '/ai-diagnostics',      label: 'AI Diagnostics',      icon: Bot          },
      { to: '/devices',             label: 'NOC Devices',         icon: Server       },
      { to: '/customer-devices',    label: 'Customer Devices',    icon: Server       },
      { to: '/remote-access',       label: 'Remote Access',       icon: Terminal     },
      { to: '/customer-management', label: 'Customer Mgmt',       icon: UserCircle2  },
      { to: '/services',            label: 'Services',            icon: Layers       },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/clients',  label: 'Clients',  icon: Users    },
      { to: '/users',    label: 'Users',    icon: UserPlus },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const MOBILE_NAV = [
  { to: '/dashboard',     label: 'Home',    icon: LayoutDashboard },
  { to: '/tickets',       label: 'Tickets', icon: Ticket          },
  { to: '/devices',       label: 'Devices', icon: Server          },
  { to: '/alerts',        label: 'Alerts',  icon: AlertTriangle   },
  { to: '/settings',      label: 'More',    icon: Settings        },
]

export default function Sidebar() {
  const { user, logout, isSuperadmin, isEngineer } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const isStaff = isSuperadmin?.() || isEngineer?.()

  const groups = NAV.map((g) => ({
    ...g,
    items: isStaff ? g.items : g.items.filter((n) => ['/tickets', '/settings'].includes(n.to)),
  })).filter((g) => g.items.length)

  return (
    <>
      {/* Desktop */}
      <aside
        className={`hidden md:flex flex-col flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}
        style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}
      >
        {/* Logo */}
        <div
          className={`flex items-center flex-shrink-0 h-11 ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'}`}
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-3.5 h-3.5 text-white" />
          </div>
          {!collapsed && (
            <span style={{ color: 'var(--text-1)', fontSize: 19, fontWeight: 600, lineHeight: 'var(--lh-small)' }}>
              NetSupportAI
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              {!collapsed && (
                <p
                  className="px-2 mb-1 uppercase tracking-widest"
                  style={{ color: 'var(--text-4)', fontSize: 13, letterSpacing: '0.08em' }}
                >
                  {g.label}
                </p>
              )}
              <div className="space-y-px">
                {g.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center rounded-lg transition-all duration-150 relative ${
                        collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
                      } ${isActive ? 'text-blue-400' : 'text-[var(--text-3)] hover:text-[var(--text-1)]'}`
                    }
                    style={({ isActive }) => isActive
                      ? { background: 'var(--blue-dim)', color: 'var(--blue-text)' }
                      : {}}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                            style={{ background: 'var(--blue)' }}
                          />
                        )}
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {!collapsed && (
                          <span style={{ fontSize: 18, fontWeight: 500, lineHeight: 'var(--lh-regular)' }}>
                            {label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center mx-2 mb-1 py-1.5 rounded-lg transition-all duration-150"
          style={{ color: 'var(--text-4)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)'; }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* User footer */}
        <div className="px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div
            className={`flex items-center rounded-lg p-2 cursor-pointer transition-all duration-150 group ${collapsed ? 'justify-center' : 'gap-2'}`}
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'var(--blue)', fontSize: 15, fontWeight: 700 }}
            >
              {user?.full_name?.[0] ?? '?'}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p style={{ color: 'var(--text-1)', fontSize: 17, fontWeight: 600, lineHeight: 'var(--lh-small)' }} className="truncate">
                    {user?.full_name}
                  </p>
                  <p style={{ color: 'var(--text-4)', fontSize: 15, lineHeight: 'var(--lh-small)' }} className="truncate capitalize">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ color: 'var(--text-4)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-4)'; }}
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{ background: 'var(--sidebar)', borderTop: '1px solid var(--border)' }}
      >
        {(isStaff ? MOBILE_NAV : MOBILE_NAV.filter((n) => ['/tickets', '/settings'].includes(n.to))).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all duration-150 ${
                isActive ? 'text-blue-400' : 'text-[var(--text-4)]'
              }`
            }
            style={{ fontSize: 13 }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
