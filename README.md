# 🏥 SISTA-CSSD | Sistem Informasi Serah Terima Alat CSSD
### RSUD dr. R. Koesma Tuban

**SISTA-CSSD** adalah sistem informasi manajemen logistik instrumen medis steril terpadu berbasis web (*Single Page Application / SPA*) yang dirancang khusus untuk Instalasi Sterilisasi Sentral (CSSD) RSUD dr. R. Koesma Tuban. 

Sistem ini mengintegrasikan seluruh tahapan pemrosesan alat medis—mulai dari penerimaan barang kotor, dekontaminasi, pengemasan, sterilisasi, penyimpanan, etalase kontrol katalog, peminjaman oleh unit ruangan/poli, hingga pengembalian dan siklus sterilisasi ulang—secara digital, transparan, terstruktur, dan tersinkronisasi.

---

## 🌟 Fitur Utama Sistem

### 1. Alur 7-Tahap Siklus Sterilisasi CSSD
Sistem mengawal ketat 7 tahapan standar pelayanan sterilisasi rumah sakit:
1. 🔴 **Barang Kotor**: Penerimaan alat bekas pakai dari unit ruangan/poli.
2. 🧼 **Pencucian (Washing)**: Dekontaminasi dan pembersihan fisik instrumen.
3. ⚙️ **Setting & Assembly**: Penataan ulang set alat ke dalam tray medis.
4. 📦 **Labelling/Packing**: Pengemasan ke pouch steril dan pembuatan label QR Code.
5. 🧪 **Proses Sterilisasi**: Pemrosesan dalam mesin Autoklaf Suhu Tinggi / Plasma Suhu Rendah.
6. ✨ **Steril**: Konfirmasi hasil uji indikator fisik/biologis steril.
7. 🏛️ **Penyimpanan**: Penataan alat di rak ruang penyimpanan steril ber-AC.

### 2. Kontrol Etalase & Sistem FEFO (First Expired, First Out)
* **Kontrol Display Katalog (Status Etalase `ON` / `OFF`)**: Admin Inventaris CSSD memiliki kontrol penuh untuk menampilkan (👁️) atau menyembunyikan (🙈) alat medis yang berada di Penyimpanan dari Katalog Ruangan.
* **Pencegahan Expired Dini**: Mencegah instrumen medis sejenis dengan spesifikasi sama kedaluwarsa secara tak terduga karena alat yang disterilkan paling baru tidak sengaja dipinjam terlebih dahulu.
* **Urutan FEFO Cerdas**: Katalog secara otomatis memprioritaskan alat berstatus *Penyimpanan* dengan tanggal kedaluwarsa (*Expired Date*) terawal agar dipinjam lebih dahulu.
* **Filter Dropdown Status Etalase**: Admin dapat memfilter tampilan Inventaris berdasarkan `Semua Etalase (ON & OFF)`, `Hanya Etalase (ON)`, atau `Hidden Saja (OFF)`.

### 3. Modul Peminjaman, Pembatalan & Pengembalian Alat
* **Multi-Item Order**: Mendukung peminjaman banyak alat medis sekaligus dalam 1 ID Order transaksi.
* **Fitur Pembatalan Peminjaman (`Batal Order`)**: Unit ruangan peminjam dapat membatalkan permintaan peminjaman selama status transaksi masih `Pending` (misalnya karena salah memilih barang). Stok barang akan dikembalikan secara aman ke Penyimpanan CSSD.
* **Serah Terima Digital**: Pencatatan Nama Peminjam Awal dari Ruangan & Petugas Pengembali secara akurat.
* **Pengembalian Lengkap & Parsial**: Peminjam dapat mengembalikan sebagian alat terlebih dahulu jika alat lain masih digunakan untuk tindakan medis.

### 4. Modus Tampilan Layar Luas & Tampilan Ringkas (*High-Density View*)
* **Toggle Modus Layar Luas (Full-Width Screen)**: Tombol ikon navigasi (☰) di header atas memungkinkan pengguna menyembunyikan sidebar navigasi desktop untuk memperluas area tabel secara penuh (100% width).
* **Mode Ringkas Katalog (Compact List View 📑)**: Pilihan tampilan katalog antara *Grid Cards Mode* (visual gambar besar) dan *Ringkas/List Mode* (tampilan baris padat yang dapat memuat 15–30 data sekaligus dalam 1 layar).
* **Kapasitas Data per Halaman (*Page Size Selector*)**: Pilihan opsi memuat **9**, **18**, **36**, hingga **100 (Semua Data)** per halaman.
* **Penyimpanan Preferensi (`localStorage`)**: Pilihan modus layar luas, mode katalog, dan kapasitas data per halaman tersimpan otomatis di browser pengguna.

### 5. Website Maintenance Mode Enterprise 🛠️
* **Kontrol ONLINE / MAINTENANCE Super Admin**: Fitur switch status server dan pesan pengumuman maintenance pada menu Pengaturan Super Admin.
* **Keamanan Alur Login**: Halaman Login (Google Sign-In) tetap dipertahankan terbuka untuk publik/pengguna agar dapat melakukan otentikasi terlebih dahulu.
* **Halaman Maintenance Enterprise**: Ditampilkan secara otomatis **setelah login** untuk pengguna umum (Ruangan/Staf) saat status maintenance `ON`, dilengkapi tampilan visual glassmorphism, tombol WhatsApp Admin CSSD, dan tombol Logout.
* **Bypass Otomatis Super Admin**: Super Admin yang melakukan login saat maintenance `ON` secara otomatis mendapatkan akses *Bypass* penuh ke dashboard untuk melakukan perawatan sistem.

