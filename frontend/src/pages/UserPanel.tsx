import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../services/auth'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { CardSkeleton } from '../components/LoadingSkeleton'

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  open: 'bg-green-500',
  in_progress: 'bg-indigo-500',
  pending: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-gray-400',
  cancelled: 'bg-red-500',
}

export default function UserPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: myAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['my-assets'],
    queryFn: () => api.assets.mine({ per_page: '50' }),
  })

  const { data: myTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.tickets.mine({ per_page: '20' }),
  })

  const assets = myAssets?.data || []
  const tickets = myTickets?.data || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Your assigned assets and tickets.</p>
        </div>
        <button onClick={() => navigate('/tickets')} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Create Ticket
        </button>
      </div>

      {/* Assigned Assets */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">My Assigned Assets</h2>
        {assetsLoading ? (
          <CardSkeleton count={3} />
        ) : assets.length === 0 ? (
          <EmptyState icon="asset" title="No assets assigned" description="You don't have any assets assigned to you yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(asset => (
              <div key={asset.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{asset.type || '—'}</p>
                  </div>
                  <Badge value={asset.status || 'active'} icon="dot" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {asset.serial && <span>SN: <span className="font-mono text-gray-700">{asset.serial}</span></span>}
                  {asset.location && <span>Location: {asset.location}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Tickets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">My Tickets</h2>
          <button onClick={() => navigate('/tickets')} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all</button>
        </div>
        {ticketsLoading ? (
          <CardSkeleton count={3} />
        ) : tickets.length === 0 ? (
          <EmptyState icon="ticket" title="No tickets" description="You haven't created any tickets yet." />
        ) : (
          <div className="card divide-y divide-gray-50 overflow-hidden">
            {tickets.slice(0, 10).map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[t.status] || 'bg-gray-400'}`} />
                <span className="text-sm text-gray-700 flex-1 truncate min-w-0">{t.title}</span>
                <Badge value={t.status} />
                <span className="text-xs text-gray-400 shrink-0">#{t.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
