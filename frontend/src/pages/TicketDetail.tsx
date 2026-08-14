import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../services/auth'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { DetailSkeleton } from '../components/LoadingSkeleton'
import { APPROVAL_LABELS, REQUEST_KIND_LABELS, SOFTWARE_REQUEST_TYPE_LABELS, approvalClass, type ApprovalStatus, type RequestKind, type SoftwareRequestType } from '../request'

const STATUS_LABELS: Record<string, string> = {
  new: 'New', open: 'Open', in_progress: 'In Progress', pending: 'Pending',
  resolved: 'Resolved', closed: 'Closed', cancelled: 'Cancelled',
}

const validTransitions: Record<string, string[]> = {
  new: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['pending', 'resolved'],
  pending: ['in_progress', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
  cancelled: [],
}

const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  department_manager: 'Manager Divisi',
  it_review: 'Review Staf IT',
  it_manager: 'Manager IT',
}

const WORKFLOW_DECISION_LABELS: Record<string, string> = {
  approved: 'Disetujui',
  rejected: 'Ditolak',
  recommended: 'Direkomendasikan',
  not_recommended: 'Tidak direkomendasikan',
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, permissions, hasPermission } = useAuth()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null)
  const [workflowAction, setWorkflowAction] = useState<{ stage: 'manager' | 'it' | 'it_manager'; decision: 'approved' | 'rejected' | 'recommended' | 'not_recommended' } | null>(null)
  const [workflowNote, setWorkflowNote] = useState('')

  const isAdmin = user?.is_root || user?.role === 'admin' || user?.role === 'superadmin'
  const canInternal = isAdmin || permissions.includes('tickets.internal')
  const canChangeStatus = isAdmin || permissions.includes('tickets.update')
  const canComment = hasPermission('tickets.comment')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(Number(id)),
    enabled: !!id,
  })

  const { data: types } = useQuery({ queryKey: ['ticket-types'], queryFn: api.ticketTypes.list, enabled: hasPermission('ticket_types.read') })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.tickets.comments.list(Number(id)),
    enabled: !!id,
  })
  const { data: history } = useQuery({
    queryKey: ['ticket-history', id],
    queryFn: () => api.tickets.history(Number(id)),
    enabled: !!id,
  })
  const { data: workflowHistory } = useQuery({
    queryKey: ['ticket-workflow-history', id],
    queryFn: () => api.tickets.workflowHistory(Number(id)),
    enabled: !!id,
  })

  const typeMap = new Map(types?.map(t => [t.id, t]) || [])

  const statusMutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) =>
      api.tickets.updateStatus(Number(id), status, note),
    onSuccess: () => {
      toast('Status updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-history', id] })
      setShowStatusModal(false)
      setNewStatus('')
      setStatusNote('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.tickets.comments.create(Number(id), { content: comment, is_internal: isInternal }),
    onSuccess: () => {
      toast('Comment added', 'success')
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setComment('')
      setIsInternal(false)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (cid: number) => api.tickets.comments.delete(Number(id), cid),
    onSuccess: () => { toast('Comment deleted', 'success'); queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const workflowMutation = useMutation({
    mutationFn: ({ action, note }: { action: NonNullable<typeof workflowAction>; note: string }) => {
      if (action.stage === 'manager') return api.tickets.departmentManagerReview(Number(id), action.decision as 'approved' | 'rejected', note)
      if (action.stage === 'it') return api.tickets.itReview(Number(id), action.decision as 'recommended' | 'not_recommended', note)
      return api.tickets.itManagerReview(Number(id), action.decision as 'recommended' | 'not_recommended', note)
    },
    onSuccess: () => {
      toast('Keputusan berhasil disimpan', 'success')
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-workflow-history', id] })
      queryClient.invalidateQueries({ queryKey: ['ticket-history', id] })
      setWorkflowAction(null)
      setWorkflowNote('')
    },
    onError: (error: Error) => toast(error.message, 'error'),
  })

  if (isLoading) return <DetailSkeleton />
  if (!ticket) return (
    <div className="flex flex-col items-center justify-center py-24">
      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Request not found</h2>
      <p className="text-sm text-gray-500 mb-4">The request doesn't exist, was deleted, or is outside your access.</p>
      <Link to="/tickets" className="btn-primary">Back to Requests</Link>
    </div>
  )

  const allowedTransitions = validTransitions[ticket.status] || []
  const availableTransitions = ticket.request_kind !== 'support' && ticket.approval_status !== 'approved'
    ? allowedTransitions.filter(status => status === 'cancelled')
    : allowedTransitions

  function closeWorkflowModal() {
    setWorkflowAction(null)
    setWorkflowNote('')
  }

  const workflowNoteRequired = workflowAction?.stage === 'it' || workflowAction?.decision === 'rejected' || workflowAction?.decision === 'not_recommended'
  const workflowIsPositive = workflowAction?.decision === 'approved' || workflowAction?.decision === 'recommended'
  const workflowTitle = workflowAction?.stage === 'manager'
    ? (workflowIsPositive ? 'Setujui Permintaan Divisi' : 'Tolak Permintaan Divisi')
    : workflowAction?.stage === 'it'
      ? 'Hasil Review Staf IT'
      : 'Pengesahan Manager IT'
  const legacyWorkflow = workflowHistory?.find(item => item.stage === 'legacy_approval')
  const approvalLabel = ticket.legacy_workflow
    ? (ticket.approval_status === 'approved' ? 'Disetujui (alur lama)' : 'Ditolak (alur lama)')
    : APPROVAL_LABELS[ticket.approval_status as ApprovalStatus]

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Requests
      </Link>

      {/* Header card */}
      <div className="card mb-6">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{ticket.title}</h1>
                <Badge value={ticket.status} icon="dot" />
              </div>
              <p className="text-sm text-gray-500">
                #{ticket.id} &middot; {ticket.created_by_name || 'Pemohon'}{(ticket.requester_display_title || ticket.requester_identity_type) ? ` sebagai ${ticket.requester_display_title || ticket.requester_identity_type}` : ''} &middot; {ticket.organization_name || 'Tanpa organisasi'} &middot; {formatDate(ticket.created_at)}
              </p>
              <p className="text-xs font-medium text-brand-700 mt-1">{REQUEST_KIND_LABELS[ticket.request_kind as RequestKind]}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {ticket.can_manager_review && <>
                <button onClick={() => setWorkflowAction({ stage: 'manager', decision: 'rejected' })} className="btn-secondary text-red-600">Tolak</button>
                <button onClick={() => setWorkflowAction({ stage: 'manager', decision: 'approved' })} className="btn-primary">Setujui dan Kirim ke IT</button>
              </>}
              {ticket.can_it_review && <>
                <button onClick={() => setWorkflowAction({ stage: 'it', decision: 'not_recommended' })} className="btn-secondary text-red-600">Tidak Direkomendasikan</button>
                <button onClick={() => setWorkflowAction({ stage: 'it', decision: 'recommended' })} className="btn-primary bg-sky-600 hover:bg-sky-700">Rekomendasikan ke Manager IT</button>
              </>}
              {ticket.can_it_manager_review && <>
                <button onClick={() => setWorkflowAction({ stage: 'it_manager', decision: 'not_recommended' })} className="btn-secondary text-red-600">Tidak Direkomendasikan</button>
                <button onClick={() => setWorkflowAction({ stage: 'it_manager', decision: 'recommended' })} className="btn-primary bg-emerald-600 hover:bg-emerald-700">Sahkan Rekomendasi IT</button>
              </>}
              {canChangeStatus && availableTransitions.length > 0 && (
                <button onClick={() => setShowStatusModal(true)} className="btn-primary shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Change Status
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Priority</p>
              <Badge value={ticket.priority} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</p>
              <p className="text-sm font-medium text-gray-900">{ticket.type_id ? (typeMap.get(ticket.type_id)?.name || '—') : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Asset</p>
              <p className="text-sm font-medium text-gray-900">{ticket.asset_id ? `#${ticket.asset_id}` : '—'}</p>
            </div>
            {ticket.sla_resolve_at && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">SLA Deadline</p>
                <p className={`text-sm font-medium ${new Date(ticket.sla_resolve_at) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(ticket.sla_resolve_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Description + Comments */}
        <div className="lg:col-span-2 space-y-6">
          {ticket.request_kind === 'software' && (
            <div className="card p-6 border-violet-200">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div><h2 className="text-base font-semibold text-gray-900">Kebutuhan Aplikasi</h2><p className="text-xs text-gray-500 mt-0.5">Pengajuan formal dari divisi pemohon untuk direview bersama IT.</p></div>
                <span className={`badge ${approvalClass(ticket.approval_status as ApprovalStatus)}`}>{approvalLabel}</span>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Jenis pengembangan</dt><dd className="mt-1 text-gray-900 font-medium">{ticket.software_request_type && ticket.software_request_type !== 'unspecified' ? SOFTWARE_REQUEST_TYPE_LABELS[ticket.software_request_type as SoftwareRequestType] : 'Belum diklasifikasikan (data lama)'}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Nama aplikasi</dt><dd className="mt-1 text-gray-900 font-medium">{ticket.software_name}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Pengguna</dt><dd className="mt-1 text-gray-900">{ticket.target_users || 'Belum ditentukan'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Tujuan dan manfaat</dt><dd className="mt-1 text-gray-700 whitespace-pre-wrap">{ticket.business_objective}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Waktu yang diharapkan</dt><dd className="mt-1 text-gray-700">{ticket.desired_due_date ? new Date(ticket.desired_due_date).toLocaleDateString('id-ID') : 'Fleksibel'}</dd></div>
              </dl>
            </div>
          )}
          {ticket.request_kind === 'technology_review' && (
            <div className="card p-6 border-sky-200">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div><h2 className="text-base font-semibold text-gray-900">Review Teknologi</h2><p className="text-xs text-gray-500 mt-0.5">IT memberi rekomendasi teknis. Divisi pemohon tetap mengajukan pembelian ke Keuangan.</p></div>
                <span className={`badge ${approvalClass(ticket.approval_status as ApprovalStatus)}`}>{approvalLabel}</span>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Barang/aplikasi/vendor</dt><dd className="mt-1 text-gray-900 font-medium">{ticket.technology_name}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Vendor</dt><dd className="mt-1 text-gray-900">{ticket.vendor_name || 'Belum ditentukan'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Tujuan penggunaan</dt><dd className="mt-1 text-gray-700 whitespace-pre-wrap">{ticket.business_objective}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Informasi/spesifikasi</dt><dd className="mt-1 text-gray-700 whitespace-pre-wrap">{ticket.specification}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Perkiraan harga</dt><dd className="mt-1 text-gray-700">{ticket.estimated_cost != null ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(ticket.estimated_cost) : 'Belum diketahui'}</dd></div>
              </dl>
            </div>
          )}
          {/* Description */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Description</h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.description || <span className="text-gray-400 italic">No description provided.</span>}
            </div>
          </div>

          {/* Comments */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Comments</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 mb-6">
                {!comments?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first to respond.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className={`rounded-lg p-4 text-sm ${c.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700 shrink-0">
                            {(c.user_name || c.user_email || '?').charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">{c.user_name || c.user_email}</span>
                          {c.is_internal && (
                            <span className="badge bg-amber-100 text-amber-700 ring-1 ring-amber-600/20 text-[10px]">Internal</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                          {isAdmin && (
                            <button onClick={() => setDeleteCommentId(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment */}
              {canComment && <form onSubmit={e => { e.preventDefault(); if (comment.trim()) commentMutation.mutate() }} className="space-y-3">
                <textarea value={comment} onChange={e => setComment(e.target.value)} className="input" placeholder="Type your comment..." rows={3} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button type="submit" disabled={!comment.trim() || commentMutation.isPending} className="btn-primary btn-sm">
                      {commentMutation.isPending ? (
                        <span className="flex items-center gap-2"><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</span>
                      ) : (
                        <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Send</span>
                      )}
                    </button>
                    {canInternal && (
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none hover:text-gray-900 transition-colors">
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                        Internal note
                      </label>
                    )}
                  </div>
                </div>
              </form>}
            </div>
          </div>
        </div>

        {/* Right column: Status History */}
        <div className="space-y-6">
          {ticket.request_kind !== 'support' && <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900">Alur Persetujuan</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">Setiap keputusan tercatat bersama nama dan waktunya.</p>
            {ticket.legacy_workflow ? <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">Keputusan Alur Lama</p><span className={`text-xs font-medium ${ticket.approval_status === 'rejected' ? 'text-red-600' : 'text-emerald-700'}`}>{ticket.approval_status === 'approved' ? 'Disetujui' : 'Ditolak'}</span></div>
              {legacyWorkflow ? <><p className="text-xs text-gray-600 mt-1">{legacyWorkflow.actor_name} &middot; {formatDate(legacyWorkflow.created_at)}</p>{legacyWorkflow.note && <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{legacyWorkflow.note}</p>}</> : <p className="text-xs text-gray-500 mt-1">Nama pengambil keputusan tidak tersedia pada data lama.</p>}
              <p className="text-xs text-gray-500 mt-2">Keputusan ini dibuat sebelum alur Manager Divisi &rarr; IT &rarr; Manager IT diberlakukan.</p>
            </div> : <div className="space-y-3">
              {(['department_manager', 'it_review', 'it_manager'] as const).map((stage, index) => {
                const entry = workflowHistory?.find(item => item.stage === stage)
                return <div key={stage} className={`rounded-lg border p-3 ${entry ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-800">{index + 1}. {WORKFLOW_STAGE_LABELS[stage]}</p><span className={`text-xs font-medium ${entry ? (entry.decision === 'rejected' || entry.decision === 'not_recommended' ? 'text-red-600' : 'text-emerald-700') : 'text-gray-400'}`}>{entry ? WORKFLOW_DECISION_LABELS[entry.decision] : 'Menunggu'}</span></div>
                  {entry && <><p className="text-xs text-gray-600 mt-1">{entry.actor_name} &middot; {formatDate(entry.created_at)}</p>{entry.note && <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{entry.note}</p>}</>}
                </div>
              })}
            </div>}
          </div>}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Status History</h2>
            {!history?.length ? (
              <p className="text-sm text-gray-400 text-center py-4">No history yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-100" />
                <div className="space-y-4">
                  {history.map(h => (
                    <div key={h.id} className="relative pl-10">
                      <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full ring-2 ring-white ${h.to_status === ticket.status ? 'bg-brand-500' : 'bg-gray-300'}`} />
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge value={h.to_status} />
                        </div>
                        <p className="text-xs text-gray-500">{h.changed_by_name || h.changed_by_email}</p>
                        <p className="text-xs text-gray-400">{formatDate(h.created_at)}</p>
                        {h.note && <p className="text-xs text-gray-600 mt-1 italic border-l-2 border-gray-200 pl-2">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Change Status" size="sm">
        <p className="text-sm text-gray-500 mb-4">Current: <Badge value={ticket.status} /></p>
        <div className="space-y-4">
          <div>
            <label className="label">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="select" required>
              <option value="">— Select —</option>
              {availableTransitions.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} className="input" placeholder="Reason for change..." rows={2} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setShowStatusModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => newStatus && statusMutation.mutate({ status: newStatus, note: statusNote || undefined })} disabled={!newStatus || statusMutation.isPending} className="btn-primary">
              {statusMutation.isPending ? (
                <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Updating...</span>
              ) : 'Update Status'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={workflowAction !== null} onClose={closeWorkflowModal} title={workflowTitle} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{workflowAction?.stage === 'manager' ? 'Keputusan Anda mewakili acknowledgement dari divisi pemohon.' : workflowAction?.stage === 'it' ? 'Tuliskan hasil pemeriksaan, risiko, dan alasan rekomendasi agar dapat dinilai Manager IT.' : 'Pengesahan ini adalah rekomendasi teknis IT, bukan persetujuan pembelian dari Keuangan.'}</p>
          <div><label className="label">Catatan {workflowNoteRequired ? '' : '(boleh kosong)'}</label><textarea value={workflowNote} onChange={event => setWorkflowNote(event.target.value)} className="input" rows={4} placeholder="Tuliskan alasan atau hal penting yang perlu diketahui." required={workflowNoteRequired} /></div>
          <div className="flex justify-end gap-3"><button onClick={closeWorkflowModal} className="btn-secondary">Batal</button><button onClick={() => workflowAction && workflowMutation.mutate({ action: workflowAction, note: workflowNote })} disabled={workflowMutation.isPending || (workflowNoteRequired && !workflowNote.trim())} className={workflowIsPositive ? 'btn-primary bg-emerald-600 hover:bg-emerald-700' : 'btn-primary bg-red-600 hover:bg-red-700'}>{workflowMutation.isPending ? 'Menyimpan...' : workflowIsPositive ? 'Simpan dan Lanjutkan' : 'Simpan Keputusan'}</button></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteCommentId}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={() => { if (deleteCommentId) deleteCommentMutation.mutate(deleteCommentId); setDeleteCommentId(null) }}
        title="Delete Comment"
        message="Delete this comment? This action can be undone (soft delete)."
        loading={deleteCommentMutation.isPending}
      />
    </div>
  )
}
