import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function AdminOrganizations() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [holdingId, setHoldingId] = useState<number | ''>('')
  const [parentId, setParentId] = useState<number | ''>('')

  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: api.organizations.list })
  const { data: holdings } = useQuery({ queryKey: ['holdings'], queryFn: api.holdings.list })
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() })

  const filtered = holdingId ? orgs?.filter(o => o.holding_id === holdingId) : []

  const create = useMutation({
    mutationFn: () => api.organizations.create({ name, holding_id: holdingId as number, parent_id: parentId || null }),
    onSuccess: () => { setShowForm(false); setName(''); setHoldingId(''); setParentId(''); toast('Organization created', 'success'); queryClient.invalidateQueries({ queryKey: ['organizations'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const setManager = useMutation({
    mutationFn: ({ organizationId, managerUserId }: { organizationId: number; managerUserId: number | null }) => api.organizations.setManager(organizationId, managerUserId),
    onSuccess: () => { toast('Manager organization updated', 'success'); queryClient.invalidateQueries({ queryKey: ['organizations'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const setITOrganization = useMutation({
    mutationFn: ({ holdingId, organizationId }: { holdingId: number; organizationId: number | null }) => api.holdings.setITOrganization(holdingId, organizationId),
    onSuccess: () => { toast('IT destination updated', 'success'); queryClient.invalidateQueries({ queryKey: ['holdings'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const groupByHolding = new Map<number, typeof orgs>()
  orgs?.forEach(o => {
    const list = groupByHolding.get(o.holding_id) || []
    list.push(o)
    groupByHolding.set(o.holding_id, list)
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Organization</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Organization">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Organization name" required />
          <select value={holdingId} onChange={e => setHoldingId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm" required>
            <option value="">— Holding —</option>
            {holdings?.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={parentId} onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— No parent (root) —</option>
            {filtered?.filter(o => o.id !== 0).map(o => <option key={o.id} value={o.id}>{'—'.repeat(o.level)} {o.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <div className="space-y-6">
        {holdings?.map(h => {
          const holdingOrgs = groupByHolding.get(h.id) || []
          return (
            <div key={h.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div><p className="font-semibold text-sm text-gray-700">{h.name}</p><p className="text-xs text-gray-500 mt-0.5">Choose which organization receives IT requests for this holding.</p></div>
                <select value={h.it_organization_id || ''} onChange={event => setITOrganization.mutate({ holdingId: h.id, organizationId: event.target.value ? Number(event.target.value) : null })} className="select sm:w-64" disabled={setITOrganization.isPending}>
                  <option value="">No IT destination configured</option>
                  {holdingOrgs.map(organization => <option key={organization.id} value={organization.id}>{'—'.repeat(organization.level)} {organization.name}</option>)}
                </select>
              </div>
              {holdingOrgs.length === 0 ? <p className="px-4 py-3 text-sm text-gray-400">No organizations</p> : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Level</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parent</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Manager</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {holdingOrgs.map(o => (
                      <tr key={o.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">{'—'.repeat(o.level)} {o.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{o.level}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{orgs?.find(p => p.id === o.parent_id)?.name || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          <select value={o.manager_user_id || ''} onChange={event => setManager.mutate({ organizationId: o.id, managerUserId: event.target.value ? Number(event.target.value) : null })} className="select min-w-48" disabled={setManager.isPending}>
                            <option value="">Inherit from parent</option>
                            {users?.filter(user => !user.deleted_at && (user.organization_id === o.id || user.org_ids?.includes(o.id))).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
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
