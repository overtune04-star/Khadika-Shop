(() => {
  const DB_NAME = "khadika-pos";
  const DB_VERSION = 1;
  const categories = {
    all: "Semua",
    sembako: "Sembako",
    "perlengkapan-mandi": "Perlengkapan Mandi",
    "perlengkapan-cuci": "Perlengkapan Cuci",
    "rumah-tangga": "Rumah Tangga",
    "makanan-minuman": "Makanan & Minuman",
    "lain-lain": "Lain-lain"
  };
  const products = Array.isArray(window.WARUNG_PRODUCTS) ? window.WARUNG_PRODUCTS : [];
  const $ = (selector) => document.querySelector(selector);
  const money = (value) => `Rp${Math.round(Number(value) || 0).toLocaleString("id-ID")}`;
  const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  let db;
  let productState = new Map();
  let transactions = [];
  let movements = [];
  let expenses = [];
  let qrisBlob = null;
  let qrisObjectUrl = "";
  let activeCategory = "all";
  let cart = new Map();
  let toastTimer;

  const elements = {
    statusText: $("[data-network-status]"), networkDot: $("[data-network-dot]"),
    productGrid: $("[data-products]"), categories: $("[data-categories]"), search: $("[data-search]"),
    cartPanel: $("[data-cart-panel]"), cartLines: $("[data-cart-lines]"), cartSummary: $("[data-cart-summary]"), cartTotal: $("[data-cart-total]"),
    mobileCart: $("[data-cart-open]"), mobileCartCount: $("[data-mobile-cart-count]"), mobileCartTotal: $("[data-mobile-cart-total]"),
    inventoryDialog: $("[data-inventory-modal]"), inventoryList: $("[data-inventory-list]"), stockProduct: $("[data-stock-product]"),
    expenseDialog: $("[data-expense-modal]"), checkoutDialog: $("[data-checkout-modal]"),
    qrisPreview: $("[data-qris-preview]"), checkoutQris: $("[data-checkout-qris]"), paymentCheck: $("[data-payment-check-row]"), toast: $("[data-toast]")
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result;
        if (!store.objectStoreNames.contains("transactions")) store.createObjectStore("transactions", { keyPath: "id" });
        if (!store.objectStoreNames.contains("movements")) store.createObjectStore("movements", { keyPath: "id" });
        if (!store.objectStoreNames.contains("expenses")) store.createObjectStore("expenses", { keyPath: "id" });
        if (!store.objectStoreNames.contains("productState")) store.createObjectStore("productState", { keyPath: "id" });
        if (!store.objectStoreNames.contains("settings")) store.createObjectStore("settings", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Penyimpanan kasir tidak dapat dibuka."));
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function saveSetting(record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Perubahan tidak tersimpan."));
    });
  }

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.add("hidden"), 2600);
  }

  function productInfo(product) {
    const saved = productState.get(product.id) || {};
    return {
      ...product,
      price: Number(product.price) || 0,
      costPrice: Number(saved.costPrice ?? product.costPrice) || 0,
      stock: Math.max(0, Number(saved.stock ?? product.stock) || 0)
    };
  }

  function renderCategories() {
    elements.categories.innerHTML = Object.entries(categories).map(([key, label]) => `
      <button class="category-button" type="button" data-category="${escapeHtml(key)}" aria-pressed="${key === activeCategory}">${escapeHtml(label)}</button>
    `).join("");
    elements.categories.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category;
        renderCategories();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    const query = elements.search.value.trim().toLocaleLowerCase("id-ID");
    const filtered = products.filter((product) => {
      const matchesCategory = activeCategory === "all" || product.category === activeCategory;
      const matchesQuery = `${product.name} ${product.description || ""}`.toLocaleLowerCase("id-ID").includes(query);
      return matchesCategory && matchesQuery;
    });
    if (!filtered.length) {
      elements.productGrid.innerHTML = '<div class="empty">Produk tidak ditemukan.</div>';
      return;
    }
    elements.productGrid.innerHTML = filtered.map((product) => {
      const item = productInfo(product);
      const inCart = cart.get(item.id) || 0;
      const noStock = item.stock <= inCart;
      const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.remove()">` : escapeHtml(item.emoji || "🛍️");
      const stockText = item.stock === 0 ? "Atur stok untuk mulai menjual" : `Stok ${item.stock} ${escapeHtml(item.unit || "unit")}`;
      return `<article class="product"><div class="product-image">${image}</div><div class="product-info"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(categories[item.category] || item.categoryLabel || "Produk")}${item.unit ? ` · ${escapeHtml(item.unit)}` : ""}</p><strong>${money(item.price)}</strong><p class="stock-label ${item.stock <= 3 ? "low" : ""}">${stockText}</p><button class="add-button" type="button" data-add-to-cart="${escapeHtml(item.id)}" ${noStock ? "disabled" : ""}>${noStock ? (item.stock === 0 ? "Stok kosong" : "Jumlah maksimal") : (inCart ? `＋ Tambah (${inCart})` : "+ Tambah")}</button></div></article>`;
    }).join("");
  }

  function cartTotal() {
    let total = 0;
    for (const [id, quantity] of cart) {
      const product = products.find((item) => item.id === id);
      if (product) total += (Number(product.price) || 0) * quantity;
    }
    return total;
  }

  function cartCount() {
    return Array.from(cart.values()).reduce((sum, count) => sum + count, 0);
  }

  function renderCart() {
    const count = cartCount();
    elements.cartSummary.textContent = count ? `${count} barang dalam keranjang` : "Belum ada barang dipilih";
    elements.cartTotal.textContent = money(cartTotal());
    elements.mobileCartCount.textContent = `Keranjang · ${count} barang`;
    elements.mobileCartTotal.textContent = money(cartTotal());
    elements.mobileCart.hidden = count === 0;
    if (!count) {
      elements.cartLines.innerHTML = '<div class="cart-empty">Pilih barang untuk memulai transaksi.</div>';
      renderProducts();
      return;
    }
    elements.cartLines.innerHTML = Array.from(cart.entries()).map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      if (!product) return "";
      const lineTotal = (Number(product.price) || 0) * quantity;
      return `<div class="cart-line"><div><strong>${escapeHtml(product.name)}</strong><small>${money(product.price)} × ${quantity} = ${money(lineTotal)}</small></div><div class="qty-control"><button type="button" aria-label="Kurangi ${escapeHtml(product.name)}" data-cart-dec="${escapeHtml(id)}">−</button><span>${quantity}</span><button type="button" aria-label="Tambah ${escapeHtml(product.name)}" data-cart-inc="${escapeHtml(id)}">+</button></div></div>`;
    }).join("");
    elements.cartLines.querySelectorAll("[data-cart-dec]").forEach((button) => button.addEventListener("click", () => changeCart(button.dataset.cartDec, -1)));
    elements.cartLines.querySelectorAll("[data-cart-inc]").forEach((button) => button.addEventListener("click", () => changeCart(button.dataset.cartInc, 1)));
    renderProducts();
  }

  function addToCart(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const state = productInfo(product);
    const quantity = cart.get(id) || 0;
    if (quantity >= state.stock) return toast("Jumlah melebihi stok. Periksa stok produk.");
    cart.set(id, quantity + 1);
    renderCart();
  }

  function changeCart(id, delta) {
    const next = (cart.get(id) || 0) + delta;
    if (next <= 0) cart.delete(id);
    else {
      const product = products.find((item) => item.id === id);
      if (next > productInfo(product).stock) return toast("Jumlah melebihi stok tersedia.");
      cart.set(id, next);
    }
    renderCart();
  }

  function renderInventory() {
    elements.inventoryList.innerHTML = products.map((product) => {
      const item = productInfo(product);
      return `<div class="product-config"><strong>${escapeHtml(item.name)}<br><span style="font-weight:500;color:#7a8177">${escapeHtml(item.unit || "")}</span></strong><label>Modal / unit<input type="number" min="0" step="1" value="${item.costPrice}" data-cost-for="${escapeHtml(item.id)}"></label><label>Stok aktual<input type="number" min="0" step="1" value="${item.stock}" data-stock-for="${escapeHtml(item.id)}"></label></div>`;
    }).join("");
  }

  function renderStockSelect() {
    elements.stockProduct.innerHTML = products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`).join("");
  }

  function storeStockMovement(type, product, quantity, unitCost, note = "") {
    const current = productInfo(product);
    const nextStock = Math.max(0, current.stock + quantity);
    let nextCost = current.costPrice;
    if (type === "masuk" && quantity > 0) {
      nextCost = current.stock > 0
        ? Math.round(((current.stock * current.costPrice) + (quantity * unitCost)) / nextStock)
        : unitCost;
    }
    const movement = { id: uid(), date: new Date().toISOString(), dateKey: todayKey(), productId: product.id, productName: product.name, type, quantity, unitCost: Number(unitCost) || 0, stockAfter: nextStock, note };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["movements", "productState"], "readwrite");
      tx.objectStore("movements").add(movement);
      tx.objectStore("productState").put({ id: product.id, stock: nextStock, costPrice: nextCost, updatedAt: movement.date });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Pergerakan stok tidak tersimpan."));
    }).then(async () => {
      productState.set(product.id, { id: product.id, stock: nextStock, costPrice: nextCost });
      movements.push(movement);
      renderProducts();
      renderInventory();
      renderReports();
    });
  }

  async function saveInventorySettings() {
    const costs = elements.inventoryList.querySelectorAll("[data-cost-for]");
    const stockInputs = elements.inventoryList.querySelectorAll("[data-stock-for]");
    const records = [];
    const corrections = [];
    for (const product of products) {
      const costInput = Array.from(costs).find((input) => input.dataset.costFor === product.id);
      const stockInput = Array.from(stockInputs).find((input) => input.dataset.stockFor === product.id);
      const old = productInfo(product);
      const costPrice = Math.max(0, Math.round(Number(costInput?.value) || 0));
      const stock = Math.max(0, Math.floor(Number(stockInput?.value) || 0));
      records.push({ id: product.id, costPrice, stock, updatedAt: new Date().toISOString() });
      const delta = stock - old.stock;
      if (delta !== 0) corrections.push({ id: uid(), date: new Date().toISOString(), dateKey: todayKey(), productId: product.id, productName: product.name, type: "koreksi", quantity: delta, unitCost: costPrice, stockAfter: stock, note: "Penyesuaian stok aktual" });
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["productState", "movements"], "readwrite");
      const stateStore = tx.objectStore("productState");
      const movementStore = tx.objectStore("movements");
      records.forEach((record) => stateStore.put(record));
      corrections.forEach((movement) => movementStore.add(movement));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Modal dan stok tidak tersimpan."));
    });
    records.forEach((record) => productState.set(record.id, record));
    movements.push(...corrections);
    renderProducts();
    renderInventory();
    renderReports();
    toast("Modal dan stok tersimpan di perangkat ini.");
  }

  function openQrImage(blob) {
    if (qrisObjectUrl) URL.revokeObjectURL(qrisObjectUrl);
    qrisObjectUrl = blob ? URL.createObjectURL(blob) : "";
    if (qrisObjectUrl) {
      elements.qrisPreview.innerHTML = `<strong>QRIS siap digunakan</strong><img src="${qrisObjectUrl}" alt="QRIS pembayaran Khadika Shop">`;
      elements.checkoutQris.innerHTML = `<strong>Scan QRIS Khadika Shop</strong><img src="${qrisObjectUrl}" alt="QRIS pembayaran Khadika Shop"><p>Pastikan nama merchant dan jumlah pembayaran benar di aplikasi pelanggan.</p>`;
      elements.checkoutQris.classList.remove("hidden");
    } else {
      elements.qrisPreview.innerHTML = "<p>Belum ada gambar QRIS. Unggah QRIS toko agar tampil saat pembayaran dipilih.</p>";
      elements.checkoutQris.innerHTML = "<p>QRIS belum disiapkan. Unggah gambar QRIS melalui menu Stok & modal.</p>";
    }
  }

  function renderReports() {
    const today = todayKey();
    const todaysSales = transactions.filter((sale) => sale.dateKey === today);
    const todaysExpenses = expenses.filter((expense) => expense.dateKey === today);
    const salesTotal = todaysSales.reduce((sum, sale) => sum + sale.total, 0);
    const expensesTotal = todaysExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const cogs = todaysSales.reduce((sum, sale) => sum + sale.costTotal, 0);
    const units = todaysSales.reduce((sum, sale) => sum + sale.items.reduce((subtotal, item) => subtotal + item.quantity, 0), 0);
    const incompleteCosts = products.filter((product) => {
      const item = productInfo(product);
      return item.stock > 0 && item.costPrice <= 0;
    }).length;
    $("[data-today-sales]").textContent = money(salesTotal);
    $("[data-sales-count]").textContent = `${todaysSales.length} transaksi`;
    $("[data-today-profit]").textContent = incompleteCosts ? "Modal belum lengkap" : money(salesTotal - cogs - expensesTotal);
    $("[data-today-expenses]").textContent = money(expensesTotal);
    $("[data-units-sold]").textContent = String(units);
    const missingNote = $("[data-today-profit]").nextElementSibling;
    missingNote.textContent = incompleteCosts ? `Isi harga modal ${incompleteCosts} produk untuk hitung laba` : "Penjualan − modal barang − biaya";

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const soldByProduct = new Map();
    transactions.filter((sale) => sale.dateKey >= cutoffKey && sale.dateKey <= today).forEach((sale) => {
      sale.items.forEach((item) => soldByProduct.set(item.productId, (soldByProduct.get(item.productId) || 0) + item.quantity));
    });
    const ranked = products.map((product) => ({ product, units: soldByProduct.get(product.id) || 0, state: productInfo(product) }));
    const best = ranked.filter((item) => item.units > 0).sort((a, b) => b.units - a.units).slice(0, 5);
    const slow = ranked.filter((item) => item.state.stock > 0).sort((a, b) => a.units - b.units || (b.state.stock * b.state.costPrice) - (a.state.stock * a.state.costPrice)).slice(0, 5);
    const renderRank = (items, mode) => items.length ? items.map((item) => {
      const extra = mode === "slow" ? `Modal tertahan ${money(item.state.stock * item.state.costPrice)}` : `${item.units} terjual`;
      return `<div class="rank-item"><strong>${escapeHtml(item.product.name)}</strong><span>${extra}</span></div>`;
    }).join("") : `<div class="empty">${mode === "best" ? "Belum ada transaksi dalam 30 hari." : "Masukkan stok untuk melihat produk yang perlu diperhatikan."}</div>`;
    $("[data-best-sellers]").innerHTML = renderRank(best, "best");
    $("[data-slow-sellers]").innerHTML = renderRank(slow, "slow");
    renderHistory();
  }

  function renderHistory() {
    const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const recentSales = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const recentMovements = [...movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const formatDate = (value) => dateFormat.format(new Date(value));
    $("[data-sales-history]").innerHTML = recentSales.length ? recentSales.map((sale) => {
      const names = sale.items.slice(0, 2).map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join(", ");
      const additional = sale.items.length > 2 ? `, +${sale.items.length - 2} produk` : "";
      return `<div class="activity-row"><strong>${money(sale.total)} · ${escapeHtml(sale.paymentMethod)}</strong><span>${formatDate(sale.date)} · ${names}${additional}</span></div>`;
    }).join("") : '<div class="activity-empty">Belum ada penjualan.</div>';
    $("[data-stock-history]").innerHTML = recentMovements.length ? recentMovements.map((movement) => {
      const action = movement.type === "masuk" ? `Masuk +${movement.quantity}` : movement.type === "keluar" ? `Terjual ${movement.quantity}` : `Koreksi ${movement.quantity > 0 ? "+" : ""}${movement.quantity}`;
      return `<div class="activity-row"><strong>${escapeHtml(movement.productName)} · ${action}</strong><span>${formatDate(movement.date)} · Stok akhir ${movement.stockAfter}${movement.note ? ` · ${escapeHtml(movement.note)}` : ""}</span></div>`;
    }).join("") : '<div class="activity-empty">Belum ada pergerakan stok.</div>';
    $("[data-expense-history]").innerHTML = recentExpenses.length ? recentExpenses.map((expense) => `<div class="activity-row"><strong>${escapeHtml(expense.name)} · ${money(expense.amount)}</strong><span>${formatDate(expense.date)}</span></div>`).join("") : '<div class="activity-empty">Belum ada pengeluaran.</div>';
  }

  async function saveSale(paymentMethod, cashReceived = 0) {
    const total = cartTotal();
    const items = [];
    let costTotal = 0;
    for (const [id, quantity] of cart) {
      const product = products.find((item) => item.id === id);
      const current = productInfo(product);
      if (current.stock < quantity) throw new Error(`Stok ${product.name} tidak cukup.`);
      if (current.costPrice <= 0) throw new Error(`Isi harga modal ${product.name} pada menu Stok & modal sebelum menjual.`);
      const itemCost = current.costPrice * quantity;
      costTotal += itemCost;
      items.push({ productId: product.id, name: product.name, quantity, unitPrice: current.price, unitCost: current.costPrice, lineTotal: current.price * quantity, lineCost: itemCost });
    }
    const now = new Date();
    const sale = { id: uid(), date: now.toISOString(), dateKey: todayKey(), items, total, costTotal, profitBeforeExpenses: total - costTotal, paymentMethod, cashReceived: paymentMethod === "Tunai" ? cashReceived : null, change: paymentMethod === "Tunai" ? cashReceived - total : 0, status: "selesai" };
    const saleMovements = items.map((item) => ({ id: uid(), date: sale.date, dateKey: sale.dateKey, productId: item.productId, productName: item.name, type: "keluar", quantity: -item.quantity, unitCost: item.unitCost, stockAfter: productInfo(products.find((product) => product.id === item.productId)).stock - item.quantity, transactionId: sale.id }));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["transactions", "movements", "productState"], "readwrite");
      tx.objectStore("transactions").add(sale);
      saleMovements.forEach((movement) => tx.objectStore("movements").add(movement));
      items.forEach((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        const state = productInfo(product);
        tx.objectStore("productState").put({ id: product.id, stock: state.stock - item.quantity, costPrice: state.costPrice, updatedAt: sale.date });
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaksi tidak tersimpan."));
    });
    transactions.push(sale);
    movements.push(...saleMovements);
    for (const item of items) {
      const state = productInfo(products.find((candidate) => candidate.id === item.productId));
      productState.set(item.productId, { id: item.productId, stock: state.stock - item.quantity, costPrice: state.costPrice });
    }
    cart.clear();
    renderCart();
    renderReports();
    elements.cartPanel.classList.remove("open");
    toast(`Transaksi tersimpan · ${money(total)} · ${paymentMethod}`);
  }

  async function exportBackup() {
    const payload = {
      format: "khadika-pos-backup-v1",
      exportedAt: new Date().toISOString(),
      transactions,
      movements,
      expenses,
      productState: Array.from(productState.values())
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `khadika-kasir-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Cadangan data berhasil diunduh.");
  }

  async function restoreBackup(file) {
    let backup;
    try { backup = JSON.parse(await file.text()); }
    catch { return toast("File cadangan tidak dapat dibaca."); }
    const collections = ["transactions", "movements", "expenses", "productState"];
    if (backup?.format !== "khadika-pos-backup-v1" || collections.some((key) => !Array.isArray(backup[key]))) {
      return toast("Format file cadangan tidak sesuai.");
    }
    if (!window.confirm("Pulihkan data ini? Data kasir di perangkat sekarang akan diganti dengan isi file cadangan.")) return;
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(collections, "readwrite");
        collections.forEach((name) => {
          const store = tx.objectStore(name);
          store.clear();
          backup[name].forEach((record) => store.put(record));
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Pemulihan data gagal."));
      });
      transactions = backup.transactions;
      movements = backup.movements;
      expenses = backup.expenses;
      productState = new Map(backup.productState.map((record) => [record.id, record]));
      renderInventory();
      renderProducts();
      renderReports();
      toast("Cadangan data berhasil dipulihkan.");
    } catch (error) { toast(error.message); }
  }

  function setNetworkState() {
    const online = navigator.onLine;
    elements.networkDot.classList.toggle("offline", !online);
    elements.statusText.textContent = online ? "Online" : "Offline · transaksi tetap tersimpan";
  }

  async function initialize() {
    try {
      db = await openDatabase();
      const [savedProducts, savedSales, savedMovements, savedExpenses, settings] = await Promise.all([
        getAll("productState"), getAll("transactions"), getAll("movements"), getAll("expenses"), getAll("settings")
      ]);
      productState = new Map(savedProducts.map((record) => [record.id, record]));
      transactions = savedSales;
      movements = savedMovements;
      expenses = savedExpenses;
      const qrisSetting = settings.find((setting) => setting.key === "qrisImage");
      qrisBlob = qrisSetting?.blob || null;
      openQrImage(qrisBlob);
      if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
      renderCategories();
      renderProducts();
      renderStockSelect();
      renderInventory();
      renderCart();
      renderReports();
    } catch (error) {
      elements.productGrid.innerHTML = `<div class="empty">Penyimpanan kasir tidak dapat dibuka: ${escapeHtml(error.message)}</div>`;
    }
  }

  elements.search.addEventListener("input", renderProducts);
  $("[data-products]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-to-cart]");
    if (button) addToCart(button.dataset.addToCart);
  });
  $("[data-inventory-open]").addEventListener("click", () => { renderInventory(); elements.inventoryDialog.showModal(); });
  $("[data-expense-open]").addEventListener("click", () => elements.expenseDialog.showModal());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $("[data-save-inventory]").addEventListener("click", () => saveInventorySettings().then(() => elements.inventoryDialog.close()).catch((error) => toast(error.message)));
  $("[data-stock-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const product = products.find((item) => item.id === form.elements.productId.value);
    const quantity = Math.floor(Number(form.elements.quantity.value));
    const unitCost = Math.round(Number(form.elements.unitCost.value));
    if (!product || quantity <= 0 || unitCost <= 0) return toast("Isi produk, jumlah, dan harga modal dengan benar.");
    try {
      await storeStockMovement("masuk", product, quantity, unitCost, "Barang masuk");
      form.reset();
      renderStockSelect();
      toast(`Stok ${product.name} bertambah ${quantity}.`);
    } catch (error) { toast(error.message); }
  });
  $("[data-qris-upload]").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Pilih file gambar QRIS.");
    if (file.size > 6 * 1024 * 1024) return toast("Ukuran gambar QRIS maksimal 6 MB.");
    qrisBlob = file;
    await saveSetting({ key: "qrisImage", blob: file, updatedAt: new Date().toISOString() });
    openQrImage(qrisBlob);
    toast("Gambar QRIS tersimpan di perangkat ini.");
  });
  $("[data-expense-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const expense = { id: uid(), date: new Date().toISOString(), dateKey: todayKey(), name: form.elements.name.value.trim(), amount: Math.round(Number(form.elements.amount.value)) };
    if (!expense.name || expense.amount <= 0) return toast("Isi nama dan jumlah pengeluaran.");
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("expenses", "readwrite");
        tx.objectStore("expenses").add(expense);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      expenses.push(expense);
      form.reset();
      elements.expenseDialog.close();
      renderReports();
      toast("Pengeluaran tersimpan.");
    } catch (error) { toast(error.message); }
  });
  $("[data-payment-method]").addEventListener("change", (event) => {
    const method = event.target.value;
    elements.paymentCheck.classList.toggle("hidden", method === "Tunai");
    elements.checkoutQris.classList.toggle("hidden", method !== "QRIS");
    const cashRow = $("[data-cash-row]");
    const cashInput = event.currentTarget.form.elements.cashReceived;
    cashRow.classList.toggle("hidden", method !== "Tunai");
    cashInput.required = method === "Tunai";
    if (method !== "Tunai") cashInput.value = "";
    $("[data-cash-change]").classList.toggle("hidden", method !== "Tunai");
  });
  $("[data-checkout-form]").elements.cashReceived.addEventListener("input", (event) => {
    const received = Math.round(Number(event.target.value) || 0);
    const difference = received - cartTotal();
    $("[data-cash-change]").textContent = difference >= 0 ? `Kembalian: ${money(difference)}` : `Kurang: ${money(Math.abs(difference))}`;
  });
  $("[data-checkout]").addEventListener("click", () => {
    if (!cart.size) return toast("Keranjang masih kosong.");
    $("[data-checkout-total]").textContent = money(cartTotal());
    const form = $("[data-checkout-form]");
    form.reset();
    elements.paymentCheck.classList.add("hidden");
    elements.checkoutQris.classList.add("hidden");
    $("[data-cash-row]").classList.remove("hidden");
    $("[data-cash-change]").classList.remove("hidden");
    form.elements.cashReceived.required = true;
    $("[data-cash-change]").textContent = "Kembalian: Rp0";
    elements.checkoutDialog.showModal();
  });
  $("[data-checkout-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const method = form.elements.paymentMethod.value;
    if (method === "QRIS" && !qrisBlob) return toast("Unggah gambar QRIS melalui menu Stok & modal terlebih dahulu.");
    if (method !== "Tunai" && !form.elements.paymentConfirmed.checked) return toast("Konfirmasi pembayaran setelah mengecek dana diterima.");
    const cashReceived = Math.round(Number(form.elements.cashReceived.value) || 0);
    if (method === "Tunai" && cashReceived < cartTotal()) return toast("Uang yang diterima masih kurang dari total belanja.");
    try {
      await saveSale(method, cashReceived);
      elements.checkoutDialog.close();
      form.reset();
    } catch (error) { toast(error.message); }
  });
  $("[data-cart-clear]").addEventListener("click", () => { cart.clear(); renderCart(); });
  $("[data-cart-open]").addEventListener("click", () => elements.cartPanel.classList.add("open"));
  $("[data-cart-close]").addEventListener("click", () => elements.cartPanel.classList.remove("open"));
  $("[data-backup]").addEventListener("click", exportBackup);
  $("[data-restore]").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) restoreBackup(file);
    event.target.value = "";
  });
  window.addEventListener("online", setNetworkState);
  window.addEventListener("offline", setNetworkState);
  setNetworkState();
  initialize();
})();
