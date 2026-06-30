import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type AssetCategory } from '../services/api'
import { useState } from 'react'

const empty = { name: '', type_id: '' as number | '', parent_id: '' as number | '' }

export default function AdminCategories() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState<number | null>(null)

  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: cats } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })

  const filtered = form.type_id ? cats?.filter(c => c.type_id === form.type_id) : cats

  const show = editId !== null || form.name

  const create = useMutation({
    mutationFn: () => api.assetCategories.create({ name: form.name, type_id: form.type_id as number, parent_id: form.parent_id || null }),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
  })

  const update = useMutation({
    mutationFn: () => api.assetCategories.update(editId!, { name: form.name, type_id: form.type_id as number, parent_id: form.parent_id || null }),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetCategories.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-categories'] }),
  })

  function reset() { setForm(empty); setEditId(null) }

  function openEdit(c: AssetCategory) {
    setEditId(c.id)
    setForm({ name: c.name, type_id: c.type_id, parent_id: c.parent_id || '' })
  }

  const byType = new Map<number, typeof cats>()
  cats?.forEach(c => {
    const list = byType.get(c.type_id) || []
    list.push(c)
    byType.set(c.type_id, list)
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Categories</h1>
        {!show && (
          <button onClick={() => setForm({ name: '', type_id: types?.[0]?.id || '', parent_id: '' })} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Category</button>
        )}
      </div>

      {show && (
        <form onSubmit={e => { e.preventDefault(); editId ? update.mutate() : create.mutate() }} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">—</option>
                {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent</label>
              <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— None —</option>
                {filtered?.filter(c => c.id !== editId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">{editId ? 'Update' : 'Create'}</button>
            <button type="button" onClick={reset} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {types?.map(t => {
          const typeCats = cats?.filter(c => c.type_id === t.id) || []
          return (
            <div key={t.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">{t.name}</div>
              {typeCats.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No categories</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {typeCats.map(c => {
                      const parent = cats?.find(p => p.id === c.parent_id)
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{c.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{parent?.name || '—'}</td>
                          <td className="px-4 py-2 text-sm space-x-2">
                            <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                            <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id) }} className="text-red-600 hover:text-red-800">Delete</button>
                          </td>
                        </tr>
                      )
                    })}
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
