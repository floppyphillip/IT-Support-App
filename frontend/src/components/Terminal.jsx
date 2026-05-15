import { useEffect, useRef } from 'react'

export default function Terminal({ session, token }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const wsRef = useRef(null)
  const fitRef = useRef(null)

  useEffect(() => {
    let term, ws

    async function init() {
      const { Terminal: XTerm } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      await import('@xterm/xterm/css/xterm.css')

      term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        theme: {
          background: '#111827',
          foreground: '#e5e7eb',
          cursor: '#60a5fa',
          selectionBackground: '#1e40af55',
        },
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      fitRef.current = fitAddon
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(containerRef.current)
      fitAddon.fit()
      termRef.current = term

      term.writeln('\x1b[32mConnecting to ' + session.host + '…\x1b[0m')

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${proto}://${window.location.host}/api/remote/terminal`)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({
          token,
          host: session.host,
          username: session.username,
          password: session.password,
          port: session.port,
        }))
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.status === 'connected') {
            term.writeln('\x1b[32mConnected!\x1b[0m\r\n')
          } else if (data.error) {
            term.writeln(`\x1b[31mError: ${data.error}\x1b[0m`)
          }
        } catch {
          term.write(e.data)
        }
      }

      ws.onclose = () => {
        term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m')
      }

      ws.onerror = () => {
        term.writeln('\r\n\x1b[31mConnection error.\x1b[0m')
      }

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      // Resize observer
      const ro = new ResizeObserver(() => { try { fitAddon.fit() } catch {} })
      ro.observe(containerRef.current)

      return () => { ro.disconnect() }
    }

    init()

    return () => {
      ws?.close()
      term?.dispose()
    }
  }, [session.host, session.username, session.port])

  return <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-xl overflow-hidden" />
}
