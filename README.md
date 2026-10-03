# Dashboard Drive — Demo Multi-Akun

Dashboard web yang menggabungkan beberapa akun Google Drive gratis ke dalam **satu tampilan** — tanpa perlu pindah-pindah akun.

> **Status: Mode Demo.** Aplikasi ini berjalan dengan data contoh di memori browser (lihat `app.js` → `DEMO_ACCOUNTS` / `DEMO_FILES`). Belum tersambung ke Google Drive API sungguhan.

## Fitur demo

- Tampilan gabungan file dari 2 akun (badge akun di tiap file)
- Ringkasan kuota gabungan (2 × 15 GB) + bar kuota per akun
- Cari lintas akun, filter per akun, urutkan (nama/tanggal/ukuran)
- Tampilan grid & daftar, breadcrumb navigasi folder
- Detail file, tandai bintang, ganti nama
- Upload (simulasi progress) — otomatis ke akun yang ruangnya paling lega, atau ke akun yang sedang difilter
- Pindah file antar akun (simulasi, kuota ikut pindah)
- Sampah: hapus, pulihkan, hapus permanen, kosongkan
- Aktivitas terakhir, drag & drop upload, responsif untuk HP

## Deploy ke Vercel

Repo ini situs statis murni (HTML + CSS + JS, tanpa build step):

1. Buka [vercel.com/new](https://vercel.com/new) → **Import** repo `drive`
2. Framework Preset: **Other**
3. Build Command: kosongkan · Output Directory: `./` (atau biarkan default)
4. **Deploy** — `index.html` langsung jadi halaman utama

## Menuju versi produksi (Google Drive API asli)

1. Buat project di [Google Cloud Console](https://console.cloud.google.com), aktifkan **Google Drive API**
2. Buat **OAuth Client ID** (tipe Web), daftarkan origin (mis. URL Vercel) sebagai *Authorized JavaScript origin*
3. Login tiap akun via [Google Identity Services](https://developers.google.com/identity) — scope yang disarankan: `https://www.googleapis.com/auth/drive.file` (hanya file buatan aplikasi) atau `.../auth/drive` (akses penuh, perlu verifikasi Google bila publik)
4. Simpan satu *refresh token* per akun, lalu:
   - `drive.files.list` per akun → gabungkan hasilnya (inilah yang didemokan UI ini)
   - `drive.files.create` dengan `uploadType=resumable` untuk upload besar
   - `drive.files.update({ trashed: true })` / `drive.files.delete` untuk hapus
5. Titik integrasi sudah ditandai di `app.js` (cari `BACKEND SEAM`)

Satu Cloud project cukup untuk banyak akun — yang per-akun hanya proses login & izinnya.
