import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../services/auth'

const modules = [
  { to: '/admin/users', icon: '👥', label: 'Users', perm: 'users.read' },
  { to: '/admin/permissions', icon: '🔐', label: 'Permissions', perm: 'settings.read' },
  { to: '/admin/holdings', icon: '🏢', label: 'Holdings', perm: 'settings.read' },
  { to: '/admin/organizations', icon: '🏗️', label: 'Organizations', perm: 'settings.read' },
  { to: '/admin/types', icon: '📋', label: 'Asset Types', perm: 'types.read' },
  { to: '/admin/categories', icon: '📂', label: 'Categories', perm: 'categories.read' },
  { to: '/admin/bin', icon: '🗑️', label: 'Bin', perm: 'settings.read' },
]

export default function Admin() {
  const location = useLocation()
  const { user, permissions } = useAuth()

  const can = (perm: string) => user?.role === 'admin' || user?.is_superuser || permissions.includes(perm)

  return (
    <div className="flex gap-6">
      <nav className="w-56 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Administration</h2>
        <div className="space-y-1">
          {modules.filter(m => can(m.perm)).map(m => (
            <Link
              key={m.to}
              to={m.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                location.pathname.startsWith(m.to)
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
