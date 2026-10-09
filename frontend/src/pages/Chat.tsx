import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { streamText } from '../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const history: Message[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    setError(null)
    try {
      let reply = ''
      await streamText('/ai/chat', { messages: history }, (chunk) => {
        reply += chunk
        setMessages([...history, { role: 'assistant', content: reply }])
      })
    } catch (err) {
      setMessages(history)
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">AI Chat</h1>
      <Card className="min-h-64 space-y-3">
        {messages.length === 0 && <p className="text-muted">Ask anything to get started.</p>}
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'text-right' : ''}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-left text-sm ${
                message.role === 'user' ? 'bg-brand text-white' : 'bg-panel-2'
              }`}
            >
              {message.content || '…'}
            </span>
          </div>
        ))}
      </Card>
      <ErrorText>{error}</ErrorText>
      <form onSubmit={send} className="flex gap-2">
        <Input placeholder="Type a message…" value={input} onChange={(event) => setInput(event.target.value)} />
        <Button type="submit" disabled={busy}>
          {busy ? '…' : 'Send'}
        </Button>
      </form>
    </div>
  )
}
