import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

const renderer = new marked.Renderer()

// Custom table rendering with proper classes
renderer.table = (token) => {
  const headerHtml = token.header.map(cell => {
    const align = cell.align ? ` text-${cell.align}` : ''
    return `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50${align}">${cell.text}</th>`
  }).join('')
  const bodyHtml = token.rows.map(row => {
    const cells = row.map(cell => {
      const align = cell.align ? ` text-${cell.align}` : ''
      return `<td class="px-4 py-3 text-sm text-gray-700${align}">${cell.text}</td>`
    }).join('')
    return `<tr class="border-b border-gray-200 hover:bg-gray-50">${cells}</tr>`
  }).join('')
  return `<div class="overflow-x-auto my-6"><table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

renderer.tablecell = (token) => {
  const align = token.align ? ` text-${token.align}` : ''
  if (token.header) {
    return `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-50${align}">${token.text}</th>`
  }
  return `<td class="px-4 py-3 text-sm text-gray-700${align}">${token.text}</td>`
}

// Custom heading rendering
renderer.heading = ({ depth, text }) => {
  const sizes = ['', 'text-3xl font-bold mt-10 mb-4', 'text-2xl font-semibold mt-8 mb-3', 'text-xl font-semibold mt-6 mb-2', 'text-lg font-medium mt-4 mb-2', 'text-base font-medium mt-4 mb-2']
  return `<h${depth} class="${sizes[depth] || sizes[2]} text-gray-900">${text}</h${depth}>`
}

// Custom paragraph rendering
renderer.paragraph = ({ text }) => {
  return `<p class="text-gray-600 leading-relaxed mb-4">${text}</p>`
}

// Custom code block rendering
renderer.code = ({ text, lang }) => {
  const langLabel = lang ? `<div class="text-xs text-gray-500 mb-1.5 font-mono">${lang}</div>` : ''
  return `<div class="my-6">${langLabel}<pre class="bg-gray-900 text-gray-100 rounded-xl p-4 sm:p-5 overflow-x-auto text-sm leading-relaxed font-mono"><code>${text}</code></pre></div>`
}

// Custom inline code
renderer.codespan = ({ text }) => {
  return `<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">${text}</code>`
}

// Custom list rendering
renderer.list = (token) => {
  const tag = token.ordered ? 'ol' : 'ul'
  const cls = token.ordered ? 'list-decimal' : 'list-disc'
  const items = token.items.map(item => `<li class="leading-relaxed">${item.text}</li>`).join('')
  return `<${tag} class="${cls} pl-6 mb-4 space-y-1.5 text-gray-600">${items}</${tag}>`
}

// Custom blockquote
renderer.blockquote = ({ text }) => {
  return `<blockquote class="border-l-4 border-indigo-300 bg-indigo-50 rounded-r-lg px-4 py-3 my-4 italic text-gray-700">${text}</blockquote>`
}

// Custom horizontal rule
renderer.hr = () => {
  return `<hr class="my-8 border-gray-200" />`
}

// Custom link rendering
renderer.link = ({ href, text }) => {
  return `<a href="${href}" class="text-indigo-600 hover:text-indigo-800 underline underline-offset-2" target="${href?.startsWith('http') ? '_blank' : '_self'}" rel="${href?.startsWith('http') ? 'noopener noreferrer' : ''}">${text}</a>`
}

marked.use({ renderer })

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

