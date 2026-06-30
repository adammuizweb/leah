import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Asset } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useAuth } from '../services/auth'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export default function Assets() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [serial, setSerial] = useState('')
  const [status, setStatus] = useState('active')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const params: Record<string, string> = { per_page: String(perPage), page: String(page) }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (typeFilter) params.type_id = String(typeFilter)

  const { data: result } = useQuery({ queryKey: ['assets', params], queryFn: () => api.assets.list(params) })
  const { data: assetTypes } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: categories } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })

  const typeMap = new Map(assetTypes?.map(t => [t.id, t.name]) || [])
  const catMap = new Map(categories?.map(c => [c.id, c.name]) || [])
  const filteredCats = typeId ? categories?.filter(c => c.type_id === typeId) : []

  const canEdit = (a: Asset) => user?.is_superuser || user?.role === 'admin' || a.created_by === user?.id
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assets'] }); setSelected(new Set()) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function resetForm() { setShowForm(false); setEditId(null); setName(''); setTypeId(''); setCategoryId(''); setSerial(''); setStatus('active') }
  function openEdit(a: Asset) { setEditId(a.id); setName(a.name); setTypeId(a.type_id || ''); setCategoryId(a.category_id || ''); setSerial(a.serial || ''); setStatus(a.status); setShowForm(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedType = assetTypes?.find(t => t.id === typeId)
    const body = { name, type: selectedType?.name || '', type_id: typeId || null, category_id: categoryId || null, serial, status } as Partial<Asset>
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
    if (!confirm(`Delete ${selected.size} assets?`)) return
    selected.forEach(id => deleteMutation.mutate(id))
    toast(`Deleting ${selected.size} assets...`, 'info')
  }

  const assets = result?.data || []
  const totalPages = result?.total_pages || 1

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
        {!showForm && <button onClick={() => { resetForm(); setShowForm(true) }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">+ New Asset</button>}
      </div>

      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-3 text-sm">
          <span className="font-medium text-indigo-700">{selected.size} selected</span>
          <button onClick={bulkDelete} className="text-red-600 hover:text-red-800 font-medium">Delete all</button>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Asset' : 'New Asset'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name" required />
          <input value={serial} onChange={e => setSerial(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Serial number" />
          <select value={typeId} onChange={e => { setTypeId(e.target.value ? Number(e.target.value) : ''); setCategoryId('') }} className="w-full border rounded-lg px-3 py-2 text-sm" required>
            <option value="">— Select type —</option>
            {assetTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!typeId}>
            <option value="">— No category —</option>
            {filteredCats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-gray-100">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search assets..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value ? Number(e.target.value) : ''); setPage(1) }} className="border rounded-lg px-3 py-2 text-sm"><option value="">All types</option>{assetTypes?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <span className="text-xs text-gray-400">{result?.total || 0} assets</span>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assets.map(asset => (
              <tr key={asset.id} className={selected.has(asset.id) ? 'bg-indigo-50/50' : ''}>
                <td className="px-4 py-4"><input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleSelect(asset.id)} className="rounded" /></td>
                <td className="px-4 py-4 text-sm text-gray-900">{asset.name}</td>
                <td className="px-4 py-4 text-sm text-gray-900">{asset.type_id ? (typeMap.get(asset.type_id) || asset.type) : asset.type}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{asset.category_id ? (catMap.get(asset.category_id) || '—') : '—'}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{asset.serial}</td>
                <td className="px-4 py-4"><span className={`inline-flex px-2 py-1 text-xs rounded-full ${asset.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{asset.status}</span></td>
                <td className="px-4 py-4 text-sm space-x-2">
                  {canEdit(asset) && <button onClick={() => openEdit(asset)} className="text-indigo-600 hover:text-indigo-800">Edit</button>}
                  <button onClick={() => deleteMutation.mutate(asset.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Rows:</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 text-sm">
              {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
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
