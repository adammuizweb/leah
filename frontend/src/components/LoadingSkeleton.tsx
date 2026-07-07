export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-100">
        <div className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 skeleton flex-1" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex gap-4 px-4 py-3 ${r < rows - 1 ? 'border-b border-gray-50' : ''}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 skeleton flex-1" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-3 skeleton w-24 mb-3" />
          <div className="h-8 skeleton w-16 mb-2" />
          <div className="h-3 skeleton w-32" />
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="h-4 skeleton w-20" />
        <div className="h-8 skeleton w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="h-4 skeleton w-32" />
            <div className="h-3 skeleton w-full" />
            <div className="h-3 skeleton w-3/4" />
            <div className="h-3 skeleton w-1/2" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <div className="h-4 skeleton w-24" />
            <div className="h-3 skeleton w-full" />
            <div className="h-3 skeleton w-full" />
            <div className="h-3 skeleton w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
