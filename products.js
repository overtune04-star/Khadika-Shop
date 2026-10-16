/*
 * DAFTAR PRODUK
 * Tambah, ubah, atau hapus produk di dalam daftar ini.
 * category memakai salah satu kode: sembako, perlengkapan-mandi,
 * perlengkapan-cuci, rumah-tangga, makanan-minuman, lain-lain.
 * price diisi angka tanpa titik atau tulisan Rp. badge boleh dikosongkan.
 * Untuk memakai foto, isi image dengan lokasi relatif seperti ./images/beras-ramos.webp.
 */
window.WARUNG_PRODUCTS = [
  {
    id: "beras-lahap-lele",
    name: "Beras Lahap Lele",
    category: "sembako",
    categoryLabel: "Sembako",
    price: 77000,
    unit: "5 kg",
    emoji: "🌾",
    image: "./images/beras-lahap-lele.jpg",
    badge: "Laris",
    description: "Beras pulen untuk sajian keluarga setiap hari."
  },
  {
    id: "gula-pasir",
    name: "Gulaku Premium",
    category: "sembako",
    categoryLabel: "Sembako",
    price: 18500,
    unit: "1 kg",
    emoji: "🧂",
    image: "./images/gulaku.jpg",
    badge: "Stok ada",
    description: "Gula putih untuk minuman dan masakan."
  },
  {
    id: "sabun-mandi",
    name: "Sabun Cair Giv",
    category: "perlengkapan-mandi",
    categoryLabel: "Perlengkapan Mandi",
    price: 23000,
    unit: "1 pouch",
    emoji: "🧼",
    image: "./images/sabun-mandi.jpg",
    badge: "Favorit",
    description: "Sabun cair dengan aroma segar untuk keluarga."
  },
  {
    id: "sosoft",
    name: "Sosoft",
    category: "perlengkapan-cuci",
    categoryLabel: "Perlengkapan Cuci",
    price: 8500,
    unit: "360 gram",
    emoji: "🫗",
    image: "./images/sosoft.jpg",
    badge: "",
    description: "Minyak untuk stok dapur dan masak harian."
  },
  {
    id: "mi-instan",
    name: "Mi Instan",
    category: "makanan-minuman",
    categoryLabel: "Makanan & Minuman",
    price: 3500,
    unit: "1 bungkus",
    emoji: "🍜",
    image: "",
    badge: "",
    description: "Sajian praktis untuk teman santai di rumah."
  },
  {
    id: "deterjen-bubuk",
    name: "Deterjen Bubuk",
    category: "perlengkapan-cuci",
    categoryLabel: "Perlengkapan Cuci",
    price: 12000,
    unit: "kemasan kecil",
    emoji: "🫧",
    image: "",
    badge: "",
    description: "Pilihan praktis untuk mencuci pakaian harian."
  }
];
