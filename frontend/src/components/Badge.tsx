const statusStyles: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  open: 'bg-green-50 text-green-700 ring-green-600/20',
  in_progress: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  closed: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  cancelled: 'bg-red-50 text-red-700 ring-red-600/20',

  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  maintenance: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  retired: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  lost: 'bg-red-50 text-red-700 ring-red-600/20',

  critical: 'bg-red-50 text-red-700 ring-red-600/20',
  high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  medium: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  low: 'bg-gray-100 text-gray-600 ring-gray-500/20',

  superadmin: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  admin: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  agent: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  user: 'bg-gray-50 text-gray-600 ring-gray-500/20',
}

interface BadgeProps {
  value: string
  className?: string
  icon?: 'circle' | 'dot' | 'none'
}

export default function Badge({ value, className = '', icon = 'none' }: BadgeProps) {
  const style = statusStyles[value] || 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`badge ring-1 ring-inset ${style} ${className}`}>
      {icon === 'dot' && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {icon === 'circle' && <span className="w-2 h-2 rounded-full bg-current shrink-0" />}
      {value === 'in_progress' ? 'In Progress' : value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')}
    </span>
  )
}
