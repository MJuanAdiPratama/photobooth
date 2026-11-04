# 📸 Qxuan Photobooth

Aplikasi photobooth berbasis web yang modern, ringan, dan responsif. Dapat digunakan langsung di smartphone, tablet, maupun layar laptop/PC studio. 

Dilengkapi dengan kamera otomatis, kustomisasi bingkai & filter foto, pembayaran QRIS, serta fitur cetak dan unduh foto.

---

## 🔄 Alur Penggunaan

Sistem bekerja dalam 4 langkah mudah:

1. **Ambil Foto**: Pilih layout foto (kolase/strip) dan rasio, atur timer hitung mundur, lalu ambil foto.
2. **Kustomisasi**: Pilih filter warna studio, warna bingkai (frame), dan gaya sudut foto sesuai selera.
3. **Pembayaran QRIS**: Scan kode QRIS yang muncul di layar untuk membuka akses unduh dan cetak.
4. **Unduh & Cetak**: Cetak foto langsung ke kertas foto standar atau unduh file resolusi tinggi ke perangkat.

---

## ✨ Fitur Utama

- **Kamera Responsif & Mulus**: Mendukung kamera HP, webcam laptop, hingga kamera eksternal dengan timer dan efek suara foto.
- **Filter & Bingkai Estetik**: Tersedia beragam pilihan warna bingkai, filter studio, dan variasi gaya sudut foto.
- **Pembayaran QRIS**: Integrasi pembayaran QRIS otomatis (Midtrans) lengkap dengan mode simulasi untuk pengujian.
- **Cetak & Unduh Berkualitas Tinggi**: Hasil foto jernih, pas dengan ukuran kertas foto, dan mudah disimpan.
- **Privasi & Penyimpanan Aman**: Foto disimpan sementara via cloud storage (Supabase) dan otomatis terhapus setelah 24 jam.

---

## 🚀 Cara Menjalankan

### 1. Jalankan di Lokal (Komputer)
```bash
# Pasang dependensi
npm install

# Jalankan server
npm start
```
Buka browser di `http://localhost:8000`.

### 2. Pengaturan Lingkungan (.env)
Salin `.env.example` menjadi `.env` lalu isi konfigurasi Supabase dan Midtrans.

### 3. Deploy ke Vercel
Hubungkan repositori ini ke [Vercel](https://vercel.com), tambahkan environment variables di pengaturan proyek, dan aplikasi siap digunakan.

---

## 📄 Lisensi
© 2026 **Qxuan Photobooth**. Hak cipta dilindungi undang-undang.
