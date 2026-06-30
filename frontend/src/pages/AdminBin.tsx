import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

const icons: Record<string, string> = { ticket: '🎫', asset: '📦', user: '👤' }
const labels: Record<string, string> = { ticket: 'Tickets', asset: 'Assets', user: 'Users' }

export default function AdminBin() {
  const queryClient = useQueryClient()
  const { data: items } = useQuery({ queryKey: ['bin'], queryFn: api.bin.list })

  const restore = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => api.bin.restore(type, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bin'] }),
  })

  const purge = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) => api.bin.delete(type, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bin'] }),
  })

  const grouped = new Map<string, typeof items>()
  items?.forEach(item => {
    const list = grouped.get(item.type) || []
    list.push(item)
    grouped.set(item.type, list)
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bin</h1>
      <p className="text-sm text-gray-500 mb-6">Deleted items grouped by type. Restore or permanently delete.</p>

      {!items?.length && <p className="text-gray-500 text-sm">Bin is empty.</p>}

      <div className="space-y-6">
        {['ticket', 'asset', 'user'].map(type => {
          const typeItems = grouped.get(type) || []
          return (
            <div key={type} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <span className="text-lg">{icons[type] || '📄'}</span>
                <span className="font-semibold text-sm text-gray-700">{labels[type] || type}</span>
                <span className="text-xs text-gray-400">({typeItems.length})</span>
              </div>
              {typeItems.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No deleted {labels[type]?.toLowerCase() || type}s</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Deleted</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {typeItems.map(item => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.title}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{new Date(item.deleted_at).toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm space-x-2">
                          <button onClick={() => restore.mutate({ type: item.type, id: item.id })} className="text-green-600 hover:text-green-800">Restore</button>
                          <button onClick={() => { if (confirm('Permanently delete this item?')) purge.mutate({ type: item.type, id: item.id }) }} className="text-red-600 hover:text-red-800">Delete forever</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
