import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../lib/api'
import type { AuthResponse, User } from '../lib/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  useEffect(() => {
    if (!getToken()) return
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const accept = (res: AuthResponse) => {
    setToken(res.access_token)
    setUser(res.user)
  }

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) =>
      accept(await api.post<AuthResponse>('/auth/login', new URLSearchParams({ username: email, password }))),
    register: async (email, password, name) =>
      accept(await api.post<AuthResponse>('/auth/register', { email, password, name })),
    logout: () => {
      setToken(null)
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
