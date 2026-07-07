import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/auth'
import { ToastProvider } from './components/Toast'
import Landing from './pages/Landing'
import About from './pages/About'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import AppShell from './pages/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tickets from './pages/Tickets'
import Assets from './pages/Assets'
import Admin from './pages/Admin'
import AdminUsers from './pages/AdminUsers'
import AdminPermissions from './pages/AdminPermissions'
import AdminTypes from './pages/AdminTypes'
import AdminCategories from './pages/AdminCategories'
import AdminHoldings from './pages/AdminHoldings'
import AdminOrganizations from './pages/AdminOrganizations'
import AdminBin from './pages/AdminBin'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.is_superuser
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>}>
            <Route path="users" element={<AdminUsers />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="types" element={<AdminTypes />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="holdings" element={<AdminHoldings />} />
            <Route path="organizations" element={<AdminOrganizations />} />
            <Route path="bin" element={<AdminBin />} />
          </Route>
        </Route>
      </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
