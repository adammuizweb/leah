import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type User } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState({ email: '', name: '', password: '', role_id: '' as number | '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.users.list })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: api.roles.list })
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: api.me })

  const isEditing = editId !== null

  const create = useMutation({
    mutationFn: () => api.users.create({ email: form.email, name: form.name, password: form.password, role_id: form.role_id || null }),
    onSuccess: () => { reset(); toast('User created', 'success'); queryClient.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const update = useMutation({
    mutationFn: () => api.users.update(editId!, { email: form.email, name: form.name, role_id: form.role_id || null }),
    onSuccess: () => { reset(); toast('User updated', 'success'); queryClient.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.users.delete(id),
    onSuccess: () => { toast('User deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function reset() { setForm({ email: '', name: '', password: '', role_id: '' }); setEditId(null); setShowForm(false) }
  function openEdit(u: User) { setEditId(u.id); setShowForm(true); setForm({ email: u.email, name: u.name, password: '', role_id: u.role_id || '' }) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        {!showForm && <button onClick={() => { setEditId(null); setShowForm(true) }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ Add User</button>}
      </div>

      <Modal open={showForm} onClose={reset} title={isEditing ? 'Edit User' : 'New User'}>
        <form onSubmit={e => { e.preventDefault(); isEditing ? update.mutate() : create.mutate() }} className="space-y-4">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name" required />
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email" required />
          {!isEditing && <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Password" required />}
          <select value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value ? Number(e.target.value) : '' })} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— Role —</option>
            {roles?.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{isEditing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)} title="Delete User" message={`Delete "${deleteTarget?.name}"?`} />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {users?.map(u => {
              const isMe = currentUser?.user.id === u.id
              return (
                <tr key={u.id} className={u.deleted_at ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-sm">{u.role || '—'}</td>
                  <td className="px-4 py-3 text-sm">{u.deleted_at ? <span className="text-red-500">Deleted</span> : <span className="text-green-500">Active</span>}</td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-800" disabled={!!u.deleted_at}>Edit</button>
                    {!isMe && <button onClick={() => setDeleteTarget({ id: u.id, name: u.name })} className="text-red-600 hover:text-red-800">{u.deleted_at ? 'Purge' : 'Delete'}</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
