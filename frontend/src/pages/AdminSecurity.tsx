import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type LoginSecuritySettings } from '../services/api'
import { useToast } from '../components/Toast'
import { useAuth } from '../services/auth'

type SecurityForm = Omit<LoginSecuritySettings, 'updated_by' | 'updated_at'>

export default function AdminSecurity() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const canUpdate = !!user?.is_root
  const [form, setForm] = useState<SecurityForm | null>(null)

  const { data: settings, isLoading, error: settingsError } = useQuery({
    queryKey: ['login-security-settings'],
    queryFn: api.security.getLoginSettings,
  })
  const { data: attempts = [] } = useQuery({
    queryKey: ['login-attempts'],
    queryFn: api.security.listLoginAttempts,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled,
        attempt_window_minutes: settings.attempt_window_minutes,
        ip_attempt_limit: settings.ip_attempt_limit,
        account_attempt_limit: settings.account_attempt_limit,
        account_lock_minutes: settings.account_lock_minutes,
      })
    }
  }, [settings])

  const save = useMutation({
    mutationFn: (value: SecurityForm) => api.security.updateLoginSettings(value),
    onSuccess: data => {
      queryClient.setQueryData(['login-security-settings'], data)
      toast('Login security settings updated', 'success')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const clear = useMutation({
    mutationFn: api.security.clearLoginAttempts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['login-attempts'] })
      toast('Login attempt history cleared', 'success')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalAttempts = attempts.reduce((sum, item) => sum + item.attempt_count, 0)
  const activeAttempts = attempts.reduce((sum, item) => sum + item.active_count, 0)
  const uniqueIPs = new Set(attempts.map(item => item.ip_address)).size

  if (settingsError) return <div className="text-sm text-red-600">{settingsError.message}</div>
  if (isLoading || !form) return <div className="text-sm text-gray-500">Loading security settings...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Login Security</h1>
        <p className="text-sm text-gray-500 mt-1">Control failed-login rate limits and account lockouts.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Attempts (24h)</p><p className="text-2xl font-semibold mt-1">{totalAttempts}</p></div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Active failures</p><p className="text-2xl font-semibold mt-1 text-amber-600">{activeAttempts}</p></div>
        <div className="card p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Unique IPs</p><p className="text-2xl font-semibold mt-1">{uniqueIPs}</p></div>
      </div>

      <form onSubmit={e => { e.preventDefault(); save.mutate(form) }} className="card p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <h2 className="font-semibold text-gray-900">Rate limiting</h2>
            <p className="text-sm text-gray-500">Disable only while recovering from a configuration problem.</p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={form.enabled} disabled={!canUpdate} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="sr-only peer" />
            <span className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-brand-600 peer-focus:ring-2 peer-focus:ring-brand-200 after:content-[''] after:absolute after:mt-0.5 after:ml-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5 relative" />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Attempt window (minutes)</span>
            <input className="input" type="number" min={1} max={1440} disabled={!canUpdate} value={form.attempt_window_minutes} onChange={e => setForm({ ...form, attempt_window_minutes: Number(e.target.value) })} required />
            <span className="text-xs text-gray-400">Failures outside this rolling window no longer count.</span>
          </label>
          <label className="block">
            <span className="label">Attempts per IP</span>
            <input className="input" type="number" min={1} max={100} disabled={!canUpdate} value={form.ip_attempt_limit} onChange={e => setForm({ ...form, ip_attempt_limit: Number(e.target.value) })} required />
            <span className="text-xs text-gray-400">The next request receives HTTP 429 until the window expires.</span>
          </label>
          <label className="block">
            <span className="label">Attempts per account</span>
            <input className="input" type="number" min={2} max={100} disabled={!canUpdate} value={form.account_attempt_limit} onChange={e => setForm({ ...form, account_attempt_limit: Number(e.target.value) })} required />
            <span className="text-xs text-gray-400">Must be at least the per-IP limit; attempts from all IPs are combined.</span>
          </label>
          <label className="block">
            <span className="label">Account lock duration (minutes)</span>
            <input className="input" type="number" min={1} max={43200} disabled={!canUpdate} value={form.account_lock_minutes} onChange={e => setForm({ ...form, account_lock_minutes: Number(e.target.value) })} required />
            <span className="text-xs text-gray-400">Administrators can unlock an account early from the Users page.</span>
          </label>
        </div>

        {canUpdate && <div className="flex justify-end"><button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving...' : 'Save settings'}</button></div>}
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-gray-100">
          <div><h2 className="font-semibold text-gray-900">Failed login attempts</h2><p className="text-sm text-gray-500">Grouped by IP and account over the last 24 hours.</p></div>
          {canUpdate && attempts.length > 0 && <button type="button" onClick={() => { if (window.confirm('Clear all failed login history?')) clear.mutate() }} className="text-sm text-red-600 hover:text-red-800">Clear history</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP address</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last attempt</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {attempts.map(item => <tr key={`${item.ip_address}-${item.email || 'unknown'}`}><td className="px-4 py-3 text-sm font-mono text-gray-700">{item.ip_address}</td><td className="px-4 py-3 text-sm text-gray-600">{item.email || 'Unknown account'}</td><td className="px-4 py-3 text-sm text-gray-600">{item.attempt_count}</td><td className="px-4 py-3 text-sm">{item.active_count > 0 ? <span className="text-amber-600 font-medium">{item.active_count}</span> : <span className="text-gray-400">0</span>}</td><td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(item.last_attempt).toLocaleString()}</td></tr>)}
              {attempts.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No failed login attempts in the last 24 hours.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
