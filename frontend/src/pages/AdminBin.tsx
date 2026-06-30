import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

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

  const icon: Record<string, string> = { ticket: '🎫', asset: '📦', user: '👤' }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bin</h1>
      <p className="text-sm text-gray-500 mb-4">Items that have been soft-deleted. Restore or permanently delete them.</p>

      {!items?.length && <p className="text-gray-500 text-sm">Bin is empty.</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deleted At</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items?.map(item => (
              <tr key={`${item.type}-${item.id}`}>
                <td className="px-4 py-3 text-sm">{icon[item.type] || '📄'} {item.type}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(item.deleted_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button onClick={() => restore.mutate({ type: item.type, id: item.id })} className="text-green-600 hover:text-green-800">Restore</button>
                  <button onClick={() => { if (confirm('Permanently delete this item?')) purge.mutate({ type: item.type, id: item.id }) }} className="text-red-600 hover:text-red-800">Delete forever</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
