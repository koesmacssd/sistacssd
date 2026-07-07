# Panduan Instalasi & Deployment SISTA-CSSD

Sistem Informasi Serah Terima Alat CSSD (**SISTA-CSSD**) untuk **RSUD dr. R. Koesma** adalah sistem pencatatan peminjaman alat steril berbasis serverless yang menggabungkan:
1. **Frontend**: Single Page Application (SPA) - HTML5, Tailwind CSS, Vanilla JS.
2. **Backend**: Google Apps Script (Web App RESTful API).
3. **Database**: Google Sheets & Google Drive.
4. **Notifikasi**: Email Gmail & Bot Telegram.

Berikut adalah panduan lengkap cara melakukan instalasi, konfigurasi, dan mendeploy aplikasi ini.

---

## Langkah 1: Persiapan Database (Google Sheets)

1. Buat sebuah Spreadsheet baru di Google Drive Anda, beri nama **Database SISTA-CSSD**.
2. Anda **tidak perlu** membuat sheet-sheet di dalamnya secara manual. Cukup biarkan sheet default (`Sheet1`) kosong. Skrip backend memiliki fungsi inisialisasi otomatis yang akan membangun semua skema tabel secara instan.
3. Catat **Spreadsheet ID** Anda. Anda dapat mengambilnya dari URL Spreadsheet Anda:
   `https://docs.google.com/spreadsheets/d/SAMPEL_SPREADSHEET_ID_ANDA/edit`

---

## Langkah 2: Deploy Backend (Google Apps Script)

