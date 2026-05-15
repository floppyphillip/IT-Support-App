import { useState, useRef, useEffect } from 'react'
import { Bot, User, Send, Trash2 } from 'lucide-react'
import useAuth from '../hooks/useAuth'

const INITIAL = [
  { role: 'assistant', content: "Hi! I'm your NetSupportAI assistant. I specialise in network diagnostics, device troubleshooting, and IT support. How can I help you today?" }
]

export default function ChatWindow() {
  const { accessToken } = useAuth()
  const [messages, setMessages] = useState(INITIAL)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMsg = { role: 'user', content: input }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)

    const assistantMsg = { role: 'assistant', content: '' }
    setMessages((m) => [...m, assistantMsg])

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
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
          const raw = line.replace('data:', '').trim()
          if (raw === '[DONE]') break
          try {
            const { token, error } = JSON.parse(raw)
            if (token) {
              setMessages((m) => {
                const updated = [...m]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + token,
                }
                return updated
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((m) => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Sorry, I encountered an error. Please try again.' }
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }

  const clear = () => {
    abortRef.current?.abort()
    setMessages(INITIAL)
    setStreaming(false)
  }

  return (
    <div className="card flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand-600" />
          <span className="font-semibold text-sm">AI Support Chat</span>
          {streaming && <span className="text-xs text-brand-500 animate-pulse">thinking…</span>}
        </div>
        <button onClick={clear} className="text-gray-400 hover:text-gray-600 p-1 rounded" title="Clear chat">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === 'user' ? 'bg-brand-600' : 'bg-gray-200'
            }`}>
              {m.role === 'user'
                ? <User className="w-3.5 h-3.5 text-white" />
                : <Bot className="w-3.5 h-3.5 text-gray-600" />}
            </div>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-sm'
                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {m.content || <span className="opacity-40 italic">…</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="p-4 border-t flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask about network issues, devices, troubleshooting steps…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button type="submit" className="btn-primary" disabled={streaming || !input.trim()}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
