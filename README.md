# Dashboard Drive — Multi-Akun Google Drive

Satu dashboard web untuk **semua akun Google Drive**-mu: lihat, cari, upload, unduh, ganti nama, beri bintang, hapus, dan pindahkan file **antar akun** — tanpa pindah-pindah akun. Kuota tiap akun tetap dihitung masing-masing (aturan Google), tapi semuanya bisa dikelola dari satu tampilan.

Situs statis murni (HTML + CSS + JS, tanpa build step, tanpa library auth). Login memakai alur OAuth2 redirect standar langsung ke `accounts.google.com` — tanpa popup (jadi tidak bisa diblokir browser). Token + sesi tiap akun disimpan di `sessionStorage` browser: tahan reload dalam satu tab, hilang saat tab ditutup. Request API langsung dari browser ke `googleapis.com` — tidak ada server perantara.

## Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → **Import** repo ini
2. Framework Preset: **Other** · Build Command: kosongkan
3. **Deploy** — `index.html` langsung jadi halaman utama

## Setup sekali saja (5 menit)

Buka situs hasil deploy, kamu akan dipandu memasukkan **OAuth Client ID**:

1. Buka [Google Cloud Console](https://console.cloud.google.com) → buat project baru → aktifkan **Google Drive API** ([langsung ke halaman API](https://console.cloud.google.com/apis/library/drive.googleapis.com)).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → tipe **Web application**.
3. Di **Authorized JavaScript origins**, tambahkan origin situsmu, mis. `https://drive-kamu.vercel.app` (tanpa garis miring), **dan** di **Authorized redirect URIs** tambahkan `https://drive-kamu.vercel.app/` (dengan garis miring di akhir). Redirect URI harus persis sama dengan alamat situs — kalau Google menampilkan error `redirect_uri_mismatch`, perbaiki entri ini.
4. Di **OAuth consent screen**: pilih **External**, isi nama aplikasi saja (mode *Testing* cukup untuk dipakai sendiri; tambahkan emailmu sebagai *Test user*).
5. Salin **Client ID** → tempel di halaman setup aplikasi → **Simpan & Lanjutkan**.
6. Klik **Hubungkan** (di sidebar) → pilih akun Google → **Lanjutan → Buka … (tidak aman)**. Peringatan itu wajar untuk aplikasi mode Testing milik sendiri. Ulangi untuk akun kedua.

Satu Cloud project cukup untuk banyak akun — yang per-akun hanya proses login & izinnya (klik Hubungkan → pilih akun → kembali otomatis ke dashboard). Client ID tersimpan di `localStorage`; sesi login tersimpan di `sessionStorage` (tahan reload, hilang saat tab ditutup).

## Fitur

- Gabungan file lintas akun (badge warna per akun), kuota gabungan + per akun
- Cari lintas akun, filter per akun, urutkan nama/tanggal/ukuran, grid & daftar
- Upload (resumable, ada progress) — otomatis ke akun yang ruangnya paling lega, atau ke folder/akun yang sedang dibuka
- Unduh, buka di Google Drive, ganti nama, bintang, sampah (pulihkan/hapus permanen)
- **Pindah antar akun**: file diunduh dari akun asal → diunggah ke akun tujuan → dihapus dari asal (folder disalin rekursif)
- Breadcrumb folder, aktivitas terakhir, drag & drop, tombol sinkron ulang, responsif HP
- Mode demo (data contoh) tersedia dari layar setup bila ingin pratinjau tanpa login

## Catatan teknis

- Scope: `https://www.googleapis.com/auth/drive` (akses penuh ke file sendiri; perlu karena dashboard menampilkan file yang sudah ada, bukan hanya buatan aplikasi).
- Token kedaluwarsa tiap ±1 jam; aplikasi mencoba refresh senyap otomatis via iframe tersembunyi, bila gagal akun ditandai "sesi berakhir" dan cukup klik Hubungkan lagi (redirect, tanpa popup).
- Batas API Google (~12.000 req/menit/project) sangat longgar untuk pemakaian pribadi.
