import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Ticket } from '../services/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useAuth } from '../services/auth'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-indigo-100 text-indigo-800',
  closed: 'bg-gray-50 text-gray-400',
  cancelled: 'bg-red-100 text-red-800',
}

export default function Tickets() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, permissions } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assetId, setAssetId] = useState<number | ''>('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('open')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [assetError, setAssetError] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [holdingFilter, setHoldingFilter] = useState<number | ''>('')
  const [orgFilter, setOrgFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const params: Record<string, string> = { per_page: String(perPage), page: String(page) }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter
  if (typeFilter) params.type_id = String(typeFilter)
  if (holdingFilter) params.holding_id = String(holdingFilter)
  if (orgFilter) params.organization_id = String(orgFilter)

  const { data: result } = useQuery({ queryKey: ['tickets', params], queryFn: () => api.tickets.list(params) })
  const { data: assets } = useQuery({ queryKey: ['assets-all'], queryFn: () => api.assets.list({ per_page: '999' }) })
  const { data: holdings } = useQuery({ queryKey: ['holdings'], queryFn: api.holdings.list })
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list })
  const { data: ticketTypes } = useQuery({ queryKey: ['ticket-types'], queryFn: api.ticketTypes.list })

  const assetMap = new Map(assets?.data?.map(a => [a.id, a]) || [])
  const typeMap = new Map(ticketTypes?.map(t => [t.id, t.name]) || [])
  const filteredOrgs = holdingFilter ? orgs?.filter(o => o.holding_id === holdingFilter) : orgs

  const canEdit = (t: Ticket) => user?.is_superuser || user?.role === 'admin' || t.created_by === user?.id
  const canBulk = user?.is_superuser || user?.role === 'admin' || permissions.includes('tickets.bulk_delete')
  const allSelected = (result?.data?.length || 0) > 0 && selected.size === (result?.data?.length || 0)

  const createMutation = useMutation({
    mutationFn: (data: Partial<Ticket>) => api.tickets.create(data),
    onSuccess: () => { toast('Ticket created', 'success'); queryClient.invalidateQueries({ queryKey: ['tickets'] }); resetForm() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: (d: Partial<Ticket>) => api.tickets.update(editId!, d),
    onSuccess: () => { toast('Ticket updated', 'success'); queryClient.invalidateQueries({ queryKey: ['tickets'] }); resetForm() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.tickets.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); setSelected(new Set()) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function resetForm() { setShowForm(false); setEditId(null); setTitle(''); setDescription(''); setAssetId(''); setAssetError(false); setPriority('medium'); setStatus('new'); setTypeId('') }
  function openEdit(t: Ticket) { setEditId(t.id); setTitle(t.title); setDescription(t.description); setAssetId(t.asset_id || ''); setPriority(t.priority); setStatus(t.status); setTypeId(t.type_id || ''); setShowForm(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetId) { setAssetError(true); return }
    setAssetError(false)
    const body = { title, description, asset_id: assetId, priority, type_id: typeId || null } as Partial<Ticket>
    if (editId) { (body as any).status = status }
    editId ? updateMutation.mutate(body) : createMutation.mutate(body)
  }

  function toggleSelect(id: number) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (allSelected) { setSelected(new Set()); return }
    setSelected(new Set(result?.data?.map(t => t.id) || []))
  }

  function bulkDelete() {
    if (!confirm(`Delete ${selected.size} tickets?`)) return
    selected.forEach(id => deleteMutation.mutate(id))
    toast(`Deleting ${selected.size} tickets...`, 'info')
  }

  const tickets = result?.data || []
  const totalPages = result?.total_pages || 1

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        {!showForm && <button onClick={() => { resetForm(); setShowForm(true) }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">+ New Ticket</button>}
      </div>

      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-3 text-sm">
          <span className="font-medium text-indigo-700">{selected.size} selected</span>
          {canBulk && <button onClick={bulkDelete} className="text-red-600 hover:text-red-800 font-medium">Delete all</button>}
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Ticket' : 'New Ticket'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Title" required />
          <select value={assetId} onChange={e => { setAssetId(e.target.value ? Number(e.target.value) : ''); setAssetError(false) }} className={`w-full border rounded-lg px-3 py-2 text-sm ${assetError ? 'border-red-400' : ''}`}>
            <option value="">— Select asset —</option>
            {assets?.data?.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serial || a.type})</option>)}
          </select>
          {assetError && <p className="text-xs text-red-500">Asset is required</p>}
          <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={typeId} onChange={e => setTypeId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— No type —</option>
            {ticketTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {editId && (
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          )}
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description" rows={3} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-lg shadow mb-4">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-gray-100">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search tickets..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
          <select value={holdingFilter} onChange={e => { setHoldingFilter(e.target.value ? Number(e.target.value) : ''); setOrgFilter(''); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All holdings</option>
            {holdings?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={orgFilter} onChange={e => { setOrgFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm" disabled={!holdingFilter}>
            <option value="">All orgs</option>
            {filteredOrgs?.map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)} {o.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm"><option value="">All statuses</option><option value="new">New</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm"><option value="">All priorities</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm"><option value="">All types</option>{ticketTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <span className="text-xs text-gray-400">{result?.total || 0} tickets</span>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" /></th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {tickets.map(ticket => {
              const asset = ticket.asset_id ? assetMap.get(ticket.asset_id) : null
              return (
                <tr key={ticket.id} className={selected.has(ticket.id) ? 'bg-indigo-50/50' : ''}>
                  <td className="px-4 py-4"><input type="checkbox" checked={selected.has(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="rounded" /></td>
                  <td className="px-4 py-4 text-sm"><Link to={`/tickets/${ticket.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">{ticket.title}</Link></td>
                  <td className="px-4 py-4 text-sm text-gray-500">{ticket.type_id ? (typeMap.get(ticket.type_id) || '—') : '—'}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{asset ? `${asset.name} (${asset.serial || asset.type})` : '—'}</td>
                  <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs rounded-full ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>{ticket.status}</span></td>
                  <td className="px-4 py-4 text-sm text-gray-900">{ticket.priority}</td>
                  <td className="px-4 py-4 text-sm space-x-2">
                    {canEdit(ticket) && <button onClick={() => openEdit(ticket)} className="text-indigo-600 hover:text-indigo-800">Edit</button>}
                    <button onClick={() => deleteMutation.mutate(ticket.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Rows:</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 text-sm">{PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}</select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-30">Previous</button>
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
