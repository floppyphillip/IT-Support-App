import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Terminal from '../components/Terminal'
import useAuth from '../hooks/useAuth'
import { remoteAPI } from '../api/client'
import { Terminal as TerminalIcon, X, ChevronRight, Cpu } from 'lucide-react'

export default function RemoteAccess() {
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuth()
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [form, setForm] = useState({
    host: searchParams.get('host') ?? '',
    username: searchParams.get('user') ?? 'admin',
    password: '',
    port: '22',
  })
  const [commands, setCommands] = useState([])
  const [filterVendor, setFilterVendor] = useState('all')

  useEffect(() => {
    remoteAPI.getCommandPalette()
      .then(({ data }) => setCommands(data.commands || []))
      .catch(() => {})
  }, [])

  const connect = (e) => {
    e.preventDefault()
    const session = { ...form, id: Date.now(), port: parseInt(form.port) }
    setSessions((s) => [...s, session])
    setActiveSession(session.id)
    setForm((f) => ({ ...f, password: '' }))
  }

  const filteredCommands = filterVendor === 'all'
    ? commands
    : commands.filter((c) => c.vendor === filterVendor)

  const vendors = ['all', ...new Set(commands.map((c) => c.vendor))]

  const sendCommand = (cmd) => {
    window.dispatchEvent(new CustomEvent('terminal-send', { detail: cmd + '\r' }))
  }

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
      <div className="mb-4">
        <h1 className="page-title flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-zoho-muted" /> Remote Access
        </h1>
        <p className="page-sub">Browser-based SSH terminal via WebSocket</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-64 flex-shrink-0 space-y-3 overflow-y-auto">
          {/* Connection form */}
          <form onSubmit={connect} className="card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-zoho-text uppercase tracking-wide">New Connection</h2>
            <div>
              <label className="label">Host / IP *</label>
              <input
                className="input"
                required
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="192.168.1.1"
              />
            </div>
            <div>
              <label className="label">Username *</label>
              <input
                className="input"
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="or use SSH key"
              />
            </div>
            <div>
              <label className="label">Port</label>
              <input
                className="input"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">
              <TerminalIcon className="w-3.5 h-3.5" /> Connect
            </button>
          </form>

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="card p-3">
              <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wide mb-2">Sessions</p>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    className={`flex-1 text-left text-sm px-2.5 py-1.5 rounded-md transition ${
                      activeSession === s.id
                        ? 'bg-brand-50 text-brand-600 font-medium'
                        : 'hover:bg-zoho-body text-zoho-muted hover:text-zoho-text'
                    }`}
                    onClick={() => setActiveSession(s.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      <TerminalIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate text-xs">{s.username}@{s.host}</span>
                    </span>
                  </button>
                  <button
                    className="text-gray-300 hover:text-red-400 p-1 flex-shrink-0"
                    onClick={() => {
                      setSessions((ss) => ss.filter((x) => x.id !== s.id))
                      if (activeSession === s.id) {
                        setActiveSession(sessions.find((x) => x.id !== s.id)?.id ?? null)
                      }
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Command palette */}
          {commands.length > 0 && (
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-3.5 h-3.5 text-zoho-muted" />
                <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wide">Commands</p>
              </div>
              <select
                className="input text-xs mb-2"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
              >
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v === 'all' ? 'All vendors' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
              <div className="space-y-0.5">
                {filteredCommands.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => sendCommand(cmd.command)}
                    disabled={!activeSession}
                    className="w-full text-left flex items-center justify-between px-2 py-1.5 text-xs rounded-md hover:bg-zoho-body disabled:opacity-40 disabled:cursor-not-allowed group transition-colors"
                  >
                    <span className="text-zoho-text truncate">{cmd.label}</span>
                    <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-brand-500 flex-shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="flex-1 min-w-0 rounded-lg overflow-hidden border border-zoho-border">
          {activeSession ? (
            <Terminal
              key={activeSession}
              session={sessions.find((s) => s.id === activeSession)}
              token={accessToken}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-900">
              <div className="text-center text-gray-600">
                <TerminalIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Connect to a device to open a terminal</p>
                <p className="text-xs mt-1 opacity-50">Commands from the palette are sent to the active session</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
