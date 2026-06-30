import { Link, useParams } from 'react-router-dom'

const content: Record<string, { title: string; date: string; body: string }> = {
  'getting-started': {
    title: 'Getting Started with LEAH',
    date: '2026-06-30',
    body: `LEAH adalah sistem manajemen aset TI dan helpdesk ticketing yang ringan dan cepat.

## Prasyarat

- PostgreSQL 16+
- Nginx (untuk production)
- Go 1.22+ (hanya untuk build)

## Instalasi

\`\`\`bash
# Clone repo
git clone https://github.com/adammuizweb/leah.git
cd leah

# Build backend
cd backend && go build -o leah ./cmd/api

# Build frontend
cd ../frontend && npm install && npm run build

# Setup database
sudo -u postgres psql -c "CREATE USER leah WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE leah OWNER leah;"
sudo -u postgres psql -d leah -f backend/migrations/001_init.sql
sudo -u postgres psql -d leah -f backend/migrations/002_roles.sql
sudo -u postgres psql -d leah -f backend/migrations/003_seed.sql

# Run
DATABASE_URL="postgres://leah:your-password@localhost:5432/leah" ./backend/leah
\`\`\`

Akses di http://localhost:8080. Login dengan superuser@leah.lan / leah.`,
  },
  'architecture-overview': {
    title: 'Architecture Overview',
    date: '2026-06-29',
    body: `LEAH menggunakan arsitektur 3-tier: frontend React, backend Go API, database PostgreSQL.

## Layer

\`\`\`
Browser → Nginx → /api/* → Go API → PostgreSQL
               → /* → index.html (React SPA)
\`\`\`

## Backend

Backend Go menggunakan pola Handler → Service → Repository:

- **Handler**: menerima HTTP request, parse JSON, kirim response
- **Service**: logic bisnis, validasi
- **Repository**: SQL query ke database

## Frontend

React SPA dengan Vite, TypeScript, Tailwind CSS, dan TanStack Query untuk data fetching.

## Deployment

Satu binary Go yang bisa di-copy ke server mana pun. Tidak perlu runtime dependency.`,
  },
  'role-permissions': {
    title: 'Role & Permission System',
    date: '2026-06-28',
    body: `LEAH memiliki sistem permission granular yang bisa dikonfigurasi.

## Hierarki (dari tertinggi)

1. **Superuser** — flag is_superuser=true di tabel users. Bypass ALL permission checks. Hanya bisa di-set langsung di database.
2. **Superadmin** — role dengan ALL permissions termasuk settings.*. Bisa manage roles & permissions lewat UI.
3. **Admin** — bypass content permissions (tickets, assets, users). Tidak bisa settings.* atau Bin.
4. **Agent/Editor** — permission explicit. Cuma bisa edit dalam scope organisasinya.
5. **User** — cuma bisa create ticket dan lihat ticket sendiri.

## Permission Matrix

| Modul | Superuser | Superadmin | Admin | Agent | User |
|-------|-----------|------------|-------|-------|------|
| tickets | ✅ bypass | ✅ all | ✅ bypass | ✅ explicit | create only |
| assets | ✅ bypass | ✅ all | ✅ bypass | ✅ explicit | ❌ |
| users | ✅ bypass | ✅ all | ✅ bypass | ❌ | ❌ |
| settings.* | ✅ bypass | ✅ all | ❌ 403 | ❌ | ❌ |
| Bin | ✅ bypass | ✅ all | ❌ 403 | ❌ | ❌ |

## Permission Management

Setiap modul memiliki permission CRUD terpisah. Bisa diatur lewat Admin → Permissions oleh Superadmin atau Superuser.`,
  },
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = slug ? content[slug] : null

  if (!post) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
          <Link to="/blog" className="text-indigo-600 hover:text-indigo-800">Back to blog</Link>
        </div>
      </div>
    )
  }

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

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-xs text-gray-400 mb-2">{post.date}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{post.title}</h1>
        <div className="text-gray-600 leading-relaxed space-y-4 whitespace-pre-line">
          {post.body}
        </div>
        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link to="/blog" className="text-indigo-600 hover:text-indigo-800 text-sm">&larr; Back to blog</Link>
        </div>
      </article>
    </div>
  )
}
