import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, login, register } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.email, form.password, form.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value }),
  })

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && <Input placeholder="Name" {...field('name')} />}
        <Input type="email" placeholder="Email" required {...field('email')} />
        <Input type="password" placeholder="Password (6+ characters)" required minLength={6} {...field('password')} />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </Button>
      </form>
      <button
        className="mt-4 text-sm text-brand hover:underline"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </Card>
  )
}
