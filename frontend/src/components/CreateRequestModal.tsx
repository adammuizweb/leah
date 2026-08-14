import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import { useToast } from './Toast'
import { useAuth } from '../services/auth'
import { api, type CreateRequestInput } from '../services/api'
import { REQUEST_KIND_DESCRIPTIONS, REQUEST_KIND_LABELS, type RequestKind } from '../request'

interface Props {
  open: boolean
  onClose: () => void
}

const kinds: RequestKind[] = ['incident', 'service', 'software']

export default function CreateRequestModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const [kind, setKind] = useState<RequestKind | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assetId, setAssetId] = useState<number | ''>('')
  const [softwareName, setSoftwareName] = useState('')
  const [businessObjective, setBusinessObjective] = useState('')
  const [targetUsers, setTargetUsers] = useState('')
  const [desiredDueDate, setDesiredDueDate] = useState('')

  const canReadAllAssets = hasPermission('assets.read')
  const canReadOwnAssets = hasPermission('assets.read.own')
  const { data: assets } = useQuery({
    queryKey: [canReadAllAssets ? 'assets-request-picker' : 'my-assets-request-picker'],
    queryFn: () => canReadAllAssets ? api.assets.list({ per_page: '200' }) : api.assets.mine({ per_page: '200' }),
    enabled: open && (canReadAllAssets || canReadOwnAssets),
  })

  function reset() {
    setKind(null)
    setTitle('')
    setDescription('')
    setPriority('medium')
    setAssetId('')
    setSoftwareName('')
    setBusinessObjective('')
    setTargetUsers('')
    setDesiredDueDate('')
  }

  function close() {
    reset()
    onClose()
  }

  const create = useMutation({
    mutationFn: (input: CreateRequestInput) => api.tickets.create(input),
    onSuccess: ticket => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      toast('Request submitted', 'success')
      close()
      navigate(`/tickets/${ticket.id}`)
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!kind) return
    create.mutate({
      title,
      description,
      priority,
      request_kind: kind,
      asset_id: assetId || null,
      software_name: kind === 'software' ? softwareName : undefined,
      business_objective: kind === 'software' ? businessObjective : undefined,
      target_users: kind === 'software' ? targetUsers : undefined,
      desired_due_date: kind === 'software' && desiredDueDate ? `${desiredDueDate}T00:00:00Z` : null,
    })
  }

  return (
    <Modal open={open} onClose={close} title="Create Request" size="lg">
      {!kind ? (
        <div>
          <p className="text-sm text-gray-500 mb-5">What do you need help with?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {kinds.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className="group rounded-xl border border-gray-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${item === 'software' ? 'bg-violet-100 text-violet-700' : item === 'service' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item === 'software' ? 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' : item === 'service' ? 'M12 6V4m0 16v-2m6-6h2M4 12H2m15.657-5.657l1.414-1.414M4.929 19.071l1.414-1.414m0-11.314L4.929 4.929m14.142 14.142l-1.414-1.414M15 12a3 3 0 11-6 0 3 3 0 016 0z' : 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z'} /></svg>
                </div>
                <p className="font-semibold text-gray-900 group-hover:text-brand-700">{REQUEST_KIND_LABELS[item]}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{REQUEST_KIND_DESCRIPTIONS[item]}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <button type="button" onClick={() => setKind(null)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">&larr; Change request type</button>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Request type</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{REQUEST_KIND_LABELS[kind]}</p>
          </div>
          <div>
            <label className="label">Summary</label>
            <input value={title} onChange={event => setTitle(event.target.value)} className="input" placeholder={kind === 'software' ? 'e.g. Employee leave management application' : 'Briefly describe what you need'} required autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={event => setDescription(event.target.value)} className="input" rows={4} placeholder="Add context, impact, and what a successful outcome looks like." />
          </div>
          {kind === 'software' && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Software proposal</h3>
                <p className="text-xs text-gray-500 mt-0.5">Focus on the business need. Technical design can follow during discovery.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Software name</label>
                  <input value={softwareName} onChange={event => setSoftwareName(event.target.value)} className="input" placeholder="Working title" required />
                </div>
                <div>
                  <label className="label">Target users</label>
                  <input value={targetUsers} onChange={event => setTargetUsers(event.target.value)} className="input" placeholder="e.g. HR team, all employees" required />
                </div>
              </div>
              <div>
                <label className="label">Business objective</label>
                <textarea value={businessObjective} onChange={event => setBusinessObjective(event.target.value)} className="input" rows={3} placeholder="What problem should this software solve, and why now?" required />
              </div>
              <div>
                <label className="label">Desired delivery date <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="date" value={desiredDueDate} onChange={event => setDesiredDueDate(event.target.value)} className="input sm:max-w-xs" />
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={event => setPriority(event.target.value)} className="select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            {(canReadAllAssets || canReadOwnAssets) && (
              <div>
                <label className="label">Related asset <span className="font-normal text-gray-400">(optional)</span></label>
                <select value={assetId} onChange={event => setAssetId(event.target.value ? Number(event.target.value) : '')} className="select">
                  <option value="">No related asset</option>
                  {assets?.data.map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.serial ? ` (${asset.serial})` : ''}</option>)}
                </select>
              </div>
            )}
          </div>
          {kind === 'software' && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Software requests are submitted for approval before they enter the delivery backlog.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Submitting...' : 'Submit Request'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
