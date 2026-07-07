import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Asset } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useAuth } from '../services/auth'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { TableSkeleton } from '../components/LoadingSkeleton'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export default function Assets() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, permissions } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [serial, setSerial] = useState('')
  const [assetTypeId, setAssetTypeId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [modelId, setModelId] = useState<number | ''>('')
  const [astatus, setAstatus] = useState('active')
  const [organizationId, setOrganizationId] = useState<number | ''>('')

  const [bulkModelId, setBulkModelId] = useState<number | ''>('')
  const [bulkQty, setBulkQty] = useState(1)
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [bulkSerials, setBulkSerials] = useState('')
  const [usePrefix, setUsePrefix] = useState(true)
  const [bulkOrgId, setBulkOrgId] = useState<number | ''>('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [modelFilter, setModelFilter] = useState<number | ''>('')
  const [holdingFilter, setHoldingFilter] = useState<number | ''>('')
  const [orgFilter, setOrgFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number } | { bulk: number } | null>(null)

  const params: Record<string, string> = { per_page: String(perPage), page: String(page) }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (typeFilter) params.type_id = String(typeFilter)
  if (modelFilter) params.model_id = String(modelFilter)
  if (holdingFilter) params.holding_id = String(holdingFilter)
  if (orgFilter) params.organization_id = String(orgFilter)

  const { data: result, isLoading } = useQuery({ queryKey: ['assets', params], queryFn: () => api.assets.list(params) })
  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: categories } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })
  const { data: models } = useQuery({ queryKey: ['asset-models'], queryFn: api.assetModels.list })
  const { data: holdings } = useQuery({ queryKey: ['holdings'], queryFn: api.holdings.list })
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list })

  const filteredCats = assetTypeId ? categories?.filter(c => c.type_id === assetTypeId) : categories
  const filteredModels = assetTypeId ? models?.filter(m => m.type_id === assetTypeId) : models
  const filteredOrgs = holdingFilter ? orgs?.filter(o => o.holding_id === holdingFilter) : orgs

  const typeMap = new Map(types?.map(t => [t.id, t.name]) || [])
  const catMap = new Map(categories?.map(c => [c.id, c.name]) || [])
  const modelMap = new Map(models?.map(m => [m.id, m.name]) || [])

  const canEdit = (_a: Asset) => user?.is_superuser || user?.role === 'admin'
  const canBulk = user?.is_superuser || user?.role === 'admin' || permissions.includes('assets.bulk_delete')
  const allSelected = (result?.data?.length || 0) > 0 && selected.size === (result?.data?.length || 0)

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => api.assets.create(data),
    onSuccess: () => { toast('Asset created', 'success'); queryClient.invalidateQueries({ queryKey: ['assets'] }); resetForm() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: (d: Partial<Asset>) => api.assets.update(editId!, d),
    onSuccess: () => { toast('Asset updated', 'success'); queryClient.invalidateQueries({ queryKey: ['assets'] }); resetForm() },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.assets.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setSelected(new Set()); setDeleteConfirm(null) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const bulkMutation = useMutation({
    mutationFn: () => api.assets.bulk({ model_id: bulkModelId as number, quantity: bulkQty, serial_prefix: usePrefix && bulkPrefix ? bulkPrefix : undefined, serial_numbers: !usePrefix && bulkSerials ? bulkSerials.split('\n').filter(Boolean) : undefined, status: 'active', organization_id: bulkOrgId || undefined }),
    onSuccess: () => { toast('Assets created', 'success'); queryClient.invalidateQueries({ queryKey: ['assets'] }); setShowBulk(false) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function resetForm() { setShowForm(false); setEditId(null); setName(''); setSerial(''); setAssetTypeId(''); setCategoryId(''); setModelId(''); setAstatus('active'); setOrganizationId('') }
  function openEdit(a: Asset) { setEditId(a.id); setName(a.name); setSerial(a.serial || ''); setAssetTypeId(a.type_id || ''); setCategoryId(a.category_id || ''); setModelId(a.model_id || ''); setAstatus(a.status || 'active'); setOrganizationId(a.organization_id || ''); setShowForm(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = { name, serial: serial || null, type_id: assetTypeId || null, category_id: categoryId || null, model_id: modelId || null, status: astatus, organization_id: editId ? undefined : (organizationId || null) } as Partial<Asset>
    editId ? updateMutation.mutate(body) : createMutation.mutate(body)
  }

  function toggleSelect(id: number) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (allSelected) { setSelected(new Set()); return }
    setSelected(new Set(result?.data?.map(a => a.id) || []))
  }

  function bulkDelete() {
    selected.forEach(id => deleteMutation.mutate(id))
    toast(`Deleting ${selected.size} assets...`, 'info')
    setDeleteConfirm(null)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Assets" description={result ? `${result.total} total assets` : undefined}>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-secondary btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          New Asset
        </button>
        <button onClick={() => setShowBulk(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Bulk Create
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
        <div className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search assets..." className="input pl-9" />
          </div>
          <select value={holdingFilter} onChange={e => { setHoldingFilter(e.target.value ? Number(e.target.value) : ''); setOrgFilter(''); setPage(1) }} className="select min-w-[140px]">
            <option value="">All holdings</option>
            {holdings?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={orgFilter} onChange={e => { setOrgFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="select min-w-[140px]" disabled={!holdingFilter}>
            <option value="">All orgs</option>
            {filteredOrgs?.map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)}{o.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="select min-w-[130px]">
            <option value="">All statuses</option>
            <option value="active">Active</option><option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option><option value="lost">Lost</option>
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="select min-w-[130px]">
            <option value="">All types</option>
            {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={modelFilter} onChange={e => { setModelFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="select min-w-[130px]">
            <option value="">All models</option>
            {models?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={perPage} cols={7} />
        ) : !result?.data?.length ? (
          <EmptyState icon="asset" title="No assets found" description={search || statusFilter || typeFilter ? 'Try adjusting your filters.' : 'Add your first asset to get started.'} action={!search && !statusFilter && !typeFilter ? { label: 'Add Asset', onClick: () => { resetForm(); setShowForm(true) } } : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3.5 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {result.data.map(asset => {
                  const isSelected = selected.has(asset.id)
                  return (
                    <tr key={asset.id} className={`transition-colors duration-150 ${isSelected ? 'bg-brand-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3.5"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(asset.id)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" /></td>
                      <td className="px-4 py-3.5 text-sm font-medium text-gray-900">{asset.name}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{asset.type_id ? (typeMap.get(asset.type_id) || '—') : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{asset.category_id ? (catMap.get(asset.category_id) || '—') : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">{asset.model_id ? (modelMap.get(asset.model_id) || '—') : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 font-mono">{asset.serial || '—'}</td>
                      <td className="px-4 py-3.5"><Badge value={asset.status || 'active'} icon="dot" /></td>
                      <td className="px-4 py-3.5 text-right text-sm">
                        {canEdit(asset) && <button onClick={() => openEdit(asset)} className="btn-ghost btn-sm">Edit</button>}
                        <button onClick={() => setDeleteConfirm({ id: asset.id })} className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium transition-colors">Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && result && (
          <div className="px-4 py-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Rows per page:</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className="select py-1.5 w-auto">
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-gray-400">{(page - 1) * perPage + 1}–{Math.min(page * perPage, result.total)} of {result.total}</span>
            </div>
            {result.total_pages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Previous
                </button>
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(result.total_pages, 5) }).map((_, i) => {
                    const p = page <= 3 ? i + 1 : page + i - 2
                    if (p < 1 || p > result.total_pages) return null
                    return (
                      <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium transition-colors ${p === page ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        {p}
                      </button>
                    )
                  })}
                </div>
                <button disabled={page >= result.total_pages} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Asset' : 'New Asset'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Asset name" required autoFocus />
            </div>
            <div>
              <label className="label">Serial</label>
              <input value={serial} onChange={e => setSerial(e.target.value)} className="input font-mono" placeholder="Optional" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={assetTypeId} onChange={e => { setAssetTypeId(e.target.value ? Number(e.target.value) : ''); setCategoryId(''); setModelId('') }} className="select">
                <option value="">— Select type —</option>
                {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')} className="select" disabled={!assetTypeId}>
                <option value="">— Select category —</option>
                {filteredCats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Model</label>
              <select value={modelId} onChange={e => setModelId(e.target.value ? Number(e.target.value) : '')} className="select" disabled={!assetTypeId}>
                <option value="">— Select model —</option>
                {filteredModels?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={astatus} onChange={e => setAstatus(e.target.value)} className="select">
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            {!editId && (
              <div className="sm:col-span-2">
                <label className="label">Organization</label>
                <select value={organizationId} onChange={e => setOrganizationId(e.target.value ? Number(e.target.value) : '')} className="select" required>
                  <option value="">— Select organization —</option>
                  {orgs?.map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)}{o.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? (
                <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</span>
              ) : (editId ? 'Update Asset' : 'Create Asset')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Create Modal */}
      <Modal open={showBulk} onClose={() => setShowBulk(false)} title="Bulk Create Assets" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Model</label>
            <select value={bulkModelId} onChange={e => setBulkModelId(e.target.value ? Number(e.target.value) : '')} className="select" required>
              <option value="">— Select model —</option>
              {models?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity</label>
              <input type="number" min={1} max={500} value={bulkQty} onChange={e => setBulkQty(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Organization</label>
              <select value={bulkOrgId} onChange={e => setBulkOrgId(e.target.value ? Number(e.target.value) : '')} className="select" required>
                <option value="">— Select organization —</option>
                {orgs?.map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)}{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={usePrefix} onChange={() => setUsePrefix(true)} className="text-brand-600" />
              Auto-generate serials
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="radio" checked={!usePrefix} onChange={() => setUsePrefix(false)} className="text-brand-600" />
              Paste serial list
            </label>
          </div>
          {usePrefix ? (
            <div>
              <label className="label">Serial Prefix</label>
              <input value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} className="input font-mono" placeholder="e.g. LAT-3420-" />
              <p className="text-xs text-gray-400 mt-1">Serials will be: {bulkPrefix}1, {bulkPrefix}2, ...</p>
            </div>
          ) : (
            <div>
              <label className="label">Serial Numbers (one per line)</label>
              <textarea value={bulkSerials} onChange={e => setBulkSerials(e.target.value)} className="input font-mono" rows={5} placeholder="SN-001&#10;SN-002&#10;SN-003" />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowBulk(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => bulkMutation.mutate()} className="btn-primary" disabled={!bulkModelId || !bulkOrgId || bulkMutation.isPending}>
              {bulkMutation.isPending ? (
                <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</span>
              ) : 'Create Assets'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={'id' in (deleteConfirm || {}) ? () => deleteMutation.mutate((deleteConfirm as { id: number }).id) : bulkDelete}
        title={deleteConfirm && 'bulk' in deleteConfirm ? 'Delete Assets' : 'Delete Asset'}
        message={deleteConfirm && 'bulk' in deleteConfirm ? `Delete ${(deleteConfirm as { bulk: number }).bulk} assets? This action can be undone (soft delete).` : 'Delete this asset? It can be recovered from the Bin.'}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
