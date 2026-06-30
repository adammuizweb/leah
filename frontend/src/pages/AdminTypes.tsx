import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function AdminTypes() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })

  const create = useMutation({
    mutationFn: () => api.assetTypes.create(name),
    onSuccess: () => { reset(); toast('Type created', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.assetTypes.update(editId!, name),
    onSuccess: () => { reset(); toast('Type updated', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetTypes.delete(id),
    onSuccess: () => { toast('Type deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setEditId(null); setName(''); setShowForm(false) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Types</h1>
        {!showForm && editId === null && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Type</button>}
      </div>

      <Modal open={showForm && editId === null} onClose={reset} title="New Asset Type">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }}>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-4" placeholder="e.g. Tablet" required autoFocus />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)}
        title="Delete Type"
        message={`Delete "${deleteTarget?.name}"? Assets referencing this type must be reassigned first.`}
      />

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
                      <button onClick={() => setDeleteTarget({ id: t.id, name: t.name })} className="text-red-600 hover:text-red-800">Delete</button>
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
