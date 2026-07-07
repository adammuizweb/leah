import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../services/auth'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-800',
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-indigo-100 text-indigo-800',
  closed: 'bg-gray-50 text-gray-400',
  cancelled: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

function statusBadge(status: string) {
  return <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>{STATUS_LABELS[status] || status}</span>
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

  // Valid transitions from journal 20
  const validTransitions: Record<string, string[]> = {
    new: ['open', 'cancelled'],
    open: ['in_progress', 'cancelled'],
    in_progress: ['pending', 'resolved'],
    pending: ['in_progress', 'cancelled'],
    resolved: ['closed', 'in_progress'],
    closed: ['in_progress'],
    cancelled: [],
  }

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
    onSuccess: () => {
      toast('Comment deleted', 'success')
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', id] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>
  if (!ticket) return <div className="text-center py-12 text-gray-500">Ticket not found</div>

  const allowedTransitions = validTransitions[ticket.status] || []

  return (
    <div>
      <div className="mb-4">
        <Link to="/tickets" className="text-indigo-600 hover:text-indigo-800 text-sm">&larr; Back to Tickets</Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
                {statusBadge(ticket.status)}
              </div>
              <div className="text-sm text-gray-500">
                #{ticket.id} &middot; Created {new Date(ticket.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {canChangeStatus && allowedTransitions.length > 0 && (
              <button onClick={() => setShowStatusModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Change Status</button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Priority</span>
              <p className="font-medium text-gray-900 capitalize">{ticket.priority}</p>
            </div>
            <div>
              <span className="text-gray-500">Type</span>
              <p className="font-medium text-gray-900">{ticket.type_id ? (typeMap.get(ticket.type_id)?.name || '—') : '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Asset</span>
              <p className="font-medium text-gray-900">{ticket.asset_id ? `#${ticket.asset_id}` : '—'}</p>
            </div>
            {ticket.sla_resolve_at && (
              <div>
                <span className="text-gray-500">SLA Resolve</span>
                <p className={`font-medium ${new Date(ticket.sla_resolve_at) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(ticket.sla_resolve_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Description + Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description || 'No description'}</p>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Comments</h2>

            <div className="space-y-4 mb-6">
              {comments?.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
              {comments?.map(c => (
                <div key={c.id} className={`p-3 rounded-lg text-sm ${c.is_internal ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{c.user_name || c.user_email}</span>
                      {c.is_internal && <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded">Internal</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {isAdmin && <button onClick={() => setDeleteCommentId(c.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>}
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <form onSubmit={e => { e.preventDefault(); if (comment.trim()) commentMutation.mutate() }} className="space-y-3">
              <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Type your comment..." rows={3} required />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={!comment.trim()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">Send</button>
                  {canInternal && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                      Internal note
                    </label>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Status History */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>
            <div className="space-y-3">
              {history?.length === 0 && <p className="text-sm text-gray-400">No history yet.</p>}
              {history?.map(h => (
                <div key={h.id} className="text-sm border-l-2 border-indigo-200 pl-3">
                  <div className="flex items-center gap-2">
                    {h.from_status ? statusBadge(h.from_status) : <span className="text-xs text-gray-400">—</span>}
                    <span className="text-gray-400 text-xs">&rarr;</span>
                    {statusBadge(h.to_status)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {h.changed_by_name || h.changed_by_email} &middot; {new Date(h.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {h.note && <p className="text-xs text-gray-600 mt-1 italic">{h.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowStatusModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h2>
            <p className="text-sm text-gray-500 mb-4">Current: {statusBadge(ticket.status)}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">— Select —</option>
                  {allowedTransitions.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Reason for change..." rows={2} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button onClick={() => newStatus && statusMutation.mutate({ status: newStatus, note: statusNote || undefined })} disabled={!newStatus} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteCommentId} onClose={() => setDeleteCommentId(null)} onConfirm={() => { if (deleteCommentId) deleteCommentMutation.mutate(deleteCommentId); setDeleteCommentId(null) }} title="Delete Comment" message="Delete this comment?" />
    </div>
  )
}
