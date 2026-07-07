import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { useState } from 'react'

const isUserRole = (role?: string, isSuper?: boolean) => role === 'user' && !isSuper

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/tickets', label: 'Tickets', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
  { to: '/assets', label: 'Assets', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
]

export default function AppShell() {
  const { user, logout, hasPermission } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const isUser = isUserRole(user?.role, user?.is_superuser)
  const isAdmin = isUser ? false : (user?.role === 'admin' || user?.role === 'superadmin' || user?.is_superuser || hasPermission('settings.read'))
  const visibleNavItems = isUser ? navItems.filter(n => n.to === '/tickets') : navItems

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col
        transform transition-all duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-100 relative ${sidebarCollapsed ? 'justify-center px-0' : 'px-6'}`}>
          <Link to={isUser ? '/my' : '/dashboard'} className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <span className={`text-lg font-bold text-gray-900 ${sidebarCollapsed ? 'hidden' : ''}`}>LEAH</span>
          </Link>

        </div>

        {/* Nav links */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {isUser && (
            <Link
              to="/my"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
                sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                location.pathname === '/my'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={sidebarCollapsed ? 'My Panel' : undefined}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={location.pathname === '/my' ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className={sidebarCollapsed ? 'hidden' : ''}>My Panel</span>
            </Link>
          )}
          {visibleNavItems.map(item => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/')
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
                  sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className={sidebarCollapsed ? 'hidden' : ''}>{item.label}</span>
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
                sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                location.pathname.startsWith('/admin')
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={sidebarCollapsed ? 'Admin' : undefined}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={location.pathname.startsWith('/admin') ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={sidebarCollapsed ? 'hidden' : ''}>Admin</span>
            </Link>
          )}
        </nav>

        {/* User section */}
        <div className={`border-t border-gray-100 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
            <Link to="/profile" className={`flex items-center group ${sidebarCollapsed ? '' : 'gap-3 flex-1 min-w-0'}`}>
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-brand-300 transition-all">
                <span className="text-sm font-semibold text-brand-700">
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'hidden' : ''}`}>
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600 transition-colors">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user?.role}</p>
              </div>
            </Link>
            <button onClick={logout} className={`text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 ${sidebarCollapsed ? 'p-1.5' : 'p-1.5'}`} title="Sign out">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 sticky top-0 z-30 relative">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Collapse toggle pill at header's left edge */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full shadow-sm items-center justify-center hover:bg-gray-50 transition-colors z-10"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="ml-4 lg:ml-0 hidden sm:flex items-center gap-2 text-sm text-gray-500">
            {location.pathname.split('/').filter(Boolean).map((segment, i, arr) => (
              <span key={segment} className="flex items-center gap-2">
                {i > 0 && <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                <span className={i === arr.length - 1 ? 'text-gray-900 font-medium capitalize' : 'capitalize'}>
                  {segment.replace(/-/g, ' ')}
                </span>
              </span>
            ))}
            {location.pathname === '/dashboard' && <span className="text-gray-900 font-medium">Dashboard</span>}
          </div>

          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