Akses di http://localhost:8080. Login dengan superuser@leah.lan (lihat password di dokumentasi lokal).`,
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
  'asset-models-bulk': {
    title: 'Asset Models & Bulk Create',
    date: '2026-07-07',
    body: `LEAH sekarang mendukung **Asset Models** dan **Bulk Create** — solusi untuk input aset dalam jumlah banyak.

## Masalah

Di ITAM tradisional, setiap aset dianggap unik dengan serial number masing-masing. Ini ideal untuk server, laptop, atau monitor. Tapi bagaimana kalau kita beli 30 Access Point, 50 obeng, atau 100 kabel LAN?

Input satu per satu tidak realistis.

## Solusi: Asset Models

Kami perkenalkan layer baru: **Asset Models** (Model Produk).

\`\`\`
Asset Types (Network)
  └── Asset Categories (Wireless)
        └── Asset Models (MikroTik hAP AC2)  ← LAYER BARU
              └── Assets (30 unit individual)
\`\`\`

Model menyimpan data spesifik produk:
- Nama produk
- Manufacturer
- Part Number / Model Number
- Category & Type (otomatis diwariskan ke asset)

## Bulk Create

Dari halaman Assets, klik **Bulk Create**:

1. Pilih Model (misal "MikroTik hAP AC2")
2. Isi quantity (max 500)
3. Opsional: masukkan serial prefix (auto increment) atau paste daftar serial number
4. Klik Create — system bikin semua record dalam satu transaksi

Setiap asset tetap menjadi **record unik** dengan ID sendiri, siap dilacak secara individual jika diperlukan nanti.

## Serial Number Tidak Wajib

Untuk barang seperti obeng, kabel, atau konsumabel lain — cukup kosongkan field serial. Setiap asset tetap punya ID unik di sistem, dan serial bisa diisi belakangan jika kebijakan berubah.

## Contoh Skenario

### Skenario 1: 30 Access Point (butuh serial)

1. Admin buat Model "Ubiquiti UAP-AC-Pro" (Type: Network, Manufacturer: Ubiquiti)
2. Buka Assets → Bulk Create, pilih model, quantity 30, serial prefix "UAP-2024-"
3. Hasil: 30 aset dengan serial UAP-2024-1 sampai UAP-2024-30

### Skenario 2: 50 Obeng (tanpa serial)

1. Admin buat Model "Obeng Plus" (Type: Accessory, Category: Tools)
2. Buka Assets → Bulk Create, pilih model, quantity 50, kosongkan serial
3. Hasil: 50 aset dengan nama "Obeng Plus", tanpa serial — tetap bisa dilacak via ID

### Skenario 3: Input serial spesifik

1. Ikuti langkah yang sama, tapi paste serial number (satu per baris) di textarea
2. System akan menggunakan serial yang diberikan, bukan auto-generate

## Manajemen Model

Admin bisa manage model di **Admin → Asset Models**:
- Create, edit, delete model
- Set manufacturer, part number, category, dan type
- Model yang dihapus masuk ke Bin (bisa di-restore)

## Database

Model menggunakan soft delete, sama seperti data lainnya. Relasi:

\`\`\`
asset_models
  ├── id (PK)
  ├── name
  ├── manufacturer
  ├── part_number
  ├── category_id → asset_categories
  └── type_id → asset_types

assets
  └── model_id → asset_models (nullable)
\`\`\`

Constraint UNIQUE pada serial number dihapus agar mendukung multiple asset tanpa serial.`,
  },
  'ticket-workflow': {
    title: 'Ticket Workflow System — Status, History, Comments & SLA',
    date: '2026-07-07',
    body: `LEAH sekarang memiliki sistem workflow ticketing yang lengkap dengan status lifecycle, history tracking, comments, dan SLA.

## Status Workflow

Ticket melalui lifecycle yang ketat — tidak bisa loncat sembarangan.

\`\`\`
New → Open → In Progress → Resolved → Closed
                   ↓
              Pending ←→ In Progress
                   ↓
              Cancelled
\`\`\`

### State Definitions

| Status | Arti |
|--------|------|
| **New** | Baru dibuat, belum ditangani |
| **Open** | Dikonfirmasi, siap dikerjakan |
| **In Progress** | Sedang dikerjakan oleh teknisi |
| **Pending** | Menunggu informasi dari reporter |
| **Resolved** | Solusi sudah diberikan |
| **Closed** | Dikonfirmasi selesai oleh reporter |
| **Cancelled** | Dibatalkan (tidak perlu ditindaklanjuti) |

### Valid Transitions

\`\`\`
new       → open, cancelled
open      → in_progress, cancelled
in_progress → pending, resolved
pending   → in_progress, cancelled
resolved  → closed, in_progress (reopen)
closed    → in_progress (reopen)
cancelled → (terminal — no transition out)
\`\`\`

Transisi invalid akan ditolak oleh backend dengan error message.

## Status History

Setiap perubahan status otomatis tercatat:

\`\`\`
ticket John Doe-1: New → Open (by admin@leah.lan)
                   Open → In Progress (by tech@leah.lan)
                   In Progress → Resolved (by tech@leah.lan)
                   Resolved → Closed (by admin@leah.lan)
\`\`\`

Timeline ini ditampilkan di halaman detail ticket — siapa mengubah ke status apa, kapan, dan catatannya.

## Ticket Types

Ticket bisa dikategorikan. Tipe dikelola di **Admin → Ticket Types**:

| Type | Contoh |
|------|--------|
| **Incident** | Server down, printer rusak, error aplikasi |
| **Service Request** | Minta akses VPN, install software, reset password |
| **Change Request** | Tambah storage, upgrade bandwidth, migrasi server |
| **Maintenance** | Reboot terjadwal, backup rutin, update patch |
| **Complaint** | Pelayanan lambat, teknisi tidak responsif |

## Comments (Diskusi dalam Ticket)

Setiap ticket bisa dikomentari oleh teknisi dan reporter.

\`\`\`
[Teknisi] Sudah saya reset password. Silakan coba login.   (public)
[Admin] User ini sering lupa password, perlu training.      (internal — hanya visible admin/agent)
[Reporter] Sudah bisa login. Terima kasih!                  (public)
\`\`\`

Fitur:
- **Public comment** — visible untuk semua
- **Internal note** — hanya visible untuk admin/agent, untuk diskusi internal tim
- **Soft delete** — admin bisa hapus comment jika perlu

## SLA (Service Level Agreement)

SLA otomatis diterapkan berdasarkan priority saat ticket dibuat:

| Priority | Target Response | Target Resolve |
|----------|----------------|----------------|
| **Critical** | 1 jam | 4 jam |
| **High** | 4 jam | 8 jam |
| **Medium** | 8 jam | 24 jam |
| **Low** | 24 jam | 72 jam |

Setiap ticket menampilkan **deadline SLA** dan indikator apakah sudah melewati batas (overdue). Admin bisa mengkonfigurasi SLA policy di **Admin → SLA Policies**.

## Ticket Detail (Halaman Baru)

Halaman \`/tickets/:id\` menyediakan tampilan lengkap:

1. **Info Panel** — title, priority, status badge, SLA countdown, assigned tech
2. **Detail** — deskripsi, asset terkait, type, timestamps
3. **Status History Timeline** — log semua perubahan status
4. **Comments Tab** — diskusi + internal notes

## API Endpoints

\`\`\`
GET    /api/ticket-types          → list types
POST   /api/ticket-types          → create type (admin)
PUT    /api/ticket-types/:id      → update type (admin)
DELETE /api/ticket-types/:id      → delete type (admin)

GET    /api/tickets/:id/comments  → list comments
POST   /api/tickets/:id/comments  → add comment
DELETE /api/tickets/:id/comments/:cid → delete comment (admin)

GET    /api/tickets/:id/history   → status history timeline
PUT    /api/tickets/:id/status    → change status (validated)

GET    /api/sla-policies          → list SLA policies
POST   /api/sla-policies          → create policy (admin)
PUT    /api/sla-policies/:id      → update policy (admin)
DELETE /api/sla-policies/:id      → delete policy (admin)
\`\`\`

## Database Schema

\`\`\`sql
ticket_types
├── id (PK)
├── name (VARCHAR)
├── created_at, deleted_at

ticket_status_history
├── id (PK)
├── ticket_id → tickets (CASCADE)
├── from_status, to_status (VARCHAR)
├── changed_by → users
├── note (TEXT)
├── created_at

ticket_comments
├── id (PK)
├── ticket_id → tickets (CASCADE)
├── user_id → users
├── content (TEXT)
├── is_internal (BOOLEAN)
├── created_at, deleted_at

sla_policies
├── id (PK)
├── name (VARCHAR)
├── priority → UNIQUE per priority
├── response_hours, resolve_hours (INT)
├── created_at

tickets (modified)
├── + type_id → ticket_types
├── + sla_policy_id → sla_policies
├── + sla_response_at, sla_resolve_at (TIMESTAMPTZ)
├── + closed_at (TIMESTAMPTZ)
\`\`\`

Soft delete dan FK constraints tetap dipertahankan untuk konsistensi data.`,
  },
  'holding-organization': {
    title: 'Holding & Organization — Multi-Tenant Architecture',
    date: '2026-07-07',
    body: `LEAH dirancang multi-tenant sejak awal dengan struktur **Holding → Organization**.

## Kenapa Multi-Tenant?

Dalam dunia nyata, perusahaan TI tidak selalu flat. Contoh:

- **Vendor/MSP** — mengelola aset untuk banyak klien. Setiap klien adalah holding terpisah.
- **Universitas** — holding "Universitas", organisasi "Fakultas Teknik" → "Prodi Informatika" (hierarkis).
- **Hospital** — holding "RS Sehat", organisasi "IGD", "Rawat Inap", "Farmasi".

Tanpa multi-tenant, data semua entitas tercampur — audit trail kacau, scope tidak jelas.

## Struktur Data

\`\`\`
holdings (entitas level atas)
  └── organizations (hierarkis)
        ├── users.organization_id
        ├── user_organizations (pivot — multi-org akses)
        ├── assets.organization_id
        └── tickets.organization_id
\`\`\`

Organisasi bersifat **hierarkis** menggunakan materialized path:

\`\`\`
Organizations
  ├── id: 1, path: "/1/",           level: 0  (Root)
  │     └── id: 3, path: "/1/3/",   level: 1  (Child)
  │           └── id: 7, path: "/1/3/7/", level: 2 (Grandchild)
  └── id: 2, path: "/2/",           level: 0  (Another root)
\`\`\`

## Scope Filter

Setiap request API otomatis memfilter data berdasarkan organisasi yang bisa diakses user:

1. **Auth middleware** mengekstrak org_ids + org_paths dari JWT
2. **Repository** menambahkan WHERE clause: \`organization_id = ANY($org_ids)\`
3. **Descendant lookup**: via path LIKE, user melihat data dari org sendiri + semua anak cucunya

Contoh: User di org /1/3/ bisa melihat data org /1/3/7/ (child) tapi tidak /2/.

## User & Organization

Seorang user bisa di-assign ke **banyak organisasi** lewat Admin → Users → Edit → Organizations. Ini penting untuk:
- Supervisor yang mengawasi multiple unit
- Teknisi yang bertugas di beberapa lokasi
- Admin yang perlu akses lintas organisasi

## Distribusi Aset

Saat membuat asset (single atau bulk), **wajib** memilih organisasi tujuan. Ini mencegah aset "nyasar" ke organisasi yang salah.

\`\`\`
Bulk Create Flow:
1. Pilih Model
2. Quantity
3. Serial (optional)
4. **Pilih Holding → Pilih Organization**  ← PENTING!
5. Create
\`\`\`

Tanpa ini, asset akan jatuh ke organisasi default user — potensi petaka di deployment multi-org.

## Permission & Scope

| User | Lihat data | Buat data |
|------|-----------|-----------|
| Superuser | Semua holding/org | Semua holding/org |
| Superadmin | Dalam holding-nya | Dalam holding-nya |
| Admin | Dalam org + children | Dalam org + children |
| Agent | Dalam org sendiri | Dalam org sendiri |
| User | Ticket sendiri | Ticket sendiri |

> **Catatan:** Permission bersifat **global** — role sama di semua holding/org.
> Opsi per-org (role_id di user_organizations) sudah difasilitasi oleh struktur pivot
> dan bisa diaktifkan di masa depan tanpa migrasi besar.

## Best Practice

1. **Buat holding untuk setiap entitas bisnis terpisah** — jangan campur klien A dan B dalam satu holding
2. **Gunakan hierarki organisasi** — jangan buat flat list. Manfaatkan parent → child
3. **Assign user ke organisasi yang tepat** — jangan beri akses lebih dari yang diperlukan
4. **Superuser untuk setup saja** — sehari-hari pakai superadmin/admin dengan scope terbatas
5. **Pilih organisasi dengan benar saat bulk create** — 30 AP di org yang salah akan repot dipindahkan`,
  },
  'asset-management': {
    title: 'Asset Management — Full Lifecycle',
    date: '2026-07-07',
    body: `LEAH mengelola aset TI melalui empat layer hierarkis: **Type → Category → Model → Asset**. Setiap layer memiliki tujuan dan fungsinya sendiri.

## Hierarki Asset

\`\`\`
Asset Types (misal: Hardware, Software, Accessory, Network)
  └── Asset Categories (misal: Laptop, Server, License, Cable)
        └── Asset Models (misal: Dell Latitude 3420, MikroTik hAP AC2)
              └── Individual Assets (30 unit laptop, 50 AP)
\`\`\`

### 1. Asset Types

Tipe aset adalah kategori level paling atas. Contoh: Hardware, Software, Network, Accessory, Furniture.

Dikelola di **Admin → Asset Types**. Setiap tipe memiliki nama unik dan mendukung soft delete.

### 2. Asset Categories

Kategori adalah sub-grup dalam suatu tipe. Contoh: dalam tipe "Hardware" ada kategori "Laptop", "Server", "Printer".

Kategori bersifat hierarkis — bisa memiliki parent category (misal "Laptop" → "Dell Laptop" → "Latitude Series").

Dikelola di **Admin → Categories** dengan memilih tipe induk.

### 3. Asset Models

Model adalah representasi produk spesifik. Ini adalah layer yang diperkenalkan untuk mendukung bulk create.

Setiap model memiliki:
- **Name** — nama produk (e.g., "Dell Latitude 3420")
- **Manufacturer** — pabrikan (e.g., "Dell Inc.")
- **Part Number** — nomor model pabrik (e.g., "LAT-3420-i5")
- **Type & Category** — warisan ke asset yang dibuat dari model ini

Dikelola di **Admin → Asset Models**.

### 4. Individual Assets

Asset adalah unit individual — laptop dengan serial number tertentu di lokasi tertentu.

Setiap asset memiliki:
- **Name** — nama atau label aset
- **Serial** — nomor serial (opsional)
- **Status** — active, maintenance, retired, lost, dll
- **Location** — lokasi fisik
- **Organization** — organisasi pemilik
- **Assigned To** — user yang menggunakan aset ini

## CRUD Operations

### Create Asset

Dari halaman **Assets**, klik **+ New Asset**:

1. Isi nama aset (wajib)
2. Pilih tipe, kategori, dan model (opsional)
3. Masukkan serial number dan status
4. Pilih organisasi tujuan
5. Klik Create

### Bulk Create

Untuk membuat banyak aset sekaligus (maks 500 per batch):

1. Pilih **Asset Model** yang sudah ada (wajib)
2. Masukkan quantity
3. Auto-generate serial (prefix + increment) atau paste daftar serial
4. Pilih organisasi tujuan
5. Klik Create

System membuat semua record dalam satu transaksi database.

### Search & Filter

Halaman Assets mendukung:
- **Search** — cari berdasarkan nama atau serial
- **Status filter** — active, maintenance, retired, lost
- **Type filter** — filter berdasarkan tipe aset
- **Holding/Organization filter** — scope multi-tenant
- **Pagination** — 10/20/50/100 per halaman

### Update Asset

Edit asset langsung di tabel dengan inline editing, atau melalui modal untuk field yang lebih kompleks.

### Delete Asset

Asset yang dihapus tidak langsung hilang — masuk ke **Bin** (soft delete). Admin bisa merestore atau menghapus permanen dari Bin.

## Scope & Multi-Tenant

Setiap asset terikat ke **organization_id**. User hanya bisa melihat asset dalam organisasi yang di-assign kepadanya (termasuk child organisasi via materialized path).

Superuser bypass semua scope filter dan bisa melihat semua asset di semua holding/organisasi.

## Best Practices

1. **Buat type dan category dulu** sebelum model — jangan terbalik
2. **Gunakan model untuk barang repetitif** — 50 AP, 30 laptop, 100 kabel
3. **Serial tidak wajib** — untuk consumable (obeng, kabel) cukup kosongkan serial
4. **Pilih organisasi dengan benar** — asset di org yang salah akan merepotkan
5. **Gunakan status dengan konsisten** — active untuk yang dipakai, maintenance untuk yang diperbaiki`,
  },
  'soft-delete-bin': {
    title: 'Soft Delete & Bin System — Data Recovery',
    date: '2026-07-07',
    body: `LEAH menggunakan **soft delete** untuk semua data utama. Saat user "menghapus" sesuatu, data tidak benar-benar hilang — hanya ditandai dengan timestamp di kolom \`deleted_at\`.

Data yang dihapus bisa **direstore** (dikembalikan) atau **dihapus permanen** (hard delete) melalui halaman **Bin**.

## Bagaimana Soft Delete Bekerja

Semua tabel utama memiliki kolom \`deleted_at\`:

\`\`\`sql
ALTER TABLE tickets ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE asset_types ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE asset_categories ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE asset_models ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE ticket_types ADD COLUMN deleted_at TIMESTAMPTZ;
\`\`\`

Saat NULL → data aktif.
Saat berisi timestamp → data "dihapus".

Semua query list/read otomatis menyaring:

\`\`\`sql
SELECT * FROM tickets WHERE deleted_at IS NULL
\`\`\`

## Tabel yang Menggunakan Soft Delete

| Tabel | Ketika dihapus |
|-------|----------------|
| tickets | Masuk Bin → bisa restore |
| assets | Masuk Bin → bisa restore |
| users | Masuk Bin → bisa restore |
| asset_types | Masuk Bin, categories di bawahnya ikut soft delete |
| asset_categories | Masuk Bin |
| asset_models | Masuk Bin |
| ticket_types | Masuk Bin |

\`\`\`
Catatan: ticket_comments juga soft delete, ticket_status_history dan sla_policies hard delete.
\`\`\`

## Bin (Recovery)

Halaman **Admin → Bin** menampilkan semua data yang dihapus dari semua entitas, diurutkan berdasarkan waktu penghapusan:

\`\`\`
[User] admin@leah.lan — dihapus 2026-07-01 14:30
[Ticket] Printer rusak — dihapus 2026-07-01 14:25
[Asset] Dell Laptop #7 — dihapus 2026-06-30 09:15
\`\`\`

### Restore

Klik **Restore** pada item di Bin → system mengosongkan \`deleted_at\` → data kembali aktif seperti semula.

### Permanent Delete

Klik **Delete Forever** → system menjalankan \`DELETE FROM table WHERE id=$1 AND deleted_at IS NOT NULL\` → data benar-benar hilang.

\`\`\`warning
Permanent delete tidak bisa dibatalkan. Data yang sudah dihapus permanen tidak bisa direstore.
\`\`\`

## Implementasi di Backend

Di repository, pola soft delete:

\`\`\`go
func (r *Repository) DeleteTicket(ctx context.Context, id, userID int64) error {
  tag, err := r.db.Exec(ctx,
    \`UPDATE tickets SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL\`,
    userID, id,
  )
  // ...
}
\`\`\`

Restore:

\`\`\`go
func (r *Repository) RestoreItem(ctx context.Context, itemType string, id int64) error {
  var table string
  switch itemType {
  case "ticket": table = "tickets"
  case "asset":  table = "assets"
  // ...
  }
  r.db.Exec(ctx, fmt.Sprintf(\`UPDATE %s SET deleted_at=NULL WHERE id=$1\`, table), id)
}
\`\`\`

## Frontend

Halaman Bin di **Admin → Bin** menampilkan daftar semua item yang dihapus dengan tombol Restore dan Delete Forever. Hanya superuser dan superadmin yang bisa mengakses Bin.

## Best Practices

1. **Gunakan restore, bukan create ulang** — lebih cepat, ID tetap sama, relasi tetap valid
2. **Permanent delete hanya untuk pembersihan data** — lakukan setelah yakin data tidak diperlukan
3. **Backup database sebelum permanent delete massal** — untuk jaga-jaga
4. **Soft delete tetap mempertahankan FK constraint** — tidak ada orphan data
5. **Kolom deleted_by mencatat siapa yang menghapus** — audit trail lengkap`,
  },
  'user-management': {
    title: 'User Management — CRUD, Roles & Multi-Org Access',
    date: '2026-07-07',
    body: `LEAH memiliki sistem manajemen user yang terintegrasi dengan role-based access control (RBAC) dan multi-organisasi.

## User CRUD

### Membuat User

Dari **Admin → Users**, klik **+ New User**:

1. Masukkan **email** (login credential)
2. Masukkan **nama** lengkap
3. Masukkan **password** awal
4. Pilih **role** — tentukan level akses
5. Klik Create

\`\`\`
Pro tip: Password bisa diubah oleh admin kapan saja lewat Edit → Update Password.
\`\`\`

### Edit User

Klik **Edit** pada user yang ingin diubah:
- Ubah nama, email, role
- Reset password
- Atur akses organisasi

### Hapus User

Klik **Delete** → user masuk ke soft delete (Bin). Bisa direstore jika diperlukan.

\`\`\`warning
User yang dihapus tidak bisa login. Ticket/asset yang di-assign ke user ini akan kehilangan reference.
\`\`\`

## Role Assignment

Role menentukan apa yang bisa dilakukan user:

| Role | Level akses |
|------|-------------|
| **Superadmin** | Semua permission + settings |
| **Admin** | Bypass content permissions (tickets, assets, users) |
| **Agent** | Permission explicit — tergantung konfigurasi |
| **User** | Create ticket + lihat ticket sendiri |

### Cara Assign Role

1. Buka **Admin → Users**
2. Klik **Edit** pada user
3. Pilih role dari dropdown
4. Save

\`\`\`info
Superuser (is_superuser=true) tidak bisa diubah lewat UI — hanya via database langsung.
\`\`\`

## Multi-Organization Access

Seorang user bisa memiliki akses ke **lebih dari satu organisasi**. Ini penting untuk:
- Supervisor yang mengawasi multiple unit
- Teknisi yang bertugas di beberapa lokasi
- Manager yang perlu melihat data beberapa departemen

### Cara Memberikan Multi-Org Access

1. Buka **Admin → Users**
2. Klik **Edit** pada user
3. Tab **Organizations** — centang organisasi yang ingin diberikan akses
4. Save

User kemudian bisa melihat data dari semua organisasi yang di-assign, termasuk child organisasi (via materialized path).

### Scope Filter

Setiap query di backend otomatis memfilter berdasarkan organisasi user:

\`\`\`go
// Di repository
if orgIDs := r.scopeOrgIDs(ctx); len(orgIDs) > 0 {
  query += \` WHERE organization_id = ANY($1)\`
  args = append(args, orgIDs)
}
\`\`\`

User superuser (is_superuser=true) bypass semua scope filter.

## Permission Management

Permission diatur di **Admin → Permissions**:

1. Pilih role (superadmin, admin, agent, user)
2. Centang permission yang ingin diberikan
3. Save

Permission bersifat granular per module-action:

| Module | Actions |
|--------|---------|
| tickets | create, read, update, delete, assign, comment, internal, bulk_delete |
| assets | create, read, update, delete, assign, bulk_delete |
| users | create, read, update, delete |
| types | create, read, update, delete |
| categories | create, read, update, delete |
| models | create, read, update, delete |
| ticket_types | create, read, update, delete |
| sla_policies | create, read, update, delete |
| settings | read, update |

## Security Best Practices

1. **Superuser hanya untuk setup awal** — setelah itu gunakan superadmin/admin dengan scope terbatas
2. **Jangan beri akses lebih dari yang diperlukan** — prinsip least privilege
3. **Gunakan multi-org access dengan hati-hati** — hanya assign organisasi yang relevan
4. **Audit trail** — setiap perubahan tercatat di database (created_by, updated_by, deleted_by)
5. **Password strength** — gunakan password minimal 8 karakter dengan kombinasi huruf, angka, dan simbol
6. **Nonaktifkan user yang sudah tidak aktif** — jangan langsung hapus, cukup soft delete`,
  },
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = slug ? content[slug] : null

  const html = useMemo(() => {
    if (!post) return ''
    return marked.parse(post.body)
  }, [post])

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

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-10">
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            <time dateTime={post.date}>{post.date}</time>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <Link to="/blog" className="text-indigo-600 hover:text-indigo-800 font-medium">Documentation</Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{post.title}</h1>
        </div>

        <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="mt-12 sm:mt-16 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Link to="/blog" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to blog
            </Link>
            <a href="https://github.com/adammuizweb/leah" target="_blank" className="text-sm text-gray-400 hover:text-gray-600">&larr; Edit on GitHub</a>
          </div>
        </div>
      </article>
    </div>
  )
}
