import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Asset } from '../services/api'
import { useState } from 'react'

export default function Assets() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [typeId, setTypeId] = useState<number | ''>('')
  const [serial, setSerial] = useState('')

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: api.assets.list,
  })

  const { data: assetTypes } = useQuery({
    queryKey: ['asset-types'],
    queryFn: api.assetTypes.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => api.assets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowForm(false)
      setName('')
      setType('')
      setTypeId('')
      setSerial('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.assets.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedType = assetTypes?.find(t => t.id === typeId)
    createMutation.mutate({
      name,
      type: selectedType?.name || type,
      type_id: typeId || null,
      serial,
    } as Partial<Asset>)
  }

  if (isLoading) return <div className="text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'New Asset'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={typeId}
              onChange={e => {
                const id = e.target.value ? Number(e.target.value) : ''
                setTypeId(id)
                const t = assetTypes?.find(a => a.id === id)
                setType(t?.name || '')
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">— Select type —</option>
              {assetTypes?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial</label>
            <input
              value={serial}
              onChange={e => setSerial(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assets?.map(asset => (
              <tr key={asset.id}>
                <td className="px-6 py-4 text-sm text-gray-900">#{asset.id}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{asset.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{asset.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{asset.serial}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    asset.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {asset.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => deleteMutation.mutate(asset.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
