# LEAH — Agent Instructions

> Untuk AI agent: dokumen ini berisi panduan dan konteks
> saat bekerja di project LEAH.

---

## Development Data

Semua data development/testing saat ini adalah **SEED** (bukan production).
Data boleh dihapus/dihancurkan kapan pun jika ada perubahan arsitektur.

Seeder: `backend/migrations/003_seed.sql`

## Konvensi

- **Migration**: file SQL di `backend/migrations/`, awali nomor urut (`001_`, `002_`, dst.)
- **Seed**: migration terakhir (`999_seed.sql`) — atau nomor tinggi agar jalan setelah semua skema
- **Jangan edit migration yang sudah dipush** — buat migration baru untuk perubahan
- **Bahasa**: kode pakai English, komentar/dokumentasi pakai English

## Stack

- Backend: Go (Chi router, pgx)
- Frontend: React + TypeScript + Vite + Tailwind
- Database: PostgreSQL
- Deployment: Binary langsung (no Docker), Nginx reverse proxy, Cloudflare Tunnel

## Reusable Components

Semua komponen reusable di `frontend/src/components/`:

| Komponen | File | Kegunaan |
|----------|------|----------|
| Modal | `Modal.tsx` | Popup untuk form create/edit. Props: open, onClose, title, children |
| ConfirmDialog | `ConfirmDialog.tsx` | Konfirmasi aksi (delete, dll). Props: open, onClose, onConfirm, title, message, confirmLabel, variant |
| Toast | `Toast.tsx` | Notifikasi. Wrap `<ToastProvider>` di App, lalu panggil `useToast().toast(msg, type)` |

## Arsitektur

```
backend/
  cmd/api/main.go         → entry point
  internal/
    config/               → env vars
    database/             → koneksi PostgreSQL
    models/               → struct data
    repository/           → SQL queries
    services/             → business logic
    handlers/             → HTTP handlers
  migrations/             → SQL migration files
  leah                    → compiled binary (gitignored)
```

## Endpoints

```
GET    /api/health
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/:id
PUT    /api/tickets/:id
DELETE /api/tickets/:id
GET    /api/assets
POST   /api/assets
GET    /api/assets/:id
PUT    /api/assets/:id
DELETE /api/assets/:id
```

## Scope & Multi-Tenant

LEAH support **holding → organization** hierarchy. Setiap data (user, asset, ticket)
terikat ke `organization_id`. Scope otomatis di-filter berdasarkan path organization user.

- `holdings` — perusahaan/entitas level atas
- `organizations` — hierarki bertingkat dengan parent_id, path, level
- Middleware scope filter di setiap query (kecuali superadmin)
- Backup DB sebelum migration besar: `pg_dump leah > /tmp/leah-$(date +%Y%m%d).sql`

## Development Credentials

Semua seed users password: `leah`

| Email | Role | Password |
|-------|------|----------|
| admin@leah.lan | Admin | leah |
| agent@leah.lan | Agent | leah |
| user@leah.lan | User | leah |

⚠️ **Data seed hanya untuk development. Jangan dipakai di production.**

## Akses

- Development: `http://leah.lan` (warp/rumah) atau `https://leah.jyavani.com`
- Server: `adam@192.168.1.2` (password: adam)
- Database: `postgres://leah:leah@localhost:5432/leah`
