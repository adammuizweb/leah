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
    date: '2026-07-01',
    body: `LEAH menggunakan arsitektur 3-tier: frontend React, backend Go API, database PostgreSQL.

## Layer

\`\`\`
Browser → Nginx → /api/* → Go API → PostgreSQL
               → /* → index.html (React SPA)
\`\`\`

## Backend (Go)

Pola Handler → Service → Repository:

- **Handler** — menerima HTTP request, parse JSON, kirim response JSON
- **Service** — logic bisnis, validasi data
- **Repository** — SQL query ke database (PostgreSQL via pgx)

Setiap endpoint diproteksi oleh dua middleware:
1. **Auth** — validasi JWT token, ekstrak user + permissions
2. **RequirePermission** — cek apakah user punya permission spesifik

## Frontend (React)

React SPA dengan Vite, TypeScript, Tailwind CSS, TanStack Query.

Komponen reusable:
- **Modal** — popup form
- **ConfirmDialog** — konfirmasi aksi
- **Toast** — notifikasi

## Database (PostgreSQL)

### Relasi Data

\`\`\`
holdings
  └── organizations (hierarkis, parent_id + path + level)
        ├── users.organization_id
        ├── assets.organization_id
        └── tickets.organization_id
\`\`\`

Setiap data terikat ke organization. Scope otomatis di-filter berdasarkan path organization user.

### Soft Delete

Semua data utama (tickets, assets, users, types, categories) menggunakan soft delete.
Item yang dihapus masuk ke Bin dan bisa di-restore.

## Role & Permission

\`\`\`
Superuser (is_superuser=true) — bypass ALL
  └── Superadmin role — all permissions + settings
        └── Admin role — bypass content (tickets, assets, users)
              └── Agent role — explicit content permissions
                    └── User role — create tickets only
\`\`\`

Permission granular per module-action (create, read, update, delete, bulk_delete, assign).

## Scope & Multi-Tenant

LEAH mendukung hierarki Holding → Organization:

- **Holding** — entitas level atas (Universitas, Hospital, Farming)
- **Organization** — struktur bertingkat dalam holding, dengan parent_id dan materialized path

User bisa memiliki akses ke **banyak organisasi** (via tabel pivot user.organizations).
Scope filter otomatis membatasi data berdasarkan organisasi yang bisa diakses user,
termasuk organisasi turunannya (via path matching).

Scope diterapkan di:
- **ListTickets** — hanya ticket dalam org user + children
- **ListAssets** — hanya asset dalam org user + children
- **ListUsers** — hanya user dalam org user

Superuser (is_superuser=true) bypass semua scope filter.

## Permission Access Scope

Permission bersifat **global** — role yang sama berlaku di semua holding/org.

| User | Lihat data | Buat data |
|------|-----------|-----------|
| Superuser | Semua holding/org | Semua holding/org |
| Superadmin | Dalam holding-nya | Dalam holding-nya |
| Admin | Dalam org + children | Dalam org + children |
| Agent | Dalam org sendiri | Dalam org sendiri |
| User | Ticket sendiri | Ticket sendiri |

## Deployment

Satu binary Go (~20MB) tanpa runtime dependency. Nginx sebagai reverse proxy + serve static files.`,
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

## Multi-Org Access

User bisa di-assign ke banyak organisasi lewat Admin → Users → Edit → Organizations.
Scope filter otomatis menyesuaikan — user melihat data dari semua org yang di-assign.

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
