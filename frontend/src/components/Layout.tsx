import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui'

const APP_NAME = 'InevitableCges'

// Add a page: create it in src/pages, add a <Route> in App.tsx, add a link here.
const links = [
  { to: '/', label: 'Overview' },
  { to: '/science', label: 'Scientists' },
  { to: '/farmers', label: 'Farmers' },
  { to: '/knowledge', label: 'Knowledge hub' },
  { to: '/chat', label: 'AI Chat' },
]

export function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="border-b border-orange-200 bg-white">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-3">
          <span className="mr-4 font-bold text-brand">{APP_NAME}</span>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-slate-100 font-medium' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user ? (
              <>
                <span className="text-slate-500">{user.name || user.email}</span>
                <Button variant="ghost" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : (
              <NavLink to="/login" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
                Log in
              </NavLink>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-sm text-stone-500">
        Data: NASA POWER (MERRA-2 based), NASA Langley Research Center · GRACE / GRACE-FO total water storage, NASA JPL · Map © OpenStreetMap
        contributors. Prototype for the NASA Space Apps Challenge, “Be an Earth System Trend Detective”.
      </footer>
    </div>
  )
}

/** Wrap routes that need a logged-in user. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="text-slate-500">Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}
