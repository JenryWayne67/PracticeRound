import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import { api } from '../lib/api'

const features = [
  { title: 'Auth', text: 'Register, log in, JWT sessions, protected routes.', to: '/login' },
  { title: 'CRUD', text: 'Items example: database model, API, and UI end to end.', to: '/items' },
  { title: 'AI chat', text: 'Streaming Claude responses through your backend.', to: '/chat' },
]

export default function Home() {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    api
      .get('/health')
      .then(() => setOnline(true))
      .catch(() => setOnline(false))
  }, [])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight">Your idea goes here.</h1>
        <p className="mt-3 max-w-xl text-slate-600">
          One sentence on the problem, one on how you solve it. Replace this page first — it is what judges see.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Backend:{' '}
          {online === null ? 'checking…' : online ? '🟢 connected' : '🔴 not reachable — is it running on port 8000?'}
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Link key={feature.title} to={feature.to}>
            <Card className="h-full transition hover:border-brand">
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{feature.text}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
