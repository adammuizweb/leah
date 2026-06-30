import { Link, Outlet, useLocation } from 'react-router-dom'

const cards = [
  { to: '/admin/users', icon: '👥', title: 'Users', desc: 'Manage users, roles, and passwords' },
  { to: '/admin/permissions', icon: '🔐', title: 'Permissions', desc: 'Create roles & assign permissions' },
  { to: '/admin/bin', icon: '🗑️', title: 'Bin', desc: 'View and restore deleted items' },
]

export default function Admin() {
  const location = useLocation()
  const isIndex = location.pathname === '/admin'

  if (!isIndex) return <Outlet />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(card => (
          <Link
            key={card.to}
            to={card.to}
            className="block p-6 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-lg transition-all"
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{card.title}</h2>
            <p className="text-sm text-gray-600">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
