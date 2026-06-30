import { Link } from 'react-router-dom'

const features = [
  {
    icon: '🎫',
    title: 'Ticketing',
    desc: 'Kelola laporan masalah dan permintaan dari pengguna. Prioritaskan, tugaskan, dan lacak status penyelesaian.',
  },
  {
    icon: '📦',
    title: 'Inventory Asset',
    desc: 'Catat semua aset TI — laptop, server, printer, software license. Lengkap dengan serial number dan lokasi.',
  },
  {
    icon: '🔗',
    title: 'Relasi Asset-Ticket',
    desc: 'Hubungkan ticket dengan aset terkait. Lihat riwayat masalah perangkat dengan cepat.',
  },
  {
    icon: '📊',
    title: 'Dashboard',
    desc: 'Pantau jumlah ticket terbuka, status aset, dan ringkasan performa tim dalam satu layar.',
  },
  {
    icon: '🔐',
    title: 'Role & Auth',
    desc: 'Atur siapa yang bisa melihat, membuat, dan menyelesaikan ticket. Admin dan user memiliki akses berbeda.',
  },
  {
    icon: '🐹',
    title: 'Go Powered',
    desc: 'Backend Go dengan satu binary. Cepat, ringan, dan tanpa dependency runtime. Deploy di mana pun.',
  },
]

const techStack = [
  { name: 'Go', color: '#00ADD8' },
  { name: 'React', color: '#61DAFB' },
  { name: 'TypeScript', color: '#3178C6' },
  { name: 'PostgreSQL', color: '#4169E1' },
  { name: 'Tailwind', color: '#06B6D4' },
  { name: 'Nginx', color: '#009639' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-indigo-600 tracking-tight">LEAH</Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link to="/about" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">About</Link>
              <Link to="/blog" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">Blog</Link>
              <a href="https://github.com/adammuizweb/leah" target="_blank" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">GitHub</a>
              <Link to="/dashboard" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              Open Source — IT Asset & Helpdesk
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              List Everything{' '}
              <span className="text-indigo-600">Assets</span>
              <br />& Helpdesk
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl">
              LEAH membantu tim IT mencatat aset, mengelola ticket, dan melacak penyelesaian masalah
              — semua dalam satu platform open-source yang ringan dan cepat.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-indigo-700 transition-colors"
              >
                Masuk ke Dashboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <a
                href="https://github.com/adammuizweb/leah"
                target="_blank"
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg text-base font-medium hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                Source Code
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Kenapa LEAH?</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Dibangun untuk tim IT yang butuh tools sederhana namun powerful — tanpa vendor lock-in.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-6 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-lg transition-all">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack ─── */}
      <section className="py-16 sm:py-20 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Tech Stack</h2>
          <p className="mt-3 text-gray-600">Teknologi yang digunakan untuk membangun LEAH.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {techStack.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-current transition-colors"
                style={{ borderColor: t.color + '40', color: t.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-10 sm:p-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Siap mengelola aset & ticket?
            </h2>
            <p className="mt-4 text-lg text-indigo-100 max-w-lg mx-auto">
              Mulai sekarang — open source, tanpa biaya lisensi, tanpa vendor lock-in.
            </p>
            <Link
              to="/dashboard"
              className="mt-8 inline-flex items-center gap-2 bg-white text-indigo-700 px-8 py-3 rounded-lg text-base font-medium hover:bg-indigo-50 transition-colors"
            >
              Buka Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <span><strong className="text-gray-700">LEAH</strong> — List Everything Assets & Helpdesk</span>
          <span>Built with Go + React + PostgreSQL</span>
        </div>
      </footer>
    </div>
  )
}
