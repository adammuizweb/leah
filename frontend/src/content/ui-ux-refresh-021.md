---
title: UI/UX Refresh — Collapsible Sidebar & Responsive Filters
date: 2026-07-07
desc: Sidebar collapse, filter grid multi-kolom, mobile-friendly toggle, dan user panel.
---

## Sidebar Collapse

Sidebar sekarang bisa di-collapse ke mode icon-only dengan toggle pill
di pojok kiri header (desktop-only).

| Expanded | Collapsed |
|---|---|
| Logo + LEAH | Logo saja |
| Icon + label teks | Icon saja (tooltip) |
| Nama + role user | Avatar saja |

Transisi smooth, main content otomatis melebar.

## Filter Grid Responsive

Filter Assets & Tickets pakai CSS Grid yang adaptif:

| Layar | Tampilan |
|---|---|
| Mobile | Search + tombol "More filters" |
| Tablet | 2–3 kolom |
| Desktop | 4 kolom |
| XL | 7 kolom — semua filter 1 baris |

Di mobile, filter tersembunyi di balik toggle — halaman tetap bersih.

## User Panel

Role "user" sekarang punya halaman sendiri di `/my`:

- Asset yang di-assign ke dirinya (card grid)
- Ticket miliknya (list)
- Tombol Create Ticket

Akses ini dikontrol permission `assets.read.own` / `tickets.read.own`
— admin bisa mencabut kapan saja via Admin → Permissions.

## Lain-lain

- PageHeader jadi `flex-col` di semua ukuran (title di atas, button di bawah)
- Filter "Assigned To" di form asset pakai cascade Holding → Org → User
- Nginx cache: `index.html` never cached, hashed assets cache 1 tahun
