export type RequestKind = 'incident' | 'service' | 'software'
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected'

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  incident: 'Report an Issue',
  service: 'Service Request',
  software: 'Software Development',
}

export const REQUEST_KIND_DESCRIPTIONS: Record<RequestKind, string> = {
  incident: 'Something is broken or not working as expected.',
  service: 'Access, equipment, setup, or another IT service.',
  software: 'Propose a new application or internal software solution.',
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  not_required: 'Not required',
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const approvalClass = (status: ApprovalStatus) => ({
  not_required: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
  approved: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20',
  rejected: 'bg-red-100 text-red-700 ring-1 ring-red-600/20',
}[status])
