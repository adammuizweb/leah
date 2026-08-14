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

const kinds: RequestKind[] = ['support', 'software', 'technology_review']

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
  const [technologyName, setTechnologyName] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [specification, setSpecification] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')

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
    setTechnologyName('')
    setVendorName('')
    setSpecification('')
    setEstimatedCost('')
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
      business_objective: kind !== 'support' ? businessObjective : undefined,
      target_users: kind === 'software' ? targetUsers : undefined,
      desired_due_date: kind === 'software' && desiredDueDate ? `${desiredDueDate}T00:00:00Z` : null,
      technology_name: kind === 'technology_review' ? technologyName : undefined,
      vendor_name: kind === 'technology_review' ? vendorName : undefined,
      specification: kind === 'technology_review' ? specification : undefined,
      estimated_cost: kind === 'technology_review' && estimatedCost ? Number(estimatedCost) : null,
    })
  }

  return (
    <Modal open={open} onClose={close} title="Buat Permintaan" size="lg">
      {!kind ? (
        <div>
          <p className="text-sm text-gray-600 mb-5">Pilih yang paling sesuai dengan kebutuhan Anda.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {kinds.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setKind(item)}
                className="group rounded-xl border border-gray-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50/50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${item === 'software' ? 'bg-violet-100 text-violet-700' : item === 'technology_review' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item === 'software' ? 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' : item === 'technology_review' ? 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' : 'M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16a2 2 0 001.73 3z'} /></svg>
                </div>
                <p className="font-semibold text-gray-900 group-hover:text-brand-700">{REQUEST_KIND_LABELS[item]}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{REQUEST_KIND_DESCRIPTIONS[item]}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <button type="button" onClick={() => setKind(null)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">&larr; Ganti jenis permintaan</button>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Jenis permintaan</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{REQUEST_KIND_LABELS[kind]}</p>
          </div>
          <div>
            <label className="label">Apa yang Anda butuhkan?</label>
            <input value={title} onChange={event => setTitle(event.target.value)} className="input" placeholder={kind === 'software' ? 'Contoh: Aplikasi pengajuan cuti' : kind === 'technology_review' ? 'Contoh: Review server dari Vendor ABC' : 'Tulis kebutuhan atau masalah secara singkat'} required autoFocus />
          </div>
          <div>
            <label className="label">Ceritakan lebih lengkap</label>
            <textarea value={description} onChange={event => setDescription(event.target.value)} className="input" rows={4} placeholder="Jelaskan kondisi saat ini, dampaknya, dan hasil yang Anda harapkan." />
          </div>
          {kind === 'software' && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Kebutuhan aplikasi</h3>
                <p className="text-xs text-gray-500 mt-0.5">Cukup jelaskan kebutuhan pekerjaan. Detail teknis akan dibahas bersama IT.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nama aplikasi</label>
                  <input value={softwareName} onChange={event => setSoftwareName(event.target.value)} className="input" placeholder="Nama sementara juga boleh" required />
                </div>
                <div>
                  <label className="label">Siapa yang akan memakai?</label>
                  <input value={targetUsers} onChange={event => setTargetUsers(event.target.value)} className="input" placeholder="Contoh: Tim HR, seluruh karyawan" required />
                </div>
              </div>
              <div>
                <label className="label">Tujuan dan manfaat</label>
                <textarea value={businessObjective} onChange={event => setBusinessObjective(event.target.value)} className="input" rows={3} placeholder="Pekerjaan apa yang ingin dipermudah atau masalah apa yang ingin diselesaikan?" required />
              </div>
              <div>
                <label className="label">Kapan dibutuhkan? <span className="font-normal text-gray-400">(boleh kosong)</span></label>
                <input type="date" value={desiredDueDate} onChange={event => setDesiredDueDate(event.target.value)} className="input sm:max-w-xs" />
              </div>
            </div>
          )}
          {kind === 'technology_review' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Barang, aplikasi, atau vendor yang ingin direview</h3>
                <p className="text-xs text-gray-600 mt-1">IT akan memeriksa kesesuaian dan risikonya. Setelah mendapat rekomendasi IT, divisi Anda tetap mengajukan pembelian ke Keuangan.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Nama barang/aplikasi/vendor</label><input value={technologyName} onChange={event => setTechnologyName(event.target.value)} className="input" placeholder="Contoh: Server Dell R760" required /></div>
                <div><label className="label">Nama vendor <span className="font-normal text-gray-400">(boleh kosong)</span></label><input value={vendorName} onChange={event => setVendorName(event.target.value)} className="input" placeholder="Nama perusahaan vendor" /></div>
              </div>
              <div><label className="label">Akan digunakan untuk apa?</label><textarea value={businessObjective} onChange={event => setBusinessObjective(event.target.value)} className="input" rows={3} placeholder="Jelaskan kebutuhan dan manfaat untuk divisi Anda." required /></div>
              <div><label className="label">Informasi produk atau spesifikasi</label><textarea value={specification} onChange={event => setSpecification(event.target.value)} className="input" rows={3} placeholder="Salin spesifikasi, penawaran vendor, tautan produk, atau informasi lain yang sudah tersedia." required /></div>
              <div className="sm:max-w-xs"><label className="label">Perkiraan harga <span className="font-normal text-gray-400">(boleh kosong)</span></label><input type="number" min="0" step="1000" value={estimatedCost} onChange={event => setEstimatedCost(event.target.value)} className="input" placeholder="Rupiah" /></div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tingkat kebutuhan</label>
              <select value={priority} onChange={event => setPriority(event.target.value)} className="select">
                <option value="low">Tidak mendesak</option>
                <option value="medium">Normal</option>
                <option value="high">Mendesak</option>
                <option value="critical">Operasional terhenti</option>
              </select>
            </div>
            {(canReadAllAssets || canReadOwnAssets) && (
              <div>
                <label className="label">Perangkat terkait <span className="font-normal text-gray-400">(boleh kosong)</span></label>
                <select value={assetId} onChange={event => setAssetId(event.target.value ? Number(event.target.value) : '')} className="select">
                  <option value="">Tidak ada perangkat terkait</option>
                  {assets?.data.map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.serial ? ` (${asset.serial})` : ''}</option>)}
                </select>
              </div>
            )}
          </div>
          {kind !== 'support' && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Setelah dikirim: Manager divisi Anda menyetujui &rarr; staf IT memberi rekomendasi &rarr; Manager IT mengesahkan.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="btn-secondary">Batal</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>{create.isPending ? 'Mengirim...' : 'Kirim Permintaan'}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
