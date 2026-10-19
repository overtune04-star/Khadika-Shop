# Warung Bu Rina

## Mengelola produk

Kelola produk lewat [admin.html](./admin.html). Halaman ini dapat menambahkan, mengedit, menyembunyikan, dan mengganti foto produk. Saat tombol Simpan ditekan, perubahan dikirim sebagai commit ke repositori GitHub sehingga tidak perlu mengedit kode atau mengunggah file secara manual.

Saat pertama kali dipakai, isi pemilik repositori, nama repositori, cabang, lokasi `products.js`, dan lokasi folder gambar. Masukkan fine-grained personal access token GitHub dengan akses **Contents: read and write** untuk repositori tersebut. Token hanya disimpan sementara pada tab browser dan tidak ditulis ke website. Jangan bagikan token kepada orang lain.

Untuk menyembunyikan produk sementara, gunakan tombol **Sembunyikan** di daftar produk. Produk dan fotonya tetap tersimpan; gunakan **Tampilkan** untuk memasukkannya kembali ke katalog. Jika nama produk digunakan kembali setelah disembunyikan, edit produk tersembunyi tersebut agar foto dan informasi sebelumnya tetap tersimpan.

Form admin menyediakan kategori Sembako, Perlengkapan Mandi, Perlengkapan Cuci, Rumah Tangga, Makanan & Minuman, dan Lain-lain. Foto akan diperkecil otomatis sebelum disimpan. Untuk mengubah perilaku katalog atau keranjang, edit [app.js](./app.js). Untuk mengubah tampilan, edit bagian `<style>` di [index.html](./index.html).
- Untuk mengubah perilaku katalog atau keranjang, edit [app.js](./app.js). Untuk mengubah tampilan, edit bagian `<style>` di [index.html](./index.html).

## Mengatur WhatsApp toko

Buka [shop-config.js](./shop-config.js), lalu isi `whatsappNumber` dengan kode negara dan angka saja. Contoh, nomor `0812-3456-7890` ditulis sebagai `6281234567890`. Sesudah disimpan, tombol checkout akan membuka chat langsung ke nomor itu dengan daftar pesanan terisi.

## Memasang logo di header

Simpan logo di folder [images](./images/), lalu isi `headerLogo` di [shop-config.js](./shop-config.js), misalnya `headerLogo: "./images/logo-khadika.png"`. Logo horizontal dengan latar transparan paling cocok. Bila path kosong atau file logo belum ada, nama toko tetap muncul sebagai cadangan.
