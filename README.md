# 📸 Qxuan Photobooth (Supabase & Vercel Edition)

Aplikasi Web Photobooth Modern, Minimalis, dan Siap Pakai (*Production-Ready*) dengan arsitektur UI Studio Kiosk, Pemrosesan Gambar Canvas Beresolusi Tinggi (HD 300 DPI), Pembayaran Dinamis **Midtrans QRIS**, serta Backend Serverless **Supabase PostgreSQL & Storage** yang siap dideploy ke **Vercel**!

---

## 🚀 Panduan Lengkap: Membuat Database di Supabase

Ikuti langkah-langkah mudah berikut untuk menyiapkan Supabase dari nol:

### Langkah 1: Buat Akun & Project Baru di Supabase
1. Buka [https://supabase.com/](https://supabase.com/) dan klik **"Sign In"** atau **"Start your project"** (bisa login menggunakan akun GitHub).
2. Di dashboard Supabase, klik tombol **"New project"**.
3. Isi informasi project:
   - **Name**: `Qxuan-Photobooth` (atau nama lain yang Anda inginkan).
   - **Database Password**: Buat password yang kuat dan catat.
   - **Region**: Pilih yang terdekat dengan Indonesia, misalnya **Singapore (ap-southeast-1)** agar respon cepat.
4. Klik **"Create new project"** dan tunggu sekitar 1-2 menit hingga status database selesai dibuat.

---

### Langkah 2: Jalankan Skrip SQL Tabel & Storage
1. Di dashboard Supabase project Anda, buka menu **SQL Editor** pada navigasi sebelah kiri (ikon terminal/buku SQL `>_`).
2. Klik tombol **"+ New query"**.
3. Buka berkas [`supabase_schema.sql`](file:///c:/Users/muham/Documents/Photobooth/supabase_schema.sql) di proyek ini, **salin seluruh isinya**, lalu tempel (*paste*) ke dalam kotak SQL Editor Supabase.
4. Klik tombol **"Run"** (atau tekan `Ctrl + Enter`).
5. Akan muncul pesan sukses: `Success. No rows returned`.

> Skrip SQL ini otomatis membuat:
> 1. Tabel `transactions`: Menyimpan metadata transaksi (`order_id`, `amount`, `status`, `qris_url`, `photo_url`, `photo_metadata`).
> 2. Tabel `system_settings`: Menyimpan tarif sesi photobooth.
> 3. Bucket Storage `photobooth-temp`: Tempat penyimpanan file foto sementara pelanggan.
> 4. Row Level Security (RLS) & Policies: Keamanan akses membaca dan menulis data.
> 5. Stored Procedure `delete_expired_photobooth_photos()`: Fungsi pemusnahan otomatis foto yang berumur lebih dari 24 jam demi privasi.

---

### Langkah 3: Ambil Kredensial API Supabase
1. Di dashboard Supabase, klik menu **Project Settings** (ikon roda gigi di kiri bawah).
2. Pilih tab **"Data API"** (atau **API** di versi sebelumnya).
3. Salin 3 nilai penting berikut:
   - **Project URL**: Contoh `https://xyzcompany.supabase.co`
   - **anon / public key**: Kunci `anon` publik
   - **service_role key**: Kunci rahasia `service_role` (klik tombol *Reveal* untuk melihatnya). Kunci ini digunakan oleh backend Vercel.

---

## ☁️ Panduan Deploy ke Vercel

Karena aplikasi ini sudah menggunakan arsitektur **Vercel Serverless Functions** (`/api/*.js`), Anda dapat men-deploy-nya ke Vercel secara gratis dan instan:

### Cara 1: Deploy via GitHub (Paling Mudah)
1. Unggah (*push*) folder proyek ini ke repositori GitHub Anda.
2. Buka [https://vercel.com/](https://vercel.com/) dan login.
3. Klik **"Add New..." > "Project"**, lalu pilih repositori GitHub Photobooth Anda.
4. Di bagian **Environment Variables**, tambahkan variabel-variabel berikut:

| Key | Value Contoh | Deskripsi |
| :--- | :--- | :--- |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL Project Supabase Anda |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Kunci `service_role` Supabase Anda |
| `SUPABASE_BUCKET` | `photobooth-temp` | Nama Bucket Storage foto sementara |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-XXXXX` | Server Key dari Midtrans Dashboard |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-XXXXX` | Client Key dari Midtrans Dashboard |
| `MIDTRANS_IS_PRODUCTION` | `false` | `false` untuk Sandbox, `true` jika Live |

5. Klik **"Deploy"**. Dalam hitungan detik website Qxuan Photobooth Anda akan langsung aktif dengan tautan publik seperti `https://qxuan-photobooth.vercel.app`!

---

### Cara 2: Deploy Langsung via Vercel CLI
Jika Anda memiliki Vercel CLI di komputer:
```bash
npm install -g vercel
vercel
```
Ikuti instruksi di terminal, lalu masukkan variabel environment di dashboard Vercel.

---

## 💻 Menjalankan di Komputer Lokal (Testing)

Sebelum dihosting ke Vercel, Anda juga bisa mengujinya secara lokal di komputer:

1. Buat berkas `.env` dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di berkas `.env`.
3. Jalankan server lokal:
   ```bash
   npm start
   ```
4. Buka browser di [http://localhost:8000](http://localhost:8000).

---

## 🔒 Kebijakan Privasi & Auto-Delete 24 Jam
- **Bebas Data Gambar di Database**: Database Supabase PostgreSQL hanya menyimpan log transaksi (`order_id`, `amount`, `status`, `created_at`). Tidak ada file gambar biner yang disimpan di database.
- **Auto-Delete TTL 24 Jam**: File foto yang diunggah ke bucket `photobooth-temp` otomatis dibersihkan lewat fungsi database `delete_expired_photobooth_photos()` dan endpoint cron Vercel `/api/cron_cleanup` yang dijadwalkan secara berkala di [vercel.json](file:///c:/Users/muham/Documents/Photobooth/vercel.json).
