import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Ticket } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function Tickets() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assetId, setAssetId] = useState<number | ''>('')
  const [assetError, setAssetError] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)

  const params: Record<string, string> = {}
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter
  params.per_page = '10'
  params.page = String(page)

  const { data: result } = useQuery({
    queryKey: ['tickets', params],
    queryFn: () => api.tickets.list(params),
  })

  const { data: assets } = useQuery({ queryKey: ['assets-all'], queryFn: () => api.assets.list({ per_page: '999' }) })

  const assetMap = new Map(assets?.data?.map(a => [a.id, a]) || [])

  const createMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => api.tickets.create(data),
    onSuccess: () => {
      toast('Ticket created', 'success')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      setShowForm(false); setTitle(''); setDescription(''); setAssetId(''); setAssetError(false)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tickets.delete(id),
    onSuccess: () => { toast('Ticket deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetId) { setAssetError(true); return }
    setAssetError(false)
    createMutation.mutate({ title, description, asset_id: assetId } as Partial<Ticket>)
  }

  const tickets = result?.data || []
  const totalPages = result?.total_pages || 1

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">{showForm ? 'Cancel' : 'New Ticket'}</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Ticket">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Title" required />
          <select value={assetId} onChange={e => { setAssetId(e.target.value ? Number(e.target.value) : ''); setAssetError(false) }} className={`w-full border rounded-lg px-3 py-2 text-sm ${assetError ? 'border-red-400' : ''}`}>
            <option value="">— Select asset —</option>
            {assets?.data?.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serial || a.type})</option>)}
          </select>
          {assetError && <p className="text-xs text-red-500">Asset is required</p>}
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description" rows={3} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-lg shadow mb-4">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-gray-100">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search tickets..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <span className="text-xs text-gray-400">{result?.total || 0} tickets</span>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tickets.map(ticket => {
              const asset = ticket.asset_id ? assetMap.get(ticket.asset_id) : null
              return (
                <tr key={ticket.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{asset ? `${asset.name} (${asset.serial || asset.type})` : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{ticket.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{ticket.priority}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteMutation.mutate(ticket.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center text-sm">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-30">Previous</button>
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-30">Next</button>
          </div>
        )}
      </div>
    </div>
  )
}
