import { useEffect, useRef, useState, useCallback } from 'react'

export default function useWebSocket(url, { onMessage, onOpen, onClose, enabled = true } = {}) {
  const ws = useRef(null)
  const [status, setStatus] = useState('disconnected') // connecting | open | closed | error
  const reconnectTimer = useRef(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!enabled || !url) return
    if (ws.current?.readyState === WebSocket.OPEN) return

    setStatus('connecting')
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      if (!mountedRef.current) return
      setStatus('open')
      onOpen?.()
    }

    socket.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch {
        onMessage?.(event.data)
      }
    }

    socket.onclose = () => {
      if (!mountedRef.current) return
      setStatus('closed')
      onClose?.()
      // Reconnect after 5s
      reconnectTimer.current = setTimeout(connect, 5000)
    }

    socket.onerror = () => {
      if (!mountedRef.current) return
      setStatus('error')
    }
  }, [url, enabled, onMessage, onOpen, onClose])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  return { status, send, ws }
}
