import { Link } from 'react-router-dom'

const posts = [
  { slug: 'getting-started', title: 'Getting Started with LEAH', desc: 'Cara cepat install dan konfigurasi LEAH di server Anda.', date: '2026-06-30' },
  { slug: 'architecture-overview', title: 'Architecture Overview', desc: 'Bagaimana LEAH dibangun — Go backend, React frontend, PostgreSQL.', date: '2026-06-29' },
  { slug: 'role-permissions', title: 'Role & Permission System', desc: 'Memahami hierarki superuser, admin, dan permission granular.', date: '2026-06-28' },
]

export default function Blog() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-indigo-600 tracking-tight">LEAH</Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link to="/about" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">About</Link>
              <Link to="/blog" className="text-sm text-indigo-600 font-medium">Blog</Link>
              <a href="https://github.com/adammuizweb/leah" target="_blank" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">GitHub</a>
              <Link to="/dashboard" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Documentation & Blog</h1>
        <div className="space-y-6">
          {posts.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="block p-6 rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="text-xs text-gray-400 mb-1">{post.date}</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{post.title}</h2>
              <p className="text-sm text-gray-600">{post.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
