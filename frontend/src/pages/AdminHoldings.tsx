import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useState } from 'react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function AdminHoldings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const { data: holdings } = useQuery({ queryKey: ['holdings'], queryFn: api.holdings.list })

  const create = useMutation({
    mutationFn: () => api.holdings.create({ name, slug }),
    onSuccess: () => { setShowForm(false); setName(''); setSlug(''); toast('Holding created', 'success'); queryClient.invalidateQueries({ queryKey: ['holdings'] }) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Holdings</h1>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">+ New Holding</button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Holding">
        <form onSubmit={e => { e.preventDefault(); create.mutate() }} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Holding name" required />
          <input value={slug} onChange={e => setSlug(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="slug-name" required />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {holdings?.map(h => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{h.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{h.slug}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(h.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
