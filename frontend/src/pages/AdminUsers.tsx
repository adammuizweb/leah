import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type User } from '../services/api'
import { useState } from 'react'

export default function AdminUsers() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState<'create' | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState<number | null>(null)

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: api.users.list })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: api.roles.list })
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: api.me })

  const create = useMutation({
    mutationFn: (d: { email: string; name: string; password: string; role_id: number | null }) =>
      api.users.create(d),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['users'] }) },
  })

  const update = useMutation({
    mutationFn: (d: { id: number; email: string; name: string; role_id: number | null }) =>
      api.users.update(d.id, d),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['users'] }) },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.users.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  function reset() {
    setShowForm(null); setEditId(null); setEmail(''); setName(''); setPassword(''); setRoleId(null)
  }

  function openEdit(u: User) {
    setEditId(u.id); setEmail(u.email); setName(u.name); setRoleId(u.role_id); setPassword('')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={() => setShowForm('create')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ Add User</button>
      </div>

      {(showForm || editId) && (
        <form onSubmit={e => {
          e.preventDefault()
          editId
            ? update.mutate({ id: editId, email, name, role_id: roleId })
            : create.mutate({ email, name, password, role_id: roleId })
        }} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            {!editId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={roleId ?? ''} onChange={e => setRoleId(e.target.value ? Number(e.target.value) : null)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                {roles?.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">{editId ? 'Update' : 'Create'}</button>
            <button type="button" onClick={reset} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
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
                    {!isMe && <button onClick={() => del.mutate(u.id)} className="text-red-600 hover:text-red-800">{u.deleted_at ? 'Purge' : 'Delete'}</button>}
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
