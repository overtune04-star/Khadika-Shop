# Warung Bu Rina

## Mengelola produk

Kelola produk lewat [admin.html](./admin.html). Halaman ini dapat menambahkan, mengedit, menyembunyikan, dan mengganti foto produk. Saat tombol Simpan ditekan, perubahan dikirim sebagai commit ke repositori GitHub sehingga tidak perlu mengedit kode atau mengunggah file secara manual.

Pengaturan repositori sudah disiapkan, jadi admin hanya meminta token GitHub. Gunakan fine-grained personal access token yang dibatasi ke repositori `overtune04-star/Khadika-Shop` dengan akses **Contents: read and write**. Token hanya disimpan sementara pada tab browser dan tidak ditulis ke website. Jangan bagikan token kepada orang lain.

Untuk menyembunyikan produk sementara, gunakan tombol **Sembunyikan** di daftar produk. Produk dan fotonya tetap tersimpan; gunakan **Tampilkan** untuk memasukkannya kembali ke katalog. Jika nama produk digunakan kembali setelah disembunyikan, edit produk tersembunyi tersebut agar foto dan informasi sebelumnya tetap tersimpan.

## Memasang admin di Android

Admin sudah disiapkan sebagai PWA. Unggah `admin.html`, `admin.js`, `admin-pwa.js`, `service-worker.js`, `manifest.webmanifest`, dan ikon `images/admin-icon-192.png` serta `images/admin-icon-512.png` ke repositori GitHub. Pastikan GitHub Pages membukanya melalui HTTPS. Di Chrome Android, buka halaman admin, lalu pilih **Pasang aplikasi** jika tombolnya tersedia atau pilih **Tambahkan ke layar utama** dari menu browser. Koneksi internet tetap diperlukan untuk memuat dan menyimpan produk ke GitHub.

Token GitHub tidak dimasukkan ke dalam aplikasi. Masukkan token melalui halaman admin saat menghubungkan repositori; halaman menyimpannya sementara selama sesi terbuka.

## Kasir Khadika

Buka [kasir.html](./kasir.html) untuk mencatat penjualan, barang masuk, stok aktual, harga modal, pengeluaran, dan pembayaran tunai/QRIS/transfer. QRIS dan transfer dikonfirmasi manual sebelum transaksi disimpan. Atur harga modal dan stok produk di menu **Stok & modal** sebelum mulai menjual agar laporan laba memiliki dasar perhitungan yang benar. Unggah gambar QRIS toko dari menu yang sama.

Kasir menyimpan transaksi dan pergerakan stok di IndexedDB pada perangkat yang digunakan, sehingga penjualan dapat dicatat tanpa internet dan disimpan saat transaksi selesai. Data ini belum tersinkron ke perangkat lain atau server. Gunakan **Unduh cadangan data** secara berkala dan simpan file cadangan di tempat aman. Laporan laba bersih menghitung penjualan dikurangi modal barang dan pengeluaran yang dicatat; biaya merchant QRIS yang belum dicatat sebagai pengeluaran tidak termasuk.

Untuk memasang kasir sebagai aplikasi PWA, unggah juga `kasir.html`, `kasir.js`, dan `manifest-kasir.webmanifest`. Service worker memperbarui cache aplikasi dan menyimpan halaman, produk, serta foto produk untuk pemakaian offline.

Form admin menyediakan kategori Sembako, Perlengkapan Mandi, Perlengkapan Cuci, Rumah Tangga, Makanan & Minuman, dan Lain-lain. Foto akan diperkecil otomatis sebelum disimpan. Untuk mengubah perilaku katalog atau keranjang, edit [app.js](./app.js). Untuk mengubah tampilan, edit bagian `<style>` di [index.html](./index.html).
- Untuk mengubah perilaku katalog atau keranjang, edit [app.js](./app.js). Untuk mengubah tampilan, edit bagian `<style>` di [index.html](./index.html).

## Mengatur WhatsApp toko

Buka [shop-config.js](./shop-config.js), lalu isi `whatsappNumber` dengan kode negara dan angka saja. Contoh, nomor `0812-3456-7890` ditulis sebagai `6281234567890`. Sesudah disimpan, tombol checkout akan membuka chat langsung ke nomor itu dengan daftar pesanan terisi.

## Memasang logo di header

Simpan logo di folder [images](./images/), lalu isi `headerLogo` di [shop-config.js](./shop-config.js), misalnya `headerLogo: "./images/logo-khadika.png"`. Logo horizontal dengan latar transparan paling cocok. Bila path kosong atau file logo belum ada, nama toko tetap muncul sebagai cadangan.
