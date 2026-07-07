import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../services/auth'
import { useToast } from '../components/Toast'
import { useState, useRef } from 'react'
import Badge from '../components/Badge'
import { DetailSkeleton } from '../components/LoadingSkeleton'

export default function Profile() {
  const { user, permissions } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(user?.name || '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['my-orgs'],
    queryFn: api.getMyOrgs,
  })

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const profileMutation = useMutation({
    mutationFn: (data: { name: string }) => api.updateProfile(data),
    onSuccess: () => {
      toast('Profile updated', 'success')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(password),
    onSuccess: () => {
      toast('Password changed', 'success')
      setPassword('')
      setPasswordConfirm('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      await api.uploadAvatar(file)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast('Avatar updated', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setAvatarUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const avatarUrl = meQ.data?.user?.avatar_url
    ? `/api/uploads/avatars/${meQ.data.user.avatar_url}`
    : null

  const groupedPerms: Record<string, string[]> = {}
  permissions.forEach(p => {
    const parts = p.split('.')
    const module = parts[0] || 'other'
    const action = parts[1] || p
    if (!groupedPerms[module]) groupedPerms[module] = []
    groupedPerms[module].push(action)
  })

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (meQ.isLoading) return <DetailSkeleton />

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="card">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-brand-100 flex items-center justify-center ring-4 ring-white shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-brand-600">
                    {(user?.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-all disabled:opacity-50"
              >
                {avatarUploading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2 flex-wrap">
                <Badge value={user?.role || 'user'} />
                {user?.created_at && (
                  <span className="text-xs text-gray-400">Member since {formatDate(user.created_at)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Name */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Info</h2>
          <form onSubmit={e => { e.preventDefault(); if (name.trim() && name !== user?.name) profileMutation.mutate({ name }) }} className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email || ''} className="input bg-gray-50 text-gray-500" disabled />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact an admin.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary btn-sm" disabled={!name.trim() || name === user?.name || profileMutation.isPending}>
                {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={e => { e.preventDefault(); if (password && password === passwordConfirm) passwordMutation.mutate() }} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Min 6 characters" minLength={6} required />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} className={`input ${passwordConfirm && password !== passwordConfirm ? 'ring-2 ring-red-500 border-red-500' : ''}`} placeholder="Repeat password" required />
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary btn-sm" disabled={!password || password !== passwordConfirm || passwordMutation.isPending}>
                {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Organizations */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Organizations</h2>
        </div>
        {orgsLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3"><div className="h-4 skeleton w-32" /><div className="h-4 skeleton w-48" /></div>
            ))}
          </div>
        ) : !orgs?.length ? (
          <div className="p-6 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M3 7l9-4 9 4M3 14h18m-9-4v7" /></svg>
            <p className="text-sm text-gray-500">Not assigned to any organization.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orgs.map(o => (
              <div key={o.organization_id} className="flex items-center gap-3 px-6 py-3.5 text-sm">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-gray-900 font-medium">{o.org_name}</p>
                  <p className="text-xs text-gray-500">{o.holding_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Permissions</h2>
          <p className="text-xs text-gray-500 mt-0.5">{permissions.length} permissions assigned</p>
        </div>
        {permissions.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <p className="text-sm text-gray-500">No permissions assigned.</p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(groupedPerms).map(([module, actions]) => (
              <div key={module}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{module.replace(/_/g, ' ')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {actions.map(action => (
                    <span key={action} className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-600/20">
                      {action.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
