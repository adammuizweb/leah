import Modal from './Modal'

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'default'
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={`px-4 py-2 rounded-lg text-sm text-white ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
