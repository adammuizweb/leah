import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export default function Dashboard() {
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: api.tickets.list })
  const assets = useQuery({ queryKey: ['assets'], queryFn: api.assets.list })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Total Tickets</h2>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {tickets.data?.length ?? '...'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Total Assets</h2>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {assets.data?.length ?? '...'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Open Tickets</h2>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {tickets.data?.filter(t => t.status === 'open').length ?? '...'}
          </p>
        </div>
      </div>
    </div>
  )
}
