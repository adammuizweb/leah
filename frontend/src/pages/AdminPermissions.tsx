import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Permission } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const moduleLabels: Record<string, string> = {
  tickets: '🎫 Tickets',
  assets: '📦 Assets',
  users: '👥 Users',
  types: '📋 Asset Types',
  categories: '📂 Categories',
  settings: '⚙️ Settings',
}

const moduleDescs: Record<string, string> = {
  tickets: 'Helpdesk ticket management',
  assets: 'IT asset inventory',
  users: 'User account management',
  types: 'Asset type categories (Laptop, Monitor, Server...)',
  categories: 'Hierarchical asset sub-categories',
  settings: 'Role & permission management, bin, system config',
}

const actionAlias: Record<string, string> = {
  create: 'Create',
  read: 'Read',
  'read.own': 'Read own',
  update: 'Update',
  delete: 'Delete',
  bulk_delete: 'Bulk delete',
  assign: 'Assign',
}

export default function AdminPermissions() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editRoleId, setEditRoleId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
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
    onSuccess: () => { toast('Permissions updated', 'success'); queryClient.invalidateQueries({ queryKey: ['role-permissions', editRoleId] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const createRole = useMutation({
    mutationFn: () => api.roles.create({ name: newName, label: newLabel, is_admin: false }),
    onSuccess: () => { setShowCreate(false); setNewName(''); setNewLabel(''); toast('Role created', 'success'); queryClient.invalidateQueries({ queryKey: ['roles'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteRole = useMutation({
    mutationFn: (id: number) => api.roles.delete(id),
    onSuccess: () => { toast('Role deleted', 'success'); setEditRoleId(null); queryClient.invalidateQueries({ queryKey: ['roles'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
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

  const roleBadge = (r: { name: string; is_admin: boolean }) => {
    if (r.name === 'superadmin') return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Superadmin</span>
    if (r.is_admin) return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
    return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.name}</span>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Role</button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Role">
        <form onSubmit={e => { e.preventDefault(); createRole.mutate() }} className="space-y-4">
          <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Role name (e.g. manager)" required />
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Display label (e.g. Manager)" required />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteRole.mutate(deleteTarget.id)} title="Delete Role" message={`Delete role "${deleteTarget?.name}"? Users with this role will lose their permissions.`} />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <div className="bg-white rounded-lg shadow p-4 space-y-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Roles</h2>
          {roles?.map(r => (
            <div key={r.id} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${editRoleId === r.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setEditRoleId(r.id)}>
                <span className="font-medium">{r.label}</span>
                {roleBadge(r)}
              </div>
              {editRoleId === r.id && !['superadmin', 'admin', 'agent', 'user'].includes(r.name) && (
                <button onClick={() => setDeleteTarget({ id: r.id, name: r.label })} className="text-xs text-red-500 hover:text-red-700 mt-1">Delete role</button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {editRoleId ? (
            <>
              <h2 className="text-lg font-semibold mb-1">{roles?.find(r => r.id === editRoleId)?.label}</h2>
              <p className="text-xs text-gray-400 mb-4">Toggle permissions for this role</p>
              <div className="space-y-6">
                {Object.entries(grouped).map(([module, perms]) => {
                  const allSelected = perms.every(p => selectedPermIds.has(p.id))
                  return (
                    <div key={module}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700">{moduleLabels[module] || module}</h3>
                          <p className="text-xs text-gray-400">{moduleDescs[module] || ''}</p>
                        </div>
                        <button
                          onClick={() => {
                            const ids = allSelected
                              ? (rolePerms || []).filter(p => p.module !== module).map(p => p.id)
                              : [...new Set([...(rolePerms || []).map(p => p.id), ...perms.map(p => p.id)])]
                            setPerms.mutate(ids)
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          {allSelected ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {perms.map(p => (
                          <label key={p.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${selectedPermIds.has(p.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 hover:border-gray-300'}`}>
                            <input type="checkbox" checked={selectedPermIds.has(p.id)} onChange={() => togglePerm(p.id)} className="sr-only" />
                            {actionAlias[p.action] || p.action}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {setPerms.isPending && <p className="text-xs text-gray-400 mt-3">Saving...</p>}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">🔐</p>
              <p className="text-sm">Select a role to manage permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
