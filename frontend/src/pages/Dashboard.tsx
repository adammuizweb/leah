import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../services/auth'
import { useNavigate, Navigate } from 'react-router-dom'
import { CardSkeleton } from '../components/LoadingSkeleton'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  open: 'bg-green-500',
  in_progress: 'bg-indigo-500',
  pending: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-gray-400',
  cancelled: 'bg-red-500',
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const isUser = user?.role === 'user' && !user?.is_superuser
  if (isUser) return <Navigate to="/my" replace />

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', { per_page: '1' }],
    queryFn: () => api.tickets.list({ per_page: '1' }),
  })

  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', { per_page: '1' }],
    queryFn: () => api.assets.list({ per_page: '1' }),
  })

  const { data: allTickets, isLoading: allTicketsLoading } = useQuery({
    queryKey: ['tickets', 'all-status'],
    queryFn: () => api.tickets.list({ per_page: '999' }),
  })

  const { data: recentTickets, isLoading: recentLoading } = useQuery({
    queryKey: ['tickets', 'recent'],
    queryFn: () => api.tickets.list({ per_page: '5' }),
  })

  const totalTickets = ticketsData?.total ?? 0
  const totalAssets = assetsData?.total ?? 0

  const statusCounts: Record<string, number> = {}
  allTickets?.data?.forEach(t => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
  })

  const openCount = (statusCounts['open'] || 0) + (statusCounts['new'] || 0) + (statusCounts['in_progress'] || 0)
  const myTickets = (allTickets?.data || []).filter(t => t.assigned_to === user?.id).length

  const stats = [
    {
      label: 'Total Tickets',
      value: totalTickets,
      icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
      color: 'bg-brand-500',
      bg: 'bg-brand-50',
      loading: ticketsLoading,
    },
    {
      label: 'Open Tickets',
      value: openCount,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      loading: allTicketsLoading,
    },
    {
      label: 'Total Assets',
      value: totalAssets,
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      loading: assetsLoading,
    },
    {
      label: 'My Tickets',
      value: myTickets,
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: 'bg-purple-500',
      bg: 'bg-purple-50',
      loading: allTicketsLoading,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Here's what's happening across your organization.</p>
      </div>

      {/* Stats Grid */}
      {stats.some(s => s.loading) ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map(s => (
            <div key={s.label} className="card p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <svg className={`w-6 h-6 ${s.color.replace('bg-', 'text-')}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 truncate">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Ticket Status</h2>
          {allTicketsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full skeleton" />
                  <div className="h-3 skeleton flex-1" />
                  <div className="h-3 skeleton w-8" />
                </div>
              ))}
            </div>
          ) : allTickets?.data?.length === 0 ? (
            <EmptyState icon="ticket" title="No tickets yet" description="Create your first ticket to get started." />
          ) : (
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([status, count]) => {
                const pct = totalTickets > 0 ? (count / totalTickets) * 100 : 0
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[status] || 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-600 flex-1 capitalize">{status.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
              {/* Total row */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                <span className="text-sm font-medium text-gray-700 flex-1">Total</span>
                <span className="text-sm font-medium text-gray-900">{totalTickets}</span>
                <span className="text-xs text-gray-400 w-10 text-right">100%</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button onClick={() => navigate('/tickets')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span>Create Ticket</span>
            </button>
            <button onClick={() => navigate('/assets')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span>Add Asset</span>
            </button>
            <button onClick={() => navigate('/admin/users')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <span>Manage Users</span>
            </button>
            <button onClick={() => navigate('/assets')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <span>Bulk Create Assets</span>
            </button>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Tickets</h2>
            <button onClick={() => navigate('/tickets')} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</button>
          </div>
          {recentLoading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-6 w-16 skeleton rounded-full" />
                  <div className="h-3 skeleton flex-1" />
                  <div className="h-3 skeleton w-12" />
                </div>
              ))}
            </div>
          ) : !recentTickets?.data?.length ? (
            <div className="py-8">
              <EmptyState icon="ticket" title="No tickets" description="Recent tickets will appear here." />
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentTickets.data.slice(0, 5).map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Badge value={t.status} />
                  <span className="text-sm text-gray-700 flex-1 truncate min-w-0">{t.title}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    #{t.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
