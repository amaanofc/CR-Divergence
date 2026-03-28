import { useState, useRef, useEffect } from 'react'
import axios from 'axios'

export default function AnalystChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const query = input.trim()
    if (!query || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: query }])
    setLoading(true)

    try {
      const res = await axios.post('/api/analyst', { query })
      setMessages(prev => [...prev, { role: 'analyst', content: res.data.report }])
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Request failed'
      setMessages(prev => [...prev, { role: 'error', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-3">
      <div className="text-bloomberg-accent font-bold text-sm mb-2">AI ANALYST</div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <div className="text-bloomberg-muted text-xs text-center py-8">
            Ask a question about the Clash Royale meta...
            <br /><br />
            <span className="text-bloomberg-border">
              Examples: "Why is Hog Rider overvalued?" · "Which cards have the best ESR?" · "Explain Meta Momentum"
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs p-2 ${
              msg.role === 'user'
                ? 'bg-bloomberg-surface border border-bloomberg-border text-bloomberg-text ml-4'
                : msg.role === 'error'
                ? 'border border-red-700 text-red-400 bg-red-950'
                : 'border border-bloomberg-accent text-bloomberg-text'
            }`}
          >
            {msg.role === 'user' && (
              <div className="text-bloomberg-muted text-xs mb-1">YOU</div>
            )}
            {msg.role === 'analyst' && (
              <div className="text-bloomberg-accent text-xs mb-1 font-bold">CLASH MARKETS ANALYST</div>
            )}
            {msg.role === 'error' && (
              <div className="text-red-400 text-xs mb-1 font-bold">⚠ ERROR</div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="text-bloomberg-muted text-xs p-2 border border-bloomberg-border animate-pulse">
            Analyst generating report...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about the meta..."
          disabled={loading}
          className="flex-1 bg-bloomberg-surface border border-bloomberg-border text-bloomberg-text text-xs px-2 py-1.5 focus:outline-none focus:border-bloomberg-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-1.5 bg-bloomberg-accent text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          SEND
        </button>
      </form>
    </div>
  )
}
