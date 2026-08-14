export type RequestKind = 'support' | 'software' | 'technology_review'
export type ApprovalStatus = 'not_required' | 'pending_manager' | 'pending_it_review' | 'pending_it_manager' | 'approved' | 'rejected'

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  support: 'Butuh Bantuan IT',
  software: 'Buat atau Ubah Aplikasi',
  technology_review: 'Minta Review IT',
}

export const REQUEST_KIND_DESCRIPTIONS: Record<RequestKind, string> = {
  support: 'Komputer bermasalah, butuh akses, instalasi, atau bantuan IT lainnya.',
  software: 'Membuat aplikasi baru, menambah fitur, atau mengubah aplikasi yang sudah ada.',
  technology_review: 'Sudah ada pilihan barang, server, aplikasi, atau vendor dan butuh rekomendasi IT sebelum diajukan ke Keuangan.',
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  not_required: 'Langsung ditangani IT',
  pending_manager: 'Menunggu Manager Divisi',
  pending_it_review: 'Menunggu Review IT',
  pending_it_manager: 'Menunggu Manager IT',
  approved: 'Direkomendasikan IT',
  rejected: 'Tidak direkomendasikan',
}

export const approvalClass = (status: ApprovalStatus) => ({
  not_required: 'bg-gray-100 text-gray-600',
  pending_manager: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
  pending_it_review: 'bg-sky-100 text-sky-700 ring-1 ring-sky-600/20',
  pending_it_manager: 'bg-violet-100 text-violet-700 ring-1 ring-violet-600/20',
  approved: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20',
  rejected: 'bg-red-100 text-red-700 ring-1 ring-red-600/20',
}[status])
