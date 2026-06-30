import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Permission } from '../services/api'
import { useState } from 'react'

export default function AdminPermissions() {
  const queryClient = useQueryClient()
  const [editRoleId, setEditRoleId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: api.roles.list })
  const { data: allPerms } = useQuery({ queryKey: ['permissions'], queryFn: api.permissions.list })

  const { data: rolePerms } = useQuery({
    queryKey: ['role-permissions', editRoleId],
    queryFn: () => api.roles.getPermissions(editRoleId!),
    enabled: !!editRoleId,
  })

  const selectedPermIds = new Set(rolePerms?.map(p => p.id) || [])

  const setPerms = useMutation({
    mutationFn: (ids: number[]) => api.roles.setPermissions(editRoleId!, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['role-permissions', editRoleId] }),
  })

  const createRole = useMutation({
    mutationFn: () => api.roles.create({ name: newName, label: newLabel, is_admin: false }),
    onSuccess: () => { setShowCreate(false); setNewName(''); setNewLabel(''); queryClient.invalidateQueries({ queryKey: ['roles'] }) },
  })

  function togglePerm(pid: number) {
    const ids = selectedPermIds.has(pid)
      ? (rolePerms || []).filter(p => p.id !== pid).map(p => p.id)
      : [...(rolePerms || []).map(p => p.id), pid]
    setPerms.mutate(ids)
  }

  const grouped = allPerms?.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] = acc[p.module] || []).push(p)
    return acc
  }, {}) || {}

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Role</button>
      </div>

      {showCreate && (
        <form onSubmit={e => { e.preventDefault(); createRole.mutate() }} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="manager" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Manager" required />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Roles</h2>
          {roles?.map(r => (
            <button
              key={r.id}
              onClick={() => setEditRoleId(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${editRoleId === r.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50'}`}
            >
              <div>{r.label}</div>
              <div className="text-xs text-gray-400">{r.is_admin ? 'Admin (full access)' : r.name}</div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {editRoleId ? (
            <>
              <h2 className="text-lg font-semibold mb-4">{roles?.find(r => r.id === editRoleId)?.label} — Permissions</h2>
              <div className="space-y-4">
                {Object.entries(grouped).map(([module, perms]) => (
                  <div key={module}>
                    <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">{module}</h3>
                    <div className="flex flex-wrap gap-2">
                      {perms.map(p => (
                        <label key={p.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${selectedPermIds.has(p.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={selectedPermIds.has(p.id)} onChange={() => togglePerm(p.id)} className="sr-only" />
                          {p.action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {setPerms.isPending && <p className="text-xs text-gray-400 mt-2">Saving...</p>}
            </>
          ) : (
            <p className="text-gray-500 text-sm">Select a role to manage permissions</p>
          )}
        </div>
      </div>
    </div>
  )
}
