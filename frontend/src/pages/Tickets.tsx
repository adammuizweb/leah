import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Ticket } from '../services/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useAuth } from '../services/auth'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/LoadingSkeleton'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

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
  const [status, setStatus] = useState('new')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [assetError, setAssetError] = useState(false)

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [holdingFilter, setHoldingFilter] = useState<number | ''>('')
  const [orgFilter, setOrgFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number } | { bulk: number } | null>(null)

  const params: Record<string, string> = { per_page: String(perPage), page: String(page) }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter
  if (typeFilter) params.type_id = String(typeFilter)
  if (holdingFilter) params.holding_id = String(holdingFilter)
  if (orgFilter) params.organization_id = String(orgFilter)

  const { data: result, isLoading } = useQuery({ queryKey: ['tickets', params], queryFn: () => api.tickets.list(params) })
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); setSelected(new Set()); setDeleteConfirm(null) },
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
    selected.forEach(id => deleteMutation.mutate(id))
    toast(`Deleting ${selected.size} tickets...`, 'info')
    setDeleteConfirm(null)
  }

  const tickets = result?.data || []
  const totalPages = result?.total_pages || 1

  return (
    <div className="animate-fade-in">
      <PageHeader title="Tickets" description={result ? `${result.total} total tickets` : undefined}>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          New Ticket
        </button>
      </PageHeader>

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="card mb-4 px-4 py-3 flex items-center gap-3 text-sm animate-fade-in-down">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-subtle" />
          <span className="font-medium text-gray-700">{selected.size} selected</span>
          {canBulk && (
            <button onClick={() => setDeleteConfirm({ bulk: selected.size })} className="text-red-600 hover:text-red-800 font-medium ml-auto">Delete all</button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600 font-medium">Clear</button>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <div className="relative sm:col-span-2 md:col-span-3 lg:col-span-3 xl:col-span-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search tickets..." className="input pl-9 w-full" />
          </div>

          <button onClick={() => setShowFilters(!showFilters)} className="md:hidden col-span-full -mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            {showFilters ? 'Less filters' : 'More filters'}
          </button>

          <div className={`${showFilters ? 'flex flex-col gap-3' : 'hidden'} md:contents`}>
            <select value={holdingFilter} onChange={e => { setHoldingFilter(e.target.value ? Number(e.target.value) : ''); setOrgFilter(''); setPage(1) }} className="select w-full min-w-0">
              <option value="">All holdings</option>
              {holdings?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select value={orgFilter} onChange={e => { setOrgFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="select w-full min-w-0" disabled={!holdingFilter}>
              <option value="">All orgs</option>
              {filteredOrgs?.map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)}{o.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="select w-full min-w-0">
              <option value="">Status</option>
              <option value="new">New</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1) }} className="select w-full min-w-0">
              <option value="">Priority</option>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="select w-full min-w-0">
              <option value="">Type</option>
              {ticketTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={perPage} cols={7} />
        ) : tickets.length === 0 ? (
          <EmptyState icon="ticket" title="No tickets found" description={search || statusFilter || priorityFilter ? 'Try adjusting your filters.' : 'Create your first ticket to get started.'} action={!search && !statusFilter && !priorityFilter ? { label: 'Create Ticket', onClick: () => { resetForm(); setShowForm(true) } } : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3.5 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map(ticket => {
                  const asset = ticket.asset_id ? assetMap.get(ticket.asset_id) : null
                  const isSelected = selected.has(ticket.id)
                  return (
                    <tr key={ticket.id} className={`transition-colors duration-150 ${isSelected ? 'bg-brand-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3.5"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(ticket.id)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></td>
                      <td className="px-4 py-3.5">
                        <Link to={`/tickets/${ticket.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">
                          {ticket.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{ticket.type_id ? (typeMap.get(ticket.type_id) || '—') : '—'}</td>
                      <td className="px-4 py-3.5"><Badge value={ticket.status} icon="dot" /></td>
                      <td className="px-4 py-3.5"><Badge value={ticket.priority} /></td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{asset ? (
                        <span className="truncate max-w-[150px] inline-block">{asset.name}{asset.serial ? ` (${asset.serial})` : ''}</span>
                      ) : '—'}</td>
                      <td className="px-4 py-3.5 text-right text-sm">
                        {canEdit(ticket) && (
                          <button onClick={() => openEdit(ticket)} className="btn-ghost btn-sm">Edit</button>
                        )}
                        <button onClick={() => setDeleteConfirm({ id: ticket.id })} className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition-colors">Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && tickets.length > 0 && (
          <div className="px-4 py-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Rows per page:</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className="select py-1.5 w-auto">
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-gray-400">{(page - 1) * perPage + 1}–{Math.min(page * perPage, result?.total || 0)} of {result?.total || 0}</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Previous
                </button>
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const p = page <= 3 ? i + 1 : page + i - 2
                    if (p < 1 || p > totalPages) return null
                    return (
                      <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium transition-colors ${p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        {p}
                      </button>
                    )
                  })}
                </div>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Ticket' : 'New Ticket'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="e.g. Printer not working" required autoFocus />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Asset</label>
              <select value={assetId} onChange={e => { setAssetId(e.target.value ? Number(e.target.value) : ''); setAssetError(false) }} className={`select ${assetError ? 'ring-2 ring-red-500 border-red-500' : ''}`}>
                <option value="">— Select asset —</option>
                {assets?.data?.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serial || a.type})</option>)}
              </select>
              {assetError && <p className="text-xs text-red-500 mt-1">Asset is required</p>}
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select value={typeId} onChange={e => setTypeId(e.target.value ? Number(e.target.value) : '')} className="select">
                <option value="">— No type —</option>
                {ticketTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {editId && (
              <div>
                <label className="label">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="select">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Describe the issue..." rows={4} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? (
                <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</span>
              ) : (editId ? 'Update Ticket' : 'Create Ticket')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={'id' in (deleteConfirm || {}) ? () => deleteMutation.mutate((deleteConfirm as { id: number }).id) : bulkDelete}
        title={deleteConfirm && 'bulk' in deleteConfirm ? 'Delete Tickets' : 'Delete Ticket'}
        message={deleteConfirm && 'bulk' in deleteConfirm ? `Delete ${(deleteConfirm as { bulk: number }).bulk} tickets? This action can be undone (soft delete).` : 'Delete this ticket? It can be recovered from the Bin.'}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
