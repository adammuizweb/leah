import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type TicketType } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function AdminTicketTypes() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: types } = useQuery({ queryKey: ['ticket-types'], queryFn: api.ticketTypes.list })

  const create = useMutation({
    mutationFn: () => api.ticketTypes.create(name),
    onSuccess: () => { reset(); toast('Ticket type created', 'success'); queryClient.invalidateQueries({ queryKey: ['ticket-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.ticketTypes.update(editId!, name),
    onSuccess: () => { reset(); toast('Ticket type updated', 'success'); queryClient.invalidateQueries({ queryKey: ['ticket-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.ticketTypes.delete(id),
    onSuccess: () => { toast('Ticket type deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['ticket-types'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setName(''); setEditId(null); setShowForm(false) }
  function openEdit(t: TicketType) { setEditId(t.id); setName(t.name); setShowForm(true) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ticket Types</h1>
        {!showForm && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Type</button>}
      </div>

      <Modal open={showForm && editId === null} onClose={reset} title="New Ticket Type">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Incident" required autoFocus />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)} title="Delete Ticket Type" message={`Delete "${deleteTarget?.name}"?`} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {types?.map(t => (
              <tr key={t.id}>
                {editId === t.id ? (
                  <>
                    <td className="px-4 py-3"><input value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" autoFocus /></td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => update.mutate()} className="text-green-600 hover:text-green-800">Save</button>
                      <button onClick={reset} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => openEdit(t)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
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
