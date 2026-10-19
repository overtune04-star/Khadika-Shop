(() => {
  const categories = {
    sembako: "Sembako",
    "perlengkapan-mandi": "Perlengkapan Mandi",
    "perlengkapan-cuci": "Perlengkapan Cuci",
    "rumah-tangga": "Rumah Tangga",
    "makanan-minuman": "Makanan & Minuman",
    "lain-lain": "Lain-lain"
  };
  const $ = selector => document.querySelector(selector);
  const settingsFields = {
    owner: $(`[data-owner]`),
    repo: $(`[data-repo]`),
    branch: $(`[data-branch]`),
    productPath: $(`[data-product-path]`),
    imagePath: $(`[data-image-path]`)
  };
  const tokenInput = $(`[data-token]`);
  const status = $(`[data-status]`);
  const list = $(`[data-list]`);
  const editor = $(`[data-editor]`);
  const form = $(`[data-product-form]`);
  const imageInput = form.elements.imageFile;
  const preview = $(`[data-preview]`);
  const saveButton = $(`[data-save-product]`);
  let products = [];
  let productsSha = "";
  let editingId = "";
  let isConnected = false;

  try {
    const saved = JSON.parse(localStorage.getItem("khadikaAdminSettings") || "{}");
    Object.entries(settingsFields).forEach(([key, field]) => {
      if (saved[key]) field.value = saved[key];
    });
    tokenInput.value = sessionStorage.getItem("khadikaAdminToken") || "";
  } catch { /* Jika penyimpanan browser tidak tersedia, pengaturan tetap dapat diisi manual. */ }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.dataset.type = type;
  }

  function getSettings() {
    return Object.fromEntries(Object.entries(settingsFields).map(([key, field]) => [key, field.value.trim().replace(/^\/+|\/+$/g, "")]));
  }

  function validateSettings() {
    const settings = getSettings();
    const token = tokenInput.value.trim();
    if (!settings.owner || !settings.repo || !settings.branch || !settings.productPath || !settings.imagePath || !token) {
      throw new Error("Lengkapi semua pengaturan repositori dan token GitHub terlebih dahulu.");
    }
    if (settings.productPath.startsWith(".") || settings.imagePath.startsWith(".")) {
      throw new Error("Lokasi file dan foto harus berupa path repositori, misalnya outputs/warung-bu-rina/products.js.");
    }
    return { ...settings, token };
  }

  function rememberSettings(settings) {
    try {
      localStorage.setItem("khadikaAdminSettings", JSON.stringify({
        owner: settings.owner, repo: settings.repo, branch: settings.branch,
        productPath: settings.productPath, imagePath: settings.imagePath
      }));
      sessionStorage.setItem("khadikaAdminToken", settings.token);
    } catch { /* Browser boleh menolak penyimpanan; nilai input tetap tersedia selama halaman terbuka. */ }
  }

  function apiUrl(path, branch = false) {
    const settings = getSettings();
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}`);
    if (branch) url.searchParams.set("ref", settings.branch);
    return url;
  }

  async function github(path, options = {}, allowMissing = false) {
    const token = tokenInput.value.trim();
    const response = await fetch(apiUrl(path, options.method !== "PUT"), {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    if (allowMissing && response.status === 404) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("GitHub menolak akses. Periksa token, izin Contents, dan akses akun ke repositori.");
      if (response.status === 404) throw new Error("File atau repositori tidak ditemukan. Periksa nama repositori, cabang, dan lokasi file.");
      if (response.status === 409 || response.status === 422) throw new Error("GitHub mendeteksi perubahan yang bertabrakan. Muat ulang produk lalu coba lagi.");
      throw new Error(result.message || `Permintaan GitHub gagal (${response.status}).`);
    }
    return result;
  }

  function decodeFile(base64) {
    const binary = atob(base64.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function parseProductFile(source) {
    const match = source.match(/window\.WARUNG_PRODUCTS\s*=\s*([\s\S]*);\s*$/);
    if (!match) throw new Error("Format products.js belum dikenali. Produk tidak diubah.");
    const text = match[1];
    let cursor = 0;

    function skipSpace() {
      while (cursor < text.length) {
        if (/\s/.test(text[cursor])) { cursor += 1; continue; }
        if (text[cursor] === "/" && text[cursor + 1] === "/") {
          cursor += 2;
          while (cursor < text.length && text[cursor] !== "\n") cursor += 1;
          continue;
        }
        if (text[cursor] === "/" && text[cursor + 1] === "*") {
          const end = text.indexOf("*/", cursor + 2);
          if (end < 0) throw new Error("Komentar di products.js belum ditutup.");
          cursor = end + 2;
          continue;
        }
        break;
      }
    }

    function readString() {
      const start = cursor;
      cursor += 1;
      while (cursor < text.length) {
        if (text[cursor] === "\\") { cursor += 2; continue; }
        if (text[cursor] === '"') {
          cursor += 1;
          return JSON.parse(text.slice(start, cursor));
        }
        cursor += 1;
      }
      throw new Error("Teks produk di products.js belum ditutup dengan benar.");
    }

    function readKey() {
      skipSpace();
      if (text[cursor] === '"') return readString();
      const match = text.slice(cursor).match(/^[A-Za-z_$][\w$]*/);
      if (!match) throw new Error(`Nama properti products.js tidak valid di posisi ${cursor}.`);
      cursor += match[0].length;
      return match[0];
    }

    function readValue() {
      skipSpace();
      const character = text[cursor];
      if (character === '"') return readString();
      if (character === "[") {
        cursor += 1;
        const items = [];
        skipSpace();
        while (text[cursor] !== "]") {
          if (cursor >= text.length) throw new Error("Daftar produk di products.js belum ditutup.");
          items.push(readValue());
          skipSpace();
          if (text[cursor] === ",") { cursor += 1; skipSpace(); if (text[cursor] === "]") break; }
          else if (text[cursor] !== "]") throw new Error(`Pemisah item products.js tidak valid di posisi ${cursor}.`);
        }
        cursor += 1;
        return items;
      }
      if (character === "{") {
        cursor += 1;
        const object = Object.create(null);
        skipSpace();
        while (text[cursor] !== "}") {
          if (cursor >= text.length) throw new Error("Data produk di products.js belum ditutup.");
          const key = readKey();
          skipSpace();
          if (text[cursor] !== ":") throw new Error(`Tanda titik dua tidak ditemukan setelah ${key}.`);
          cursor += 1;
          object[key] = readValue();
          skipSpace();
          if (text[cursor] === ",") { cursor += 1; skipSpace(); if (text[cursor] === "}") break; }
          else if (text[cursor] !== "}") throw new Error(`Pemisah properti products.js tidak valid di posisi ${cursor}.`);
        }
        cursor += 1;
        return object;
      }
      const number = text.slice(cursor).match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) { cursor += number[0].length; return Number(number[0]); }
      const word = text.slice(cursor).match(/^[A-Za-z_$][\w$]*/)?.[0];
      if (word === "true") { cursor += word.length; return true; }
      if (word === "false") { cursor += word.length; return false; }
      if (word === "null") { cursor += word.length; return null; }
      throw new Error(`Nilai products.js tidak dikenali di posisi ${cursor}.`);
    }

    const result = readValue();
    skipSpace();
    if (cursor !== text.length) throw new Error(`Ada data tambahan yang tidak dikenali di products.js pada posisi ${cursor}.`);
    if (!Array.isArray(result)) throw new Error("Daftar produk di repositori bukan array yang valid.");
    return result;
  }

  async function loadProducts() {
    const settings = validateSettings();
    setStatus("Menghubungkan ke GitHub dan memuat produk…");
    const file = await github(settings.productPath);
    if (!file.content || file.encoding !== "base64") throw new Error("GitHub tidak mengembalikan isi products.js yang dapat dibaca.");
    products = parseProductFile(decodeFile(file.content));
    productsSha = file.sha;
    isConnected = true;
    rememberSettings(settings);
    renderList();
    setStatus(`Terhubung. Produk dimuat: ${products.length}.`, "success");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function renderList() {
    list.replaceChildren();
    $(`[data-count]`).textContent = `(${products.length})`;
    if (!products.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Belum ada produk. Tekan Tambah produk untuk memulai.";
      list.append(empty);
      return;
    }
    products.forEach(product => {
      const row = document.createElement("article");
      row.className = "product-row";
      const imageMarkup = product.image
        ? `<img src="${escapeHtml(product.image)}" alt="" loading="lazy">`
        : escapeHtml(product.emoji || "🛍️");
      row.innerHTML = `<div class="thumb">${imageMarkup}</div>
        <div><h3>${escapeHtml(product.name)}${product.visible === false ? '<span class="badge">Disembunyikan</span>' : ""}</h3>
        <p>${escapeHtml(categories[product.category] || product.categoryLabel || "Lain-lain")} · Rp ${Number(product.price || 0).toLocaleString("id-ID")} · ${escapeHtml(product.unit)}</p></div>
        <div class="row-actions"><button class="btn" type="button" data-edit="${escapeHtml(product.id)}">Edit</button><button class="btn" type="button" data-toggle="${escapeHtml(product.id)}">${product.visible === false ? "Tampilkan" : "Sembunyikan"}</button></div>`;
      list.append(row);
    });
  }

  function openEditor(product = null) {
    form.reset();
    editingId = product?.id || "";
    $("#editor-title").textContent = product ? "Edit produk" : "Tambah produk";
    form.elements.name.value = product?.name || "";
    form.elements.category.value = product?.category || "sembako";
    form.elements.price.value = product?.price ?? "";
    form.elements.unit.value = product?.unit || "";
    form.elements.badge.value = product?.badge || "";
    form.elements.emoji.value = product?.emoji || "🛍️";
    form.elements.description.value = product?.description || "";
    form.elements.imageFile.value = "";
    form.dataset.existingImage = product?.image || "";
    preview.innerHTML = product?.image
      ? `<img src="${escapeHtml(product.image)}" alt="Foto ${escapeHtml(product.name)}">`
      : escapeHtml(product?.emoji || "🛍️");
    $(`[data-delete]`).classList.toggle("hidden", !product);
    editor.classList.remove("hidden");
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.name.focus({ preventScroll: true });
  }

  function closeEditor() {
    editor.classList.add("hidden");
    form.reset();
    editingId = "";
  }

  function slugify(value) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("id")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `produk-${Date.now()}`;
  }

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  async function compressImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("Pilih file foto dengan format gambar.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Ukuran foto maksimal 20 MB sebelum diperkecil.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) throw new Error("Foto tidak bisa diproses di browser ini.");
    return { base64: toBase64(await blob.arrayBuffer()), extension: "webp" };
  }

  async function uploadImage(file, id) {
    const settings = validateSettings();
    setStatus("Memperkecil dan mengunggah foto…");
    const image = await compressImage(file);
    const imagePath = `${settings.imagePath}/${id}.${image.extension}`;
    const previous = await github(imagePath, {}, true);
    const body = {
      message: `Perbarui foto produk ${id}`,
      content: image.base64,
      branch: settings.branch,
      ...(previous?.sha ? { sha: previous.sha } : {})
    };
    await github(imagePath, { method: "PUT", body: JSON.stringify(body) });
    const productDirectory = settings.productPath.split("/").slice(0, -1).join("/");
    const relativeImage = imagePath.startsWith(`${productDirectory}/`)
      ? `./${imagePath.slice(productDirectory.length + 1)}`
      : `./${id}.${image.extension}`;
    return relativeImage;
  }

  async function saveProductFile(message) {
    const settings = validateSettings();
    setStatus("Menyimpan daftar produk ke GitHub…");
    const content = `window.WARUNG_PRODUCTS = ${JSON.stringify(products, null, 2)};\n`;
    const body = { message, content: toBase64(new TextEncoder().encode(content)), branch: settings.branch, ...(productsSha ? { sha: productsSha } : {}) };
    const result = await github(settings.productPath, { method: "PUT", body: JSON.stringify(body) });
    productsSha = result.content?.sha || "";
    renderList();
    setStatus("Tersimpan ke GitHub. Situs akan memperbarui katalog setelah proses penerbitan selesai.", "success");
  }

  function requireConnection() {
    if (!isConnected) throw new Error("Hubungkan GitHub dan muat produk terlebih dahulu.");
  }

  $(`[data-connect]`).addEventListener("click", async () => {
    try {
      const settings = validateSettings();
      rememberSettings(settings);
      await loadProducts();
    } catch (error) { setStatus(error.message, "error"); }
  });

  $(`[data-add]`).addEventListener("click", () => {
    try { requireConnection(); openEditor(); }
    catch (error) { setStatus(error.message, "error"); }
  });

  $(`[data-cancel]`).addEventListener("click", closeEditor);

  list.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit]");
    const toggleButton = event.target.closest("[data-toggle]");
    if (editButton) {
      const product = products.find(item => item.id === editButton.dataset.edit);
      if (product) openEditor(product);
      return;
    }
    if (toggleButton) {
      let product;
      let previousVisibility;
      try {
        requireConnection();
        product = products.find(item => item.id === toggleButton.dataset.toggle);
        if (!product) return;
        previousVisibility = product.visible;
        product.visible = product.visible === false;
        toggleButton.disabled = true;
        await saveProductFile(`${product.visible ? "Tampilkan" : "Sembunyikan"} produk ${product.name}`);
      } catch (error) {
        if (product) {
          if (previousVisibility === undefined) delete product.visible;
          else product.visible = previousVisibility;
        }
        renderList();
        setStatus(error.message, "error");
      }
    }
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${objectUrl}" alt="Pratinjau foto produk">`;
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      requireConnection();
      saveButton.disabled = true;
      const data = new FormData(form);
      const existing = products.find(item => item.id === editingId);
      const name = String(data.get("name")).trim();
      let id = existing?.id || slugify(name);
      if (!existing && products.some(item => item.id === id)) id = `${id}-${Date.now().toString().slice(-4)}`;
      const imageFile = imageInput.files?.[0];
      let image = existing?.image || "";
      if (imageFile) image = await uploadImage(imageFile, id);
      const previousProducts = [...products];
      const updated = {
        ...(existing || {}),
        id, name,
        category: String(data.get("category")),
        categoryLabel: categories[String(data.get("category"))],
        price: Number(data.get("price")),
        unit: String(data.get("unit")).trim(),
        emoji: String(data.get("emoji")).trim() || "🛍️",
        image,
        badge: String(data.get("badge")).trim(),
        description: String(data.get("description")).trim(),
        visible: existing?.visible !== false
      };
      if (existing) products = products.map(item => item.id === existing.id ? updated : item);
      else products.push(updated);
      try {
        await saveProductFile(`${existing ? "Ubah" : "Tambah"} produk ${name}`);
      } catch (error) {
        products = previousProducts;
        renderList();
        throw error;
      }
      closeEditor();
    } catch (error) { setStatus(error.message, "error"); }
    finally { saveButton.disabled = false; }
  });

  $(`[data-delete]`).addEventListener("click", async () => {
    const product = products.find(item => item.id === editingId);
    if (!product || !window.confirm(`Hapus ${product.name} dari katalog?`)) return;
    const previousProducts = [...products];
    try {
      products = products.filter(item => item.id !== editingId);
      await saveProductFile(`Hapus produk ${product.name}`);
      closeEditor();
    } catch (error) {
      products = previousProducts;
      renderList();
      setStatus(error.message, "error");
    }
  });
})();
