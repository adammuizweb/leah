import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Ticket } from '../services/api'
import { useAuth } from '../services/auth'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/LoadingSkeleton'
import { APPROVAL_LABELS, REQUEST_KIND_LABELS, approvalClass, type ApprovalStatus, type RequestKind } from '../request'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export default function Tickets() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [holdingFilter, setHoldingFilter] = useState<number | ''>('')
  const [orgFilter, setOrgFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assetId, setAssetId] = useState<number | ''>('')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number } | { bulk: number } | null>(null)

  const canReadAll = hasPermission('tickets.read')
  const canEdit = hasPermission('tickets.update')
  const canDelete = hasPermission('tickets.delete')
  const canBulk = canDelete && hasPermission('tickets.bulk_delete')
  const canReadAllAssets = hasPermission('assets.read')
  const params: Record<string, string> = { page: String(page), per_page: String(perPage) }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter
  if (kindFilter) params.request_kind = kindFilter
  if (approvalFilter) params.approval_status = approvalFilter
  if (typeFilter) params.type_id = String(typeFilter)
  if (holdingFilter) params.holding_id = String(holdingFilter)
  if (orgFilter) params.organization_id = String(orgFilter)

  const { data: result, isLoading } = useQuery({
    queryKey: [canReadAll ? 'tickets' : 'my-tickets', params],
    queryFn: () => canReadAll ? api.tickets.list(params) : api.tickets.mine(params),
  })
  const { data: assets } = useQuery({
    queryKey: [canReadAllAssets ? 'assets-all' : 'my-assets'],
    queryFn: () => canReadAllAssets ? api.assets.list({ per_page: '999' }) : api.assets.mine({ per_page: '999' }),
  })
  const { data: ticketTypes } = useQuery({
    queryKey: ['ticket-types'],
    queryFn: api.ticketTypes.list,
    enabled: hasPermission('ticket_types.read'),
  })
  const { data: holdings } = useQuery({ queryKey: ['holdings'], queryFn: api.holdings.list, enabled: canReadAll })
  const { data: organizations } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list, enabled: canReadAll })

  const tickets = result?.data || []
  const assetMap = new Map(assets?.data.map(asset => [asset.id, asset]) || [])
  const typeMap = new Map(ticketTypes?.map(type => [type.id, type.name]) || [])
  const filteredOrganizations = holdingFilter ? organizations?.filter(organization => organization.holding_id === holdingFilter) : organizations
  const totalPages = result?.total_pages || 1
  const allSelected = tickets.length > 0 && selected.size === tickets.length

  const update = useMutation({
    mutationFn: (body: Partial<Ticket>) => api.tickets.update(editId!, body),
    onSuccess: () => {
      toast('Request updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      setEditId(null)
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.tickets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      setSelected(new Set())
      setDeleteConfirm(null)
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  function openCreateRequest() {
    const next = new URLSearchParams(searchParams)
    next.set('new', 'request')
    setSearchParams(next)
  }

  function openEdit(ticket: Ticket) {
    setEditId(ticket.id)
    setTitle(ticket.title)
    setDescription(ticket.description)
    setPriority(ticket.priority)
    setAssetId(ticket.asset_id || '')
    setTypeId(ticket.type_id || '')
  }

  function closeEdit() {
    setEditId(null)
    setTitle('')
    setDescription('')
    setPriority('medium')
    setAssetId('')
    setTypeId('')
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    update.mutate({ title, description, priority, asset_id: assetId || null, type_id: typeId || null })
  }

  function toggleSelected(id: number) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tickets.map(ticket => ticket.id)))
  }

  function bulkDelete() {
    selected.forEach(id => remove.mutate(id))
    setDeleteConfirm(null)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Requests" description={result ? `${result.total} total requests` : undefined} />

      {selected.size > 0 && (
        <div className="card mb-4 px-4 py-3 flex items-center gap-3 text-sm">
          <span className="font-medium text-gray-700">{selected.size} selected</span>
          <button onClick={() => setDeleteConfirm({ bulk: selected.size })} className="text-red-600 hover:text-red-800 font-medium ml-auto">Delete selected</button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      <div className="card mb-6 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="relative sm:col-span-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} className="input pl-9" placeholder="Search requests..." />
        </div>
        <select value={kindFilter} onChange={event => { setKindFilter(event.target.value); setPage(1) }} className="select">
          <option value="">All request types</option>
          <option value="incident">Report an Issue</option>
          <option value="service">Service Request</option>
          <option value="software">Software Development</option>
        </select>
        <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }} className="select">
          <option value="">All statuses</option>
          <option value="new">New</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
        </select>
        <select value={priorityFilter} onChange={event => { setPriorityFilter(event.target.value); setPage(1) }} className="select">
          <option value="">All priorities</option>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
        </select>
        <select value={approvalFilter} onChange={event => { setApprovalFilter(event.target.value); setPage(1) }} className="select">
          <option value="">All approvals</option>
          <option value="pending">Awaiting approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {canReadAll && <>
          <select value={holdingFilter} onChange={event => { setHoldingFilter(event.target.value ? Number(event.target.value) : ''); setOrgFilter(''); setPage(1) }} className="select">
            <option value="">All holdings</option>
            {holdings?.map(holding => <option key={holding.id} value={holding.id}>{holding.name}</option>)}
          </select>
          <select value={orgFilter} onChange={event => { setOrgFilter(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="select" disabled={!holdingFilter}>
            <option value="">All organizations</option>
            {filteredOrganizations?.map(organization => <option key={organization.id} value={organization.id}>{'—'.repeat(organization.level)} {organization.name}</option>)}
          </select>
          <select value={typeFilter} onChange={event => { setTypeFilter(event.target.value ? Number(event.target.value) : ''); setPage(1) }} className="select">
            <option value="">All internal types</option>
            {ticketTypes?.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </>}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={perPage} cols={6} /> : tickets.length === 0 ? (
          <EmptyState icon="ticket" title="No requests found" description={search || kindFilter || statusFilter || priorityFilter || approvalFilter || typeFilter || holdingFilter || orgFilter ? 'Try adjusting your filters.' : 'Submit your first request to get started.'} action={!search && !kindFilter && !statusFilter && !priorityFilter && !approvalFilter && !typeFilter && !holdingFilter && !orgFilter ? { label: 'Create Request', onClick: openCreateRequest } : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80"><tr>
                {canBulk && <th className="px-4 py-3.5 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 text-brand-600" /></th>}
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Request</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                {(canEdit || canDelete) && <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map(ticket => {
                  const asset = ticket.asset_id ? assetMap.get(ticket.asset_id) : null
                  return <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    {canBulk && <td className="px-4 py-3.5"><input type="checkbox" checked={selected.has(ticket.id)} onChange={() => toggleSelected(ticket.id)} className="rounded border-gray-300 text-brand-600" /></td>}
                    <td className="px-4 py-3.5"><Link to={`/tickets/${ticket.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">{ticket.title}</Link><p className="text-xs text-gray-400 mt-0.5">#{ticket.id}</p></td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      <div>{REQUEST_KIND_LABELS[ticket.request_kind as RequestKind]}</div>
                      {ticket.type_id && <div className="text-xs text-gray-400 mt-0.5">{typeMap.get(ticket.type_id) || 'Unknown type'}</div>}
                      {ticket.approval_status !== 'not_required' && <span className={`badge text-[10px] mt-1 ${approvalClass(ticket.approval_status as ApprovalStatus)}`}>{APPROVAL_LABELS[ticket.approval_status as ApprovalStatus]}</span>}
                    </td>
                    <td className="px-4 py-3.5"><Badge value={ticket.status} icon="dot" /></td>
                    <td className="px-4 py-3.5"><Badge value={ticket.priority} /></td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{asset ? asset.name : '—'}</td>
                    {(canEdit || canDelete) && <td className="px-4 py-3.5 text-right text-sm">
                      {canEdit && <button onClick={() => openEdit(ticket)} className="btn-ghost btn-sm">Edit</button>}
                      {canDelete && <button onClick={() => setDeleteConfirm({ id: ticket.id })} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Delete</button>}
                    </td>}
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && tickets.length > 0 && <div className="px-4 py-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <span>Rows:</span>
            <select value={perPage} onChange={event => { setPerPage(Number(event.target.value)); setPage(1) }} className="select py-1.5 w-auto">{PER_PAGE_OPTIONS.map(value => <option key={value}>{value}</option>)}</select>
            <span>{(page - 1) * perPage + 1}–{Math.min(page * perPage, result?.total || 0)} of {result?.total || 0}</span>
          </div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="btn-secondary btn-sm">Previous</button>
            <span className="px-2 py-1.5 text-gray-500">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>}
      </div>

      <Modal open={editId !== null} onClose={closeEdit} title="Edit Request" size="lg">
        <form onSubmit={submitEdit} className="space-y-4">
          <div><label className="label">Summary</label><input value={title} onChange={event => setTitle(event.target.value)} className="input" required autoFocus /></div>
          <div><label className="label">Description</label><textarea value={description} onChange={event => setDescription(event.target.value)} className="input" rows={4} /></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><label className="label">Priority</label><select value={priority} onChange={event => setPriority(event.target.value)} className="select"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div><label className="label">Related asset</label><select value={assetId} onChange={event => setAssetId(event.target.value ? Number(event.target.value) : '')} className="select"><option value="">No related asset</option>{assets?.data.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
            <div><label className="label">Internal type</label><select value={typeId} onChange={event => setTypeId(event.target.value ? Number(event.target.value) : '')} className="select"><option value="">No type</option>{ticketTypes?.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
          </div>
          <p className="text-xs text-gray-500">Use the request detail page to change workflow status or approval.</p>
          <div className="flex justify-end gap-3"><button type="button" onClick={closeEdit} className="btn-secondary">Cancel</button><button type="submit" disabled={update.isPending} className="btn-primary">{update.isPending ? 'Saving...' : 'Save Changes'}</button></div>
        </form>
      </Modal>

      <ConfirmDialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} onConfirm={deleteConfirm && 'id' in deleteConfirm ? () => remove.mutate(deleteConfirm.id) : bulkDelete} title={deleteConfirm && 'bulk' in deleteConfirm ? 'Delete Requests' : 'Delete Request'} message={deleteConfirm && 'bulk' in deleteConfirm ? `Delete ${deleteConfirm.bulk} requests? They can be recovered from the Bin.` : 'Delete this request? It can be recovered from the Bin.'} loading={remove.isPending} />
    </div>
  )
}
