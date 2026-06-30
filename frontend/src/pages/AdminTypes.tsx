import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useState } from 'react'

export default function AdminTypes() {
  const queryClient = useQueryClient()
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })

  const create = useMutation({
    mutationFn: () => api.assetTypes.create(name),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['asset-types'] }) },
  })

  const update = useMutation({
    mutationFn: () => api.assetTypes.update(editId!, name),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['asset-types'] }) },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetTypes.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asset-types'] }),
  })

  function reset() { setEditId(null); setName(''); setShowForm(false) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Types</h1>
        {!showForm && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Type</button>}
      </div>

      {showForm && editId === null && (
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="bg-white rounded-lg shadow p-6 mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Tablet" required autoFocus />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
          <button type="button" onClick={reset} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {types?.map(t => (
              <tr key={t.id}>
                {editId === t.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" autoFocus />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => update.mutate()} className="text-green-600 hover:text-green-800">Save</button>
                      <button onClick={reset} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => { setEditId(t.id); setName(t.name) }} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => { if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id) }} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
