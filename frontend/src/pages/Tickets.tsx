import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Ticket } from '../services/api'
import { useState } from 'react'

export default function Tickets() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assetId, setAssetId] = useState<number | ''>('')

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: api.tickets.list,
  })

  const { data: assets } = useQuery({
    queryKey: ['assets'],
    queryFn: api.assets.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => api.tickets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setShowForm(false)
      setTitle('')
      setDescription('')
      setAssetId('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tickets.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      title,
      description,
      asset_id: assetId || null,
    } as Partial<Ticket>)
  }

  if (isLoading) return <div className="text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'New Ticket'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Asset</label>
            <select
              value={assetId}
              onChange={e => setAssetId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">— No asset —</option>
              {assets?.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.serial || a.type})</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tickets?.map(ticket => (
              <tr key={ticket.id}>
                <td className="px-6 py-4 text-sm text-gray-900">#{ticket.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{ticket.title}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {ticket.asset_id ? `#${ticket.asset_id}` : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{ticket.priority}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => deleteMutation.mutate(ticket.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