1. Di dalam Spreadsheet Anda, buka menu **Extensions** > **Apps Script**.
2. Hapus kode default di file `Code.gs`, lalu salin seluruh isi file [Code.gs](file:///c:/Users/comsr/OneDrive/Documents/Antigravity/20%20sistacssd/Code.gs) yang telah disediakan di workspace Anda.
3. Simpan proyek dengan menekan ikon disket atau tombol `Ctrl + S`.
4. **Inisialisasi Database**:
   * Di bar atas Apps Script editor, pilih fungsi `initDatabase` dari dropdown, lalu klik tombol **Run**.
   * Apps Script akan meminta izin akses (Authorization Required). Klik **Review Permissions**, pilih akun Google Anda, klik **Advanced** > **Go to ... (unsafe)**, lalu klik **Allow**.
   * Setelah fungsi selesai dijalankan, buka kembali Google Sheet Anda. Anda akan melihat sheet baru telah terbuat otomatis dengan header kolom dan beberapa data contoh: `config`, `users`, `items`, `orders`, `order_details`, dan `logs`.
5. **Konfigurasi Script Properties (Opsional)**:
   * Jika Anda mendeploy skrip ini sebagai Web App mandiri (tidak bound-script), buka **Project Settings** (ikon gerigi di sebelah kiri).
   * Gulir ke bawah ke bagian **Script Properties**, klik **Add script property**.
   * Masukkan Property: `SPREADSHEET_ID` dan Value: `SAMPEL_SPREADSHEET_ID_ANDA` (yang Anda catat di Langkah 1).
6. **Deploy Sebagai Web App**:
   * Di sudut kanan atas editor Apps Script, klik tombol **Deploy** > **New deployment**.
   * Klik ikon gerigi di sebelah *Select type* dan pilih **Web app**.
   * Konfigurasi sebagai berikut:
     * **Description**: `SISTA-CSSD API v1`
     * **Execute as**: `Me (email Anda)`
     * **Who has access**: `Anyone` (PENTING: Harus diset ke Anyone agar frontend static dapat memanggil API).
   * Klik **Deploy**.
   * Salin **Web app URL** yang muncul (berformat `https://script.google.com/macros/s/.../exec`). URL ini akan Anda gunakan di frontend.

---

## Langkah 3: Konfigurasi Notifikasi Telegram (Opsional)

Jika Anda ingin mengaktifkan fitur notifikasi bot Telegram:
1. Buat bot baru lewat Telegram BapaBot (`@BotFather`) untuk mendapatkan **Telegram Bot Token**.
2. Buat grup Telegram baru, masukkan bot tersebut sebagai anggota, lalu dapatkan **Chat ID** grup Anda.
3. Buka Google Sheets Anda, pilih sheet `config`.
4. Ubah baris dengan key `TELEGRAM_TOKEN` dengan token bot Anda, dan key `TELEGRAM_CHAT_ID` dengan chat ID grup Anda.
5. Anda juga bisa mengatur masa kedaluwarsa steril default (dalam hari) pada key `STERILE_EXPIRY_DAYS`.

---

## Langkah 4: Konfigurasi Google SSO (Google Sign-In)

Untuk menggunakan login Google SSO secara resmi di domain GitHub Pages Anda:
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru atau pilih proyek yang sudah ada.
3. Buka **APIs & Services** > **Credentials**.
4. Klik **Configure Consent Screen**, pilih **External**, lalu lengkapi informasi aplikasi.
5. Setelah consent screen siap, kembali ke tab **Credentials**, klik **+ Create Credentials** > **OAuth client ID**.
6. Pilih Application type: **Web application**.
7. Di bagian **Authorized JavaScript origins**, tambahkan URL domain tempat Anda meng-host frontend (misalnya `https://username.github.io`).
8. Jika Anda melakukan pengujian secara lokal, tambahkan `http://localhost`, `http://localhost:8000`, atau `http://127.0.0.1`.
9. Klik **Create**, lalu salin **Client ID** yang dihasilkan.
10. Buka file `index.html`, cari baris berikut (sekitar baris 729):
    ```javascript
    client_id: '965383505809-5a6b0c2pujh4aedjndvdt486e9270n5u.apps.googleusercontent.com',
    ```
    Ganti string client ID tersebut dengan Client ID Google Cloud Anda sendiri.

> [!NOTE]
> **Bypass Developer Mode**:
> Jika Anda belum ingin mengonfigurasi Google Cloud Console, Anda dapat langsung menguji aplikasi menggunakan fitur **Dev Login** yang ada di halaman masuk. Cukup masukkan email testing (misalnya `syamsul18782@gmail.com` untuk Super Admin, atau email ruangan lain) lalu klik **Login Dev** tanpa perlu verifikasi Google SSO.

---

## Langkah 5: Deployment Frontend (GitHub Pages)

Karena frontend SISTA-CSSD merupakan SPA statis murni (HTML/JS/CSS), Anda dapat langsung menjalankannya secara lokal atau mendeploynya ke platform hosting gratis:

### A. Menjalankan Secara Lokal
* Cukup buka file `index.html` langsung di browser Anda dengan melakukan klik ganda, atau jalankan menggunakan server lokal ringan (seperti ekstensi *Live Server* di VS Code atau perintah `npx serve .`).
* Saat pertama kali masuk, masukkan **Web App URL** Google Apps Script Anda (yang disalin dari Langkah 2) di kotak input konfigurasi URL yang disediakan di layar login. URL ini akan tersimpan otomatis di browser lokal Anda.

### B. Deploy ke GitHub Pages dengan GitHub CLI
Jika Anda ingin langsung mendeploy ke repositori GitHub pribadi Anda:
1. Pastikan Anda telah masuk ke akun GitHub Anda melalui CLI.
2. Inisialisasi repositori Git lokal dan hubungkan ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit SISTA-CSSD"
   gh repo create sista-cssd --public --source=. --remote=origin --push
   ```
3. Aktifkan GitHub Pages pada repositori tersebut melalui menu **Settings** > **Pages** di halaman GitHub repositori Anda, lalu pilih source: `Deploy from a branch` dan branch: `main`.
4. Aplikasi SISTA-CSSD Anda sekarang dapat diakses secara online oleh seluruh unit ruangan RSUD dr. R. Koesma!
