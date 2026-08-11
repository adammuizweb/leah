import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type AssetModel } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function AdminModels() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', manufacturer: '', part_number: '', type_id: '' as number | '', category_id: '' as number | '' })
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: models } = useQuery({ queryKey: ['asset-models'], queryFn: api.assetModels.list })
  const { data: types } = useQuery({ queryKey: ['asset-types'], queryFn: api.assetTypes.list })
  const { data: cats } = useQuery({ queryKey: ['asset-categories'], queryFn: api.assetCategories.list })

  const filteredCats = form.type_id ? cats?.filter(c => c.type_id === form.type_id) : cats

  const create = useMutation({
    mutationFn: () => api.assetModels.create({ ...form, type_id: form.type_id || null, category_id: form.category_id || null }),
    onSuccess: () => { reset(); toast('Model created', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-models'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.assetModels.update(editId!, { ...form, type_id: form.type_id || null, category_id: form.category_id || null }),
    onSuccess: () => { reset(); toast('Model updated', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-models'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.assetModels.delete(id),
    onSuccess: () => { toast('Model deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['asset-models'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setForm({ name: '', manufacturer: '', part_number: '', type_id: '', category_id: '' }); setEditId(null); setShowForm(false) }
  function openEdit(m: AssetModel) { setEditId(m.id); setShowForm(true); setForm({ name: m.name, manufacturer: m.manufacturer, part_number: m.part_number, type_id: m.type_id || '', category_id: m.category_id || '' }) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Models</h1>
        {!showForm && editId === null && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Model</button>}
      </div>

      <Modal open={showForm && editId === null} onClose={reset} title="New Asset Model">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. MikroTik hAP AC2" required autoFocus />
          <div className="flex gap-2">
            <input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Manufacturer (e.g. MikroTik)" />
            <input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Part # (e.g. RB952Ui-5ac2nD)" />
          </div>
          <select value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value ? Number(e.target.value) : '', category_id: '' })} className="w-full border rounded-lg px-3 py-2 text-sm" required>
            <option value="">— Select type —</option>
            {types?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!form.type_id}>
            <option value="">— No category —</option>
            {filteredCats?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)} title="Delete Model" message={`Delete "${deleteTarget?.name}"? Assets referencing this model will lose their model reference.`} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models?.map(m => (
              <tr key={m.id}>
                {editId === m.id ? (
                  <>
                    <td className="px-4 py-3"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border rounded px-2 py-1 text-sm w-full" autoFocus /></td>
                    <td className="px-4 py-3"><input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-3"><input value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} className="border rounded px-2 py-1 text-sm w-full" /></td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => update.mutate()} className="text-green-600 hover:text-green-800">Save</button>
                      <button onClick={reset} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{m.manufacturer || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{m.part_number || '—'}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => openEdit(m)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => setDeleteTarget({ id: m.id, name: m.name })} className="text-red-600 hover:text-red-800">Delete</button>
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
