# Warung Bu Rina

## Mengelola produk

Edit daftar di [products.js](./products.js). Setiap produk berisi nama, kategori, harga, satuan, emoji cadangan, foto opsional, label, dan deskripsi. Setelah disimpan, muat ulang halaman katalog.

```js
{
  id: "sabun-cair",
  name: "Sabun Cair",
  category: "perlengkapan-mandi",
  categoryLabel: "Perlengkapan Mandi",
  price: 12000,
  unit: "250 ml",
  emoji: "🧴",
  image: "./images/sabun-cair.webp",
  badge: "",
  description: "Sabun cair untuk kebutuhan mandi harian."
}
```

- `id` harus unik dan ditulis dengan huruf kecil serta tanda hubung.
- `price` gunakan angka saja, tanpa `Rp` atau tanda pemisah ribuan.
- `badge` bisa dikosongkan (`""`) jika produk tidak memakai label.
- Simpan foto di folder [images](./images/), lalu isi `image` dengan path seperti `./images/sabun-cair.webp`. Kosongkan `image` untuk memakai emoji sebagai pengganti.
- Foto persegi sekitar **1000 × 1000 piksel** disarankan. Gunakan WebP atau JPG yang dikompres; foto akan diskalakan otomatis di desktop dan HP tanpa memotong kemasan.
- Kode kategori yang tersedia: `sembako`, `perlengkapan-mandi`, `perlengkapan-cuci`, `rumah-tangga`, `makanan-minuman`, dan `lain-lain`.
- Untuk mengubah perilaku katalog atau keranjang, edit [app.js](./app.js). Untuk mengubah tampilan, edit bagian `<style>` di [index.html](./index.html).

## Mengatur WhatsApp toko

Buka [shop-config.js](./shop-config.js), lalu isi `whatsappNumber` dengan kode negara dan angka saja. Contoh, nomor `0812-3456-7890` ditulis sebagai `6281234567890`. Sesudah disimpan, tombol checkout akan membuka chat langsung ke nomor itu dengan daftar pesanan terisi.
