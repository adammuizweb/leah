import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-xl font-bold text-indigo-600 tracking-tight">LEAH</Link>
            <div className="flex items-center gap-4 sm:gap-6">
              <Link to="/about" className="text-sm text-indigo-600 font-medium">About</Link>
              <Link to="/blog" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">Blog</Link>
              <a href="https://github.com/adammuizweb/leah" target="_blank" className="text-sm text-gray-600 hover:text-indigo-600 font-medium">GitHub</a>
              <Link to="/dashboard" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">About LEAH</h1>
        <div className="prose prose-gray max-w-none space-y-4 text-gray-600">
          <p>
            <strong>LEAH</strong> — <strong>L</strong>ist <strong>E</strong>verything <strong>A</strong>ssets &amp; <strong>H</strong>elpdesk
            — adalah sistem manajemen aset TI dan helpdesk ticketing open-source.
          </p>
          <p>
            Terinspirasi dari GLPI, LEAH dibangun ulang dengan stack modern: Go untuk backend,
            React untuk frontend, dan PostgreSQL untuk database. Satu binary, tanpa runtime dependency,
            mudah di-deploy di mana pun.
          </p>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Fitur Utama</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Manajemen ticket helpdesk dengan prioritas dan status</li>
            <li>Inventory aset TI dengan tipe dan kategori hierarkis</li>
            <li>Relasi ticket-aset untuk pelacakan masalah</li>
            <li>Sistem role & permission yang fleksibel</li>
            <li>Soft delete dan bin untuk pemulihan data</li>
            <li>Pencarian, filter, dan pagination</li>
          </ul>
          <h2 className="text-xl font-semibold text-gray-900 mt-8">Tech Stack</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Backend: Go (Chi, pgx, JWT)</li>
            <li>Frontend: React, TypeScript, Vite, Tailwind</li>
            <li>Database: PostgreSQL</li>
            <li>Deployment: Binary langsung, Nginx, Cloudflare Tunnel</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