### 6. Fitur RECALL Alat Kedaluwarsa (Expired Date / ED)
* **RECALL Otomatis di CSSD**: Alat berstatus *Steril/Penyimpanan* yang telah melewati masa kedaluwarsa dapat ditarik kembali (*RECALL*) ke status *Kotor* secara massal atau individu untuk disterilkan ulang.
* **Notifikasi ED ke Ruangan**: Pengiriman notifikasi pengingat via Telegram ke unit ruangan/poli yang masih memegang alat kedaluwarsa agar segera dikembalikan ke CSSD.

### 7. Prestasi Staf 🏆 (Gamifikasi Kinerja Operasional)
* **Standarisasi 1 Poin per Tugas**: Setiap aksi pekerjaan operasional digital diberikan apresiasi 1 Poin secara transparan.
* **Podium 3 Besar & Leaderboard**: Papan peringkat visual staf (👑 Gold Juara 1, Silver Runner Up, Bronze Juara 3). Super Admin dikecualikan dari peringkat agar kompetisi adil bagi petugas operasional.
* **Archive Peringkat Bulanan**: Dropdown filter riwayat klasemen poin pada bulan-bulan sebelumnya.
* **Rincian Pekerjaan Staf (Modal Interaktif)**: Klik pada nama staf untuk melihat seluruh riwayat pekerjaan rinci staf tersebut pada bulan yang dipilih.
* **Laporan Formatted Excel (`.xlsx`)**: Ekspor rekapitulasi poin bulanan & rincian pekerjaan staf ke file Excel asli dengan auto-fit kolom (via SheetJS).
* **Laporan PDF Resmi Kertas A4**: Ekspor dan cetak langsung laporan resmi lengkap dengan Kop Surat RSUD dr. R. Koesma Tuban, tabel terstruktur, dan kolom tanda tangan pimpinan.

### 8. Manajemen Inventaris & Super Admin Tools
* **Modal Detail Alat Medis**: Mengklik nama alat pada tabel Inventaris atau Katalog akan membuka modal interaktif yang menampilkan foto HD, rincian komponen, status sterilisasi, serta riwayat lengkap peminjaman.
* **Ubah ID Alat Medis (Find & Replace Cascading)**: Super Admin dapat memperbarui ID Alat secara aman tanpa merusak riwayat transaksi di seluruh database sheet (`items`, `order_details`, `favorites`, `logs`).
* **Notifikasi Telegram Berkelompok**: Integrasi Bot Telegram untuk setiap tahapan transaksi dengan rincian nama & ID seluruh alat yang dipinjam.

---

## 🛠️ Arsitektur & Teknologi

* **Frontend**: HTML5, Tailwind CSS (JIT Engine), Vanilla JS (SPA Non-Framework, Responsif Mobile & Desktop).
* **Backend**: Google Apps Script (RESTful Web App API).
* **Database**: Google Sheets & Google Drive Serverless Cloud.
* **Integrasi PDF & Spreadsheet**: SheetJS (`xlsx.full.min.js`), SweetAlert2, HTML5 `@page A4` Print Engine.
* **Notifikasi**: Telegram Bot API (`sendTelegramNotification`).
* **Autentikasi**: Google Identity Services (Google SSO).

---

## 🚀 Panduan Deployment & Instalasi

### Langkah 1: Persiapan Database (Google Sheets)
1. Buat Spreadsheet baru di Google Drive Anda, beri nama **Database SISTA-CSSD**.
2. Biarkan sheet default kosong. Skrip backend memiliki fungsi inisialisasi otomatis (`initDatabase`) yang akan membuat semua tabel sheet (`config`, `users`, `items`, `orders`, `order_details`, `favorites`, `logs`, `LogPoin`) secara instan.
3. Catat **Spreadsheet ID** dari URL browser Anda.

### Langkah 2: Deploy Backend (Google Apps Script via clasp)
1. Pastikan `clasp` terpasang di komputer Anda (`npm install -g @google/clasp`).
2. Login ke akun Google Apps Script Anda:
   ```bash
   npx clasp login
   ```
3. Push kode backend ke Google Apps Script:
   ```bash
   npx clasp push -f
   ```
4. Deploy sebagai Web App:
   ```bash
   npx clasp deploy -i <DEPLOYMENT_ID> -d "Release Version"
   ```
5. Pastikan pengaturan **Execute as**: `Me` dan **Who has access**: `Anyone`.

### Langkah 3: Deploy Frontend (GitHub Pages)
1. Dorong perubahan kode ke repositori GitHub:
   ```bash
   git add index.html help.html README.md
   git commit -m "Update SISTA-CSSD"
   git push origin main
   ```
2. Hubungkan repositori ke GitHub Pages (`Settings > Pages > Branch: main`).
3. Akses aplikasi web melalui URL domain GitHub Pages Anda (misal `https://sista.koesma.biz.id` atau `https://koesmacssd.github.io/sistacssd/`).

---

## 📞 Dukungan & Lisensi

Dikembangkan oleh **Tim IT & Instalasi CSSD RSUD dr. R. Koesma Tuban**.  
*Hak Cipta © 2026 RSUD dr. R. Koesma. Seluruh Hak Dilindungi.*
