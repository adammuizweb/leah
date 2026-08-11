import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type SLAPolicy } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const PRIORITIES = ['critical', 'high', 'medium', 'low']

export default function AdminSLAPolicies() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', priority: 'medium', response_hours: 0, resolve_hours: 0 })
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: policies } = useQuery({ queryKey: ['sla-policies'], queryFn: api.slaPolicies.list })

  const create = useMutation({
    mutationFn: () => api.slaPolicies.create(form),
    onSuccess: () => { reset(); toast('SLA policy created', 'success'); queryClient.invalidateQueries({ queryKey: ['sla-policies'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.slaPolicies.update(editId!, form),
    onSuccess: () => { reset(); toast('SLA policy updated', 'success'); queryClient.invalidateQueries({ queryKey: ['sla-policies'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.slaPolicies.delete(id),
    onSuccess: () => { toast('SLA policy deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['sla-policies'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setForm({ name: '', priority: 'medium', response_hours: 0, resolve_hours: 0 }); setEditId(null); setShowForm(false) }
  function openEdit(p: SLAPolicy) { setEditId(p.id); setShowForm(true); setForm({ name: p.name, priority: p.priority, response_hours: p.response_hours, resolve_hours: p.resolve_hours }) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SLA Policies</h1>
        {!showForm && <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Policy</button>}
      </div>

      <Modal open={showForm && editId === null} onClose={reset} title="New SLA Policy">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Critical SLA" required autoFocus />
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Response (hours)</label>
              <input type="number" min={1} value={form.response_hours} onChange={e => setForm({ ...form, response_hours: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Resolve (hours)</label>
              <input type="number" min={1} value={form.resolve_hours} onChange={e => setForm({ ...form, resolve_hours: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)} title="Delete SLA Policy" message={`Delete "${deleteTarget?.name}"? Tickets referencing this policy will keep their SLA deadlines.`} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolve</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {policies?.map(p => (
              <tr key={p.id}>
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-3"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border rounded px-2 py-1 text-sm w-full" autoFocus /></td>
                    <td className="px-4 py-3">
                      <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="border rounded px-2 py-1 text-sm">
                        {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3"><input type="number" value={form.response_hours} onChange={e => setForm({ ...form, response_hours: Number(e.target.value) })} className="border rounded px-2 py-1 text-sm w-20" /></td>
                    <td className="px-4 py-3"><input type="number" value={form.resolve_hours} onChange={e => setForm({ ...form, resolve_hours: Number(e.target.value) })} className="border rounded px-2 py-1 text-sm w-20" /></td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => update.mutate()} className="text-green-600 hover:text-green-800">Save</button>
                      <button onClick={reset} className="text-gray-500 hover:text-gray-700">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${p.priority === 'critical' ? 'bg-red-100 text-red-800' : p.priority === 'high' ? 'bg-orange-100 text-orange-800' : p.priority === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{p.priority}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.response_hours}h</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.resolve_hours}h</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button onClick={() => openEdit(p)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => setDeleteTarget({ id: p.id, name: p.name })} className="text-red-600 hover:text-red-800">Delete</button>
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
