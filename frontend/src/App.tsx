import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import { HeatwatchProvider } from './heatwatch/DataContext'
import Chat from './pages/Chat'
import Farmers from './pages/Farmers'
import Knowledge from './pages/Knowledge'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Science from './pages/Science'

export default function App() {
  return (
    <AuthProvider>
      <HeatwatchProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="science" element={<Science />} />
              <Route path="farmers" element={<Farmers />} />
              <Route path="knowledge" element={<Knowledge />} />
              <Route path="login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="chat" element={<Chat />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </HeatwatchProvider>
    </AuthProvider>
  )
}
