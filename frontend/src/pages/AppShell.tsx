import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../services/auth'

export default function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold text-indigo-600">
                LEAH
              </Link>
              <div className="flex gap-4">
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
                <Link to="/tickets" className="text-gray-600 hover:text-gray-900">Tickets</Link>
                <Link to="/assets" className="text-gray-600 hover:text-gray-900">Assets</Link>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {user.name} <span className="text-xs text-gray-400">({user.role})</span>
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
