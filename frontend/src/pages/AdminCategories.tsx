import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type AssetCategory } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function AdminCategories() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ name: '', type_id: '' as number | '', parent_id: '' as number | '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: cats } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })

  const filtered = form.type_id ? cats?.filter(c => c.type_id === form.type_id) : cats

  const create = useMutation({
    mutationFn: () => api.assetCategories.create({ name: form.name, type_id: form.type_id as number, parent_id: form.parent_id || null }),
    onSuccess: () => { reset(); toast('Category created', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.assetCategories.update(editId!, { name: form.name, type_id: form.type_id as number, parent_id: form.parent_id || null }),
    onSuccess: () => { reset(); toast('Category updated', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetCategories.delete(id),
    onSuccess: () => { toast('Category deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setForm({ name: '', type_id: '' as number | '', parent_id: '' as number | '' }); setEditId(null); setShowForm(false) }
  function openEdit(c: AssetCategory) { setEditId(c.id); setShowForm(true); setForm({ name: c.name, type_id: c.type_id, parent_id: c.parent_id || '' }) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        {!showForm && <button onClick={() => { setEditId(null); setShowForm(true); setForm({ name: '', type_id: '', parent_id: '' }) }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Category</button>}
      </div>

      <Modal open={showForm} onClose={reset} title={editId ? 'Edit Category' : 'New Category'}>
        <form onSubmit={e => { e.preventDefault(); editId ? update.mutate() : create.mutate() }} className="space-y-4">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Category name" required autoFocus />
          <select value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm" required>
            <option value="">— Type —</option>
            {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— No parent —</option>
            {filtered?.filter(c => c.id !== editId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)} title="Delete Category" message={`Delete "${deleteTarget?.name}"?`} />

      <div className="space-y-6">
        {types?.map(t => {
          const typeCats = cats?.filter(c => c.type_id === t.id) || []
          return (
            <div key={t.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">{t.name}</div>
              {typeCats.length === 0 ? <p className="px-4 py-3 text-sm text-gray-400">No categories</p> : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {typeCats.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{c.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{cats?.find(p => p.id === c.parent_id)?.name || '—'}</td>
                        <td className="px-4 py-2 text-sm space-x-2">
                          <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                          <button onClick={() => setDeleteTarget({ id: c.id, name: c.name })} className="text-red-600 hover:text-red-800">Delete</button>
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
