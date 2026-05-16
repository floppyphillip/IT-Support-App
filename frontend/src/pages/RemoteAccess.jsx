import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { remoteAPI } from '../api/client'
import { Terminal as TerminalIcon, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

function XTermPane({ session }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let term
    const init = async () => {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')
      await import('@xterm/xterm/css/xterm.css')

      term = new Terminal({
        theme: {
          background: '#020617',
          foreground: '#34d399',
          cursor: '#34d399',
          selectionBackground: '#1e3a5f',
          black: '#1e293b', brightBlack: '#475569',
          red: '#f87171',   brightRed: '#fca5a5',
          green: '#34d399', brightGreen: '#6ee7b7',
          yellow: '#fbbf24', brightYellow: '#fcd34d',
          blue: '#60a5fa',  brightBlue: '#93c5fd',
          magenta: '#c084fc', brightMagenta: '#d8b4fe',
          cyan: '#22d3ee',  brightCyan: '#67e8f9',
          white: '#e2e8f0', brightWhite: '#f8fafc',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())

      if (containerRef.current) {
        term.open(containerRef.current)
        fitAddon.fit()
        termRef.current = term

        const ro = new ResizeObserver(() => fitAddon.fit())
        ro.observe(containerRef.current)

        term.writeln('\x1b[1;32m  NetSupportAI SSH Terminal\x1b[0m')
        term.writeln(`\x1b[90m  Connecting to ${session.host}:${session.port ?? 22} as ${session.username}…\x1b[0m`)
        term.writeln('')

        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const ws = new WebSocket(
          `${proto}://${window.location.host}/api/ssh/ws?host=${encodeURIComponent(session.host)}&port=${session.port ?? 22}&username=${encodeURIComponent(session.username)}&password=${encodeURIComponent(session.password ?? '')}`
        )
        wsRef.current = ws

        ws.onopen = () => { term.writeln('\x1b[32m  Connected\x1b[0m'); term.writeln('') }
        ws.onmessage = (e) => term.write(e.data)
        ws.onclose = () => { term.writeln(''); term.writeln('\x1b[90m  Session closed.\x1b[0m') }
        ws.onerror = () => term.writeln('\x1b[31m  Connection error — check host and credentials.\x1b[0m')

        term.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data) })

        const handler = (ev) => { if (ws.readyState === WebSocket.OPEN) ws.send(ev.detail) }
        window.addEventListener(`terminal-send-${session.id}`, handler)
        return () => window.removeEventListener(`terminal-send-${session.id}`, handler)
      }
    }

    init()
    return () => { wsRef.current?.close(); term?.dispose() }
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}

export default function RemoteAccess() {
  const [searchParams] = useSearchParams()
  const { accessToken } = useAuth()
  const [panelOpen, setPanelOpen] = useState(true)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [commands, setCommands] = useState([])
  const [filterVendor, setFilterVendor] = useState('all')
  const [form, setForm] = useState({
    host: searchParams.get('host') ?? '',
    port: '22',
    username: searchParams.get('user') ?? 'admin',
    password: '',
  })

  useEffect(() => {
    remoteAPI.getCommandPalette()
      .then(({ data }) => setCommands(data.commands || []))
      .catch(() => {})
  }, [])

  const connect = (e) => {
    e.preventDefault()
    const session = { ...form, id: Date.now() }
    setSessions((s) => [...s, session])
    setActiveSession(session.id)
    setForm((f) => ({ ...f, password: '' }))
  }

  const closeSession = (id) => {
    setSessions((s) => s.filter((x) => x.id !== id))
    setActiveSession((cur) => (cur === id ? (sessions.find((x) => x.id !== id)?.id ?? null) : cur))
  }

  const sendCommand = (cmd) => {
    window.dispatchEvent(new CustomEvent(`terminal-send-${activeSession}`, { detail: cmd + '\r' }))
  }

  const vendors = ['all', ...new Set(commands.map((c) => c.vendor).filter(Boolean))]
  const filteredCommands = filterVendor === 'all' ? commands : commands.filter((c) => c.vendor === filterVendor)

  return (
    <div className="flex animate-fade-in" style={{ height: 'calc(100vh - 4rem)', margin: '-1.25rem' }}>
      {/* Left panel */}
      <div className={`flex flex-col bg-white border-r border-slate-100 transition-all duration-200 flex-shrink-0 overflow-hidden ${panelOpen ? 'w-72' : 'w-0'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
          <TerminalIcon className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-900">SSH Connect</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <form onSubmit={connect} className="space-y-3">
            <div>
              <label className="label">Host / IP *</label>
              <input className="input" required placeholder="192.168.1.1" value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Port</label>
                <input className="input" placeholder="22" value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" required placeholder="admin" value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">
              <Plus className="w-4 h-4" />Open Session
            </button>
          </form>

          {commands.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Quick Commands</p>
                <select className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white transition-all duration-200"
                  value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)}>
                  {vendors.map((v) => (
                    <option key={v} value={v}>{v === 'all' ? 'All vendors' : v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                {filteredCommands.map((cmd, i) => (
                  <button key={i} onClick={() => sendCommand(cmd.command)} disabled={!activeSession}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="font-medium block">{cmd.label}</span>
                    <span className="text-slate-400 font-mono truncate block mt-0.5">{cmd.command}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button onClick={() => setPanelOpen((o) => !o)}
        className="absolute z-10 top-1/2 -translate-y-1/2 w-5 h-10 bg-white border border-slate-200 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all duration-200 shadow-sm flex-shrink-0"
        style={{ left: panelOpen ? '288px' : '0' }}>
        {panelOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Terminal area */}
      <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
        {/* Session tabs */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-1 px-3 pt-2 bg-slate-900 border-b border-slate-800 overflow-x-auto flex-shrink-0">
            {sessions.map((s) => (
              <div key={s.id} onClick={() => setActiveSession(s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all duration-200 flex-shrink-0 select-none ${activeSession === s.id ? 'bg-slate-950 text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                <TerminalIcon className="w-3 h-3" />
                <span>{s.username}@{s.host}</span>
                <button onClick={(e) => { e.stopPropagation(); closeSession(s.id) }}
                  className="ml-1 opacity-60 hover:opacity-100 transition-all duration-200">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 relative">
          {sessions.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                <TerminalIcon className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-400 mb-1">No active sessions</h3>
              <p className="text-sm text-slate-600 max-w-xs">Enter connection details on the left panel and click "Open Session" to start.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className={`absolute inset-0 p-3 ${activeSession === s.id ? 'block' : 'hidden'}`}>
                <XTermPane session={s} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
