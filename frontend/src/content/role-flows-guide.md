---
title: Role Flows Guide — Visual Tour of Permissions in Action
date: 2026-07-07
desc: Panduan visual lengkap dengan screenshots — bagaimana setiap role (Superuser, Superadmin, Admin, Agent, User) melihat dan berinteraksi dengan LEAH.
slug: role-flows-guide
---

Artikel ini adalah panduan visual yang menunjukkan bagaimana setiap role melihat dan berinteraksi dengan LEAH. Setiap role memiliki akses dan tampilan yang berbeda — dari **Superuser** yang bisa melihat semuanya, hingga **User** yang hanya bisa membuat ticket.

Jika Anda belum membaca artikel konseptual tentang hierarki role, baca dulu [Role & Permission System](/blog/role-permissions) untuk memahami dasarnya.

---

## 1. Superuser — Bypass Semua

**Superuser** adalah akun tertinggi dengan flag `is_superuser = true` di database. Tidak ada pengecekan permission — semua endpoint bisa diakses.

### Dashboard

Superuser melihat statistik lengkap: total tickets, open tickets, total assets, dan my tickets.

![](/blog/role-roles/superuser-01-dashboard.png)

### Tickets & Assets

Semua data dari semua organisasi tampil — tidak ada scope filter.

![](/blog/role-roles/superuser-02-tickets.png)

![](/blog/role-roles/superuser-03-assets.png)

### Admin Panel — Full Access

Superuser bisa mengakses SEMUA halaman admin:

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
| Bin | ✅ Restore & permanent delete |

![](/blog/role-roles/superuser-04-admin.png)

![](/blog/role-roles/superuser-05-admin-users.png)

![](/blog/role-roles/superuser-06-admin-permissions.png)

### Profile

Halaman profil menampilkan avatar, informasi user, organisasi, dan permissions.

![](/blog/role-roles/superuser-15-profile.png)

---

## 2. Superadmin — All Permissions via Role

**Superadmin** memiliki semua permission secara eksplisit (termasuk `settings.*`) melalui role `superadmin`. Secara visual dan fungsional, hampir sama dengan Superuser — perbedaannya ada di level implementasi: Superuser bypass di level middleware, Superadmin via permission checking.

### Dashboard & Admin

![](/blog/role-roles/superadmin-01-dashboard.png)

Superadmin bisa mengakses semua halaman yang sama dengan Superuser, termasuk settings, holdings, organizations, dan bin.

![](/blog/role-roles/superadmin-04-admin.png)

### Bin — Data Recovery

Halaman Bin menampilkan semua item yang di-soft-delete, dengan opsi Restore atau Permanent Delete.

![](/blog/role-roles/superadmin-09-admin-bin.png)

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

Admin melihat dashboard dan data yang sama dengan Superuser/Superadmin.

![](/blog/role-roles/admin-01-dashboard.png)

### Admin Panel — Sebagian Error

Admin bisa membuka halaman Admin Index dan melihat semua link sidebar, tetapi ketika mengklik Permissions, Holdings, Organizations, atau Bin, API akan mengembalikan error 403.

![](/blog/role-roles/admin-03-admin.png)

Admin Users — bisa kelola user:

![](/blog/role-roles/admin-04-admin-users.png)

Admin Permissions — 403 error karena butuh `settings.read`:

![](/blog/role-roles/admin-05-admin-permissions.png)

### Content Management — Berfungsi Penuh

Asset Types, Categories, Models, Ticket Types, SLA Policies — semua bisa diakses admin:

![](/blog/role-roles/admin-06-admin-types.png)

![](/blog/role-roles/admin-07-admin-categories.png)

### Settings Error — Holdings, Organizations, Bin

Halaman yang membutuhkan `settings.read` akan menampilkan error toast:

![](/blog/role-roles/admin-11-admin-holdings.png)

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

![](/blog/role-roles/agent-01-dashboard.png)

### Tickets & Assets

Agent bisa membuat, melihat, dan mengupdate ticket dan asset.

![](/blog/role-roles/agent-02-tickets.png)

![](/blog/role-roles/agent-03-assets.png)

### Admin — Redirect

Ketika agent mencoba mengakses `/admin`, mereka di-redirect ke dashboard karena `AdminRoute` memeriksa `role === 'admin' || role === 'superadmin' || is_superuser`.

---

## 5. User — Minimal Access

**User** adalah role paling terbatas. Hanya bisa membuat ticket dan melihat ticket miliknya sendiri.

**Permissions User:**
- `tickets.create`
- `tickets.read.own`

### Dashboard

Dashboard user hanya menampilkan data yang relevan — total tickets (miliknya) dan my tickets.

![](/blog/role-roles/user-01-dashboard.png)

### Tickets — Own Only

User hanya melihat ticket yang dibuatnya sendiri.

![](/blog/role-roles/user-02-tickets.png)

### Assets — Redirect

User tidak punya `assets.read`, sehingga halaman Assets akan menampilkan error atau redirect ke login.

### Admin — Redirect

Sama seperti agent, user tidak bisa mengakses admin.

---

## Ringkasan Visual

| Area | Superuser | Superadmin | Admin | Agent | User |
|------|-----------|------------|-------|-------|------|
| Dashboard | ✅ Full | ✅ Full | ✅ Full | ✅ Limited | ✅ Own |
| Tickets | ✅ All | ✅ All | ✅ All | ✅ CRUD | ✅ Create + Own |
| Assets | ✅ All | ✅ All | ✅ All | ✅ CRUD | ❌ |
| Users CRUD | ✅ | ✅ | ✅ | ❌ | ❌ |
| Permissions | ✅ | ✅ | ❌ 403 | ❌ | ❌ |
| Holdings/Orgs | ✅ | ✅ | ❌ 403 | ❌ | ❌ |
| Bin | ✅ | ✅ | ❌ 403 | ❌ | ❌ |
| Types/Categories | ✅ | ✅ | ✅ | ❌ | ❌ |
| Models | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ticket Types | ✅ | ✅ | ✅ | ❌ | ❌ |
| SLA Policies | ✅ | ✅ | ✅ | ❌ | ❌ |
| Profile | ✅ | ✅ | ✅ | ✅ | ✅ |

## Best Practices

1. **Gunakan Superuser hanya untuk setup awal** — setelah konfigurasi selesai, berikan akses via role Superadmin atau Admin.
2. **Admin cocok untuk manajer TI** — mereka bisa manage content tanpa bisa mengubah setting sistem.
3. **Agent untuk teknisi lapangan** — mereka perlu membuat dan mengupdate ticket/asset, tapi tidak perlu akses admin.
4. **User untuk end-user** — cukup bisa melaporkan masalah via ticket.
5. **Jangan berikan settings.* ke admin biasa** — pisahkan peran settings management ke role terpisah (Superadmin) untuk security.
