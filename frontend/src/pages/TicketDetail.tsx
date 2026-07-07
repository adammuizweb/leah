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

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, permissions } = useAuth()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null)

  const isAdmin = user?.is_superuser || user?.role === 'admin' || user?.role === 'superadmin'
  const canInternal = isAdmin || permissions.includes('tickets.internal')
  const canChangeStatus = isAdmin || permissions.includes('tickets.update')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.tickets.get(Number(id)),
    enabled: !!id,
  })

  const { data: types } = useQuery({ queryKey: ['ticket-types'], queryFn: api.ticketTypes.list })
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

  const typeMap = new Map(types?.map(t => [t.id, t]) || [])

  const statusMutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) =>
      api.tickets.updateStatus(Number(id), status, note),
    onSuccess: () => {
      toast('Status updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
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

  if (isLoading) return <DetailSkeleton />
  if (!ticket) return (
    <div className="flex flex-col items-center justify-center py-24">
      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Ticket not found</h2>
      <p className="text-sm text-gray-500 mb-4">The ticket you're looking for doesn't exist or has been deleted.</p>
      <Link to="/tickets" className="btn-primary">Back to Tickets</Link>
    </div>
  )

  const allowedTransitions = validTransitions[ticket.status] || []

  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Tickets
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
                #{ticket.id} &middot; Created {formatDate(ticket.created_at)}
              </p>
            </div>
            {canChangeStatus && allowedTransitions.length > 0 && (
              <button onClick={() => setShowStatusModal(true)} className="btn-primary shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Change Status
              </button>
            )}
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
              <form onSubmit={e => { e.preventDefault(); if (comment.trim()) commentMutation.mutate() }} className="space-y-3">
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
              </form>
            </div>
          </div>
        </div>

        {/* Right column: Status History */}
        <div className="space-y-6">
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
              {allowedTransitions.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
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
