---
title: Role Flows Guide — Visual Tour of Permissions in Action
date: 2026-07-07
desc: Panduan visual lengkap dengan screenshots — bagaimana Root dan setiap role (Superadmin, Admin, Agent, User) melihat dan berinteraksi dengan LEAH.
slug: role-flows-guide
---

Artikel ini adalah panduan visual yang menunjukkan bagaimana Root dan setiap role melihat dan berinteraksi dengan LEAH. Setiap role memiliki akses dan tampilan yang berbeda — dari **Root** yang bisa melihat semuanya, hingga **User** yang hanya bisa membuat ticket.

Jika Anda belum membaca artikel konseptual tentang hierarki role, baca dulu [Role & Permission System](/blog/role-permissions) untuk memahami dasarnya.

---

## 1. Root — Bypass Semua

**Root** adalah akun tertinggi dengan flag `is_root = true` di database. Root bukan role dan tidak ada pengecekan permission — semua endpoint bisa diakses.

### Dashboard

Root melihat statistik lengkap: total tickets, open tickets, total assets, dan my tickets.

### Tickets & Assets

Semua data dari semua organisasi tampil — tidak ada scope filter.

### Admin Panel — Full Access

Root bisa mengakses SEMUA halaman admin:

| Halaman | Akses |
|---------|-------|
| Users | ✅ Full CRUD |
| Permissions | ✅ Manage roles & permissions |
| Holdings | ✅ CRUD |
| Organizations | ✅ CRUD |
| Asset Types | ✅ CRUD |
| Categories | ✅ CRUD |
| Asset Models | ✅ CRUD |
| Ticket Types | ✅ CRUD |
| SLA Policies | ✅ CRUD |
| Login Security | ✅ Root only |
| Bin | ✅ Restore & permanent delete |

---

## 2. Superadmin — All Permissions via Role

**Superadmin** memiliki semua permission secara eksplisit (termasuk `settings.*`) melalui role `superadmin`. Secara visual hampir sama dengan Root, tetapi Root bypass di level middleware sedangkan Superadmin tetap melalui permission checking dan tidak dapat mengatur keamanan login global.

### Dashboard & Admin

Superadmin bisa mengakses settings, holdings, dan organizations, tetapi tidak halaman Login Security atau Bin yang khusus Root.

---

## 3. Admin — Content Manager, No Settings

**Admin** adalah role yang powerful untuk content management, tetapi dibatasi untuk `settings.*` permissions.

**Akses Admin:**
- Tickets, Assets, Users → Full CRUD (bypass permission check)
- Asset Types, Categories, Models → Full CRUD
- Ticket Types, SLA Policies → Full CRUD

**Tidak bisa akses:**
- Permissions/Roles → ❌ 403
- Holdings → ❌ 403
- Organizations → ❌ 403
- Bin → ❌ 403

### Dashboard & Tickets

Admin melihat dashboard dan data sesuai scope organisasinya.

### Admin Panel — Sebagian Error

Admin hanya melihat modul yang diizinkan di halaman Admin. Permissions, Holdings, Organizations, dan Bin tidak ditampilkan.

Admin Users — bisa kelola user:

Admin Permissions — 403 error karena butuh `settings.read`:

### Content Management — Berfungsi Penuh

Asset Types, Categories, Models, Ticket Types, SLA Policies — semua bisa diakses admin:

### Settings Error — Holdings, Organizations, Bin

Halaman yang membutuhkan `settings.read` akan menampilkan error toast:

---

## 4. Agent — Ticket & Asset Operations

**Agent** memiliki permission eksplisit untuk mengelola ticket dan asset (tanpa delete).

**Permissions Agent:**
- `tickets.create`, `tickets.read`, `tickets.update`, `tickets.assign`
- `assets.create`, `assets.read`, `assets.update`, `assets.assign`

**Tidak bisa:**
- Menghapus ticket atau asset
- Mengakses halaman admin (redirect ke dashboard)
- Mengelola user, settings, dll.

### Dashboard

### Tickets & Assets

Agent bisa membuat, melihat, dan mengupdate ticket dan asset.

### Admin — Redirect

Ketika agent mencoba mengakses `/admin`, mereka di-redirect ke dashboard karena `AdminRoute` memeriksa role administratif atau flag `is_root`.

---

## 5. User — Minimal Access

**User** adalah role paling terbatas. User bisa membuat ticket, melihat ticket miliknya sendiri, dan melihat asset yang ditugaskan kepadanya.

**Permissions User:**
- `tickets.create`
- `tickets.read.own`
- `assets.read.own`

### Dashboard

Dashboard user hanya menampilkan data yang relevan — total tickets (miliknya) dan my tickets.

### Tickets — Own Only

User hanya melihat ticket yang dibuatnya sendiri.

### Assets — Assigned Only

User hanya melihat asset yang ditugaskan langsung kepadanya.

### Admin — Redirect

Sama seperti agent, user tidak bisa mengakses admin.

---

## Ringkasan Visual

| Area | Root | Superadmin | Admin | Agent | User |
|------|-----------|------------|-------|-------|------|
| Dashboard | ✅ Full | ✅ Full | ✅ Full | ✅ Limited | ✅ Own |
| Tickets | ✅ All | ✅ All | ✅ All | ✅ CRUD | ✅ Create + Own |
| Assets | ✅ All | ✅ All | ✅ All | ✅ CRUD | ✅ Assigned |
| Users CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |
| Permissions | ✅ | ✅ | ❌ 403 | ❌ | ❌ |
| Holdings/Orgs | ✅ | ✅ | ❌ 403 | ❌ | ❌ |
| Bin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Types/Categories | ✅ | ✅ | ✅ | ❌ | ❌ |
| Models | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ticket Types | ✅ | ✅ | ✅ | ❌ | ❌ |
| SLA Policies | ✅ | ✅ | ✅ | ❌ | ❌ |
| Profile | ✅ | ✅ | ✅ | ✅ | ✅ |

## Best Practices

1. **Gunakan Root hanya untuk setup dan keamanan global** — pekerjaan harian sebaiknya memakai role Superadmin atau Admin.
2. **Admin cocok untuk manajer TI** — mereka bisa manage content tanpa bisa mengubah setting sistem.
3. **Agent untuk teknisi lapangan** — mereka perlu membuat dan mengupdate ticket/asset, tapi tidak perlu akses admin.
4. **User untuk end-user** — cukup bisa melaporkan masalah via ticket.
5. **Jangan berikan settings.* ke admin biasa** — pisahkan peran settings management ke role terpisah (Superadmin) untuk security.
