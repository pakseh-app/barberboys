# BARBERBOYS

Aplikasi barbershop — booking online, layanan & harga, kapster, galeri, ulasan,
member & stempel loyalitas, promo/voucher, pembayaran QRIS & tunai, serta
dashboard admin dengan laporan keuangan.

Dibuat dan dijalankan sebagai aplikasi Muse (Hatch space) dengan
Bun + TypeScript + React + Drizzle ORM + Supabase.

## Struktur

- `client/` — tampilan (React)
- `server/src/` — logika server (actions) dan skema database
- `drizzle/` — migrasi database lokal
- `supabase/` — skema database Supabase (`barberboys_supabase.sql`)

## Menjalankan

Butuh Bun 1.3.10. Jalankan `bun install`, lalu `bun run build` untuk memeriksa
build. Aplikasi ini dirancang berjalan di runtime Muse (Hatch space).

## Supabase

1. Jalankan `supabase/barberboys_supabase.sql` di SQL Editor proyek Supabase.
2. Beri hak akses ke tabel untuk peran `anon` dan `authenticated`, misalnya:
   `GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO anon, authenticated;`
   (lakukan untuk ke-11 tabel).
3. Kalau URL atau key Supabase berbeda, ubah lewat pengaturan aplikasi
   (key `supabase_url` / `supabase_publishable_key`).

## PIN admin

Tidak ada PIN bawaan di dalam kode. Untuk instalasi baru, atur environment
`BARBERBOYS_ADMIN_PIN` sebelum seed pertama dijalankan, atau isi hash SHA-256
PIN ke tabel settings (key `admin_pin_hash`). Segera ganti PIN lewat menu
Pengaturan setelah masuk pertama kali.

## Catatan

- Foto contoh (galeri/kapster) tidak ikut di repo ini; tambahkan foto sendiri
  ke `client/src/assets/`.
- Data pelanggan dan booking tidak pernah disimpan di repo.
