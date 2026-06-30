import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/auth'
import Landing from './pages/Landing'
import AppShell from './pages/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tickets from './pages/Tickets'
import Assets from './pages/Assets'
import Admin from './pages/Admin'
import AdminUsers from './pages/AdminUsers'
import AdminPermissions from './pages/AdminPermissions'
import AdminBin from './pages/AdminBin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>}>
            <Route path="users" element={<AdminUsers />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="bin" element={<AdminBin />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
