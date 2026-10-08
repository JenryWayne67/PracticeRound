import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import Chat from './pages/Chat'
import Home from './pages/Home'
import Items from './pages/Items'
import Login from './pages/Login'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route path="items" element={<Items />} />
              <Route path="chat" element={<Chat />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
