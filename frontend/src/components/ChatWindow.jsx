import { useState, useRef, useEffect } from 'react'
import { Bot, User, Send, Trash2 } from 'lucide-react'
import useAuth from '../hooks/useAuth'

const INITIAL = [
  { role: 'assistant', content: "Hi! I'm your NetSupportAI assistant. I specialise in network diagnostics, device troubleshooting, and IT support. How can I help you today?" },
]

export default function ChatWindow() {
  const { accessToken } = useAuth()
  const [messages, setMessages] = useState(INITIAL)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const abortRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    const userMsg = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)
    setMessages((m) => [...m, { role: 'assistant', content: '' }])

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: (abortRef.current = new AbortController()).signal,
      })
      if (!response.ok) throw new Error('Stream failed')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (raw === '[DONE]') break
          try {
            const { token } = JSON.parse(raw)
            if (token) {
              setMessages((m) => {
                const updated = [...m]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + token }
                return updated
              })
            }
          } catch { /* ignore malformed SSE */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((m) => { const u = [...m]; u[u.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }; return u })
      }
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const clear = () => { abortRef.current?.abort(); setMessages(INITIAL); setStreaming(false) }

  return (
    <div className="card flex flex-col" style={{ height: 560 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Support Chat</p>
            {streaming && <p className="text-xs text-blue-400 animate-pulse">thinking…</p>}
          </div>
        </div>
        <button onClick={clear} title="Clear chat" className="btn-ghost p-1.5">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-600' : 'bg-blue-500/20'}`}>
              {m.role === 'user' ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-blue-400" />}
            </div>
            <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'text-gray-700 rounded-tl-sm'
            }`}
            style={m.role !== 'user' ? { background: '#f1f5f9' } : {}}>
              {m.content || <span className="opacity-40 italic text-xs">…</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="p-4 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb' }}>
        <textarea
          ref={inputRef} rows={1}
          className="input flex-1 text-sm resize-none"
          placeholder="Ask about network issues, devices, troubleshooting…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
          disabled={streaming}
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />
        <button type="submit" className="btn-primary px-3 self-end" disabled={streaming || !input.trim()}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
