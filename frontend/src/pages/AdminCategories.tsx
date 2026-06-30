import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useState } from 'react'

export default function AdminCategories() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [parentId, setParentId] = useState<number | ''>('')

  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: cats } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })

  const filteredCats = typeId ? cats?.filter(c => c.type_id === typeId) : cats

  const create = useMutation({
    mutationFn: () => api.assetCategories.create({ name, type_id: typeId as number, parent_id: parentId || null }),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['asset-categories'] }) },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetCategories.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-categories'] }),
  })

  function reset() { setName(''); setTypeId(''); setParentId(''); setShowForm(false) }

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
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Category</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select value={typeId} onChange={e => setTypeId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                <option value="">—</option>
                {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent (optional)</label>
              <select value={parentId} onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— None (top-level) —</option>
                {filteredCats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
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
                          <td className="px-4 py-2 text-sm">
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
