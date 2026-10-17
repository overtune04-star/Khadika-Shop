(() => {
  const productData = window.WARUNG_PRODUCTS ?? [];
  const productGrid = document.querySelector("[data-products]");
  const emptyResults = document.querySelector("[data-empty]");
  const searchInput = document.querySelector("[data-search]");
  const cart = new Map();
  const productCards = new Map();

  const cartCount = document.querySelector("[data-cart-count]");
  const cartItems = document.querySelector("[data-cart-items]");
  const cartTotal = document.querySelector("[data-cart-total]");
  const checkoutButton = document.querySelector("[data-checkout]");
  const cartPanel = document.querySelector("[data-cart-panel]");
  const cartShade = document.querySelector("[data-cart-shade]");
  const toast = document.querySelector("[data-toast]");

  const shopName = document.title.split(" — ")[0];
  const configuredNumber = String(window.WARUNG_CONFIG?.whatsappNumber ?? "").replace(/\D/g, "");
  const whatsappNumber = configuredNumber.startsWith("0")
    ? `62${configuredNumber.slice(1)}`
    : configuredNumber;
  const headerLogoPath = String(window.WARUNG_CONFIG?.headerLogo ?? "").trim();
  const currency = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  });
  let activeCategory = "semua";
  let toastTimer;

  function formatPrice(amount) {
    return currency.format(amount).replace(/\u00a0/g, " ");
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeProductCard(product) {
    const card = createElement("article", "product");
    card.dataset.product = "";
    card.dataset.id = product.id;

    const visual = createElement("div", "product-visual");
    if (product.badge) {
      visual.append(createElement("span", "product-label", product.badge));
    }
    const emoji = createElement("span", "product-emoji", product.emoji);
    emoji.setAttribute("aria-hidden", "true");
    if (product.image) {
      const image = createElement("img", "product-photo");
      image.src = product.image;
      image.alt = product.name;
      image.loading = "lazy";
      image.decoding = "async";
      emoji.hidden = true;
      image.addEventListener("error", () => {
        image.remove();
        emoji.hidden = false;
      }, { once: true });
      visual.append(image);
    }
    visual.append(emoji);

    const content = createElement("div", "product-content");
    content.append(createElement("p", "product-category", product.categoryLabel));
    content.append(createElement("h3", "", product.name));
    content.append(createElement("p", "product-description", product.description));

    const bottom = createElement("div", "product-bottom");
    const price = createElement("span", "price", formatPrice(product.price));
    price.append(createElement("span", "unit", `per ${product.unit}`));

    const addButton = createElement("button", "add-button", "+");
    addButton.type = "button";
    addButton.dataset.add = "";
    addButton.setAttribute("aria-label", `Tambah ${product.name} ke keranjang`);

    bottom.append(price, addButton);
    content.append(bottom);
    card.append(visual, content);
    return card;
  }

  function renderProducts() {
    productData.forEach(product => {
      const card = makeProductCard(product);
      productCards.set(product.id, { product, element: card });
      productGrid.insertBefore(card, emptyResults);
    });
    filterProducts();
  }

  function filterProducts() {
    const term = searchInput.value.trim().toLocaleLowerCase("id");
    let visibleCount = 0;

    productCards.forEach(({ product, element }) => {
      const matchesCategory = activeCategory === "semua" || product.category === activeCategory;
      const searchableText = [product.name, product.categoryLabel, product.description]
        .join(" ")
        .toLocaleLowerCase("id");
      const matchesSearch = searchableText.includes(term);
      const isVisible = matchesCategory && matchesSearch;

      element.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    emptyResults.classList.toggle("visible", visibleCount === 0);
  }

  function setActiveCategory(category) {
    activeCategory = category;

    document.querySelectorAll("[data-filter]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === category));
    });

    filterProducts();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function loadHeaderLogo() {
    if (!headerLogoPath) return;

    const logo = document.querySelector("[data-header-logo]");
    const brandMark = document.querySelector("[data-header-brand] .brand-mark");
    const brandName = document.querySelector("[data-header-brand] .brand-name");

    logo.src = headerLogoPath;
    logo.alt = shopName;
    logo.addEventListener("load", () => {
      logo.hidden = false;
      brandMark.hidden = true;
      brandName.hidden = true;
    }, { once: true });
  }

  function renderCart() {
    const items = [...cart.values()];
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

    cartCount.textContent = itemCount;
    cartTotal.textContent = formatPrice(total);
    checkoutButton.disabled = items.length === 0;
    cartItems.replaceChildren();

    if (items.length === 0) {
      const emptyMessage = createElement("div", "cart-empty");
      const basketIcon = createElement("span", "", "🧺");
      basketIcon.setAttribute("aria-hidden", "true");
      emptyMessage.append(basketIcon, document.createTextNode("Keranjang masih kosong."));
      emptyMessage.append(document.createElement("br"), document.createTextNode("Pilih barang yang kamu perlukan."));
      cartItems.append(emptyMessage);
      return;
    }

    items.forEach(item => cartItems.append(makeCartLine(item)));
  }

  function makeCartLine(item) {
    const { product, quantity } = item;
    const line = createElement("div", "cart-line");
    const emoji = createElement("div", "cart-line-emoji", product.emoji);
    emoji.setAttribute("aria-hidden", "true");

    const details = createElement("div", "");
    details.append(createElement("div", "cart-line-name", product.name));
    details.append(createElement("div", "cart-line-price", `${formatPrice(product.price)} · ${product.unit}`));

    const quantityControls = createElement("div", "quantity");
    quantityControls.append(makeQuantityButton("−", "Kurangi", product.id, -1));
    quantityControls.append(createElement("span", "", String(quantity)));
    quantityControls.append(makeQuantityButton("+", "Tambah", product.id, 1));
    details.append(quantityControls);

    const subtotal = createElement("strong", "cart-line-price", formatPrice(product.price * quantity));
    line.append(emoji, details, subtotal);
    return line;
  }

  function makeQuantityButton(label, action, productId, change) {
    const button = createElement("button", "", label);
    button.type = "button";
    button.dataset.quantity = change;
    button.dataset.id = productId;
    button.setAttribute("aria-label", `${action} ${productCards.get(productId).product.name}`);
    return button;
  }

  function openCart() {
    cartPanel.classList.add("open");
    cartShade.classList.add("open");
    cartPanel.setAttribute("aria-hidden", "false");
    cartPanel.inert = false;
    document.querySelector("[data-close-cart]").focus();
  }

  function closeCart() {
    cartPanel.classList.remove("open");
    cartShade.classList.remove("open");
    cartPanel.setAttribute("aria-hidden", "true");
    cartPanel.inert = true;
    document.querySelector("[data-open-cart]").focus();
  }

  function sendOrderToWhatsApp() {
    const items = [...cart.values()];
    if (items.length === 0) return;
    if (!whatsappNumber) {
      showToast("Isi nomor WhatsApp toko di shop-config.js terlebih dahulu");
      return;
    }

    const orderLines = items.map(({ product, quantity }) =>
      `• ${product.name} (${product.unit}) x${quantity} — ${formatPrice(product.price * quantity)}`
    );
    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const message = [
      `Halo ${shopName}, saya mau pesan:`,
      ...orderLines,
      "",
      `Perkiraan total: ${formatPrice(total)}`,
      "Mohon konfirmasi stok dan harga. Terima kasih."
    ].join("\n");

    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  productGrid.addEventListener("click", event => {
    const addButton = event.target.closest("[data-add]");
    if (!addButton) return;

    const productId = addButton.closest("[data-product]").dataset.id;
    const product = productCards.get(productId).product;
    const currentItem = cart.get(productId);

    if (currentItem) currentItem.quantity += 1;
    else cart.set(productId, { product, quantity: 1 });

    renderCart();
    showToast(`${product.name} ditambahkan`);
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => setActiveCategory(button.dataset.filter));
  });

  document.querySelectorAll("[data-category-link]").forEach(button => {
    button.addEventListener("click", () => {
      searchInput.value = "";
      setActiveCategory(button.dataset.categoryLink);
      document.querySelector("#produk").scrollIntoView({ behavior: "smooth" });
    });
  });

  searchInput.addEventListener("input", filterProducts);
  document.querySelectorAll("[data-open-cart]").forEach(button => button.addEventListener("click", openCart));
  document.querySelector("[data-close-cart]").addEventListener("click", closeCart);
  cartShade.addEventListener("click", closeCart);
  checkoutButton.addEventListener("click", sendOrderToWhatsApp);

  cartItems.addEventListener("click", event => {
    const button = event.target.closest("[data-quantity]");
    if (!button) return;

    const item = cart.get(button.dataset.id);
    if (!item) return;

    item.quantity += Number(button.dataset.quantity);
    if (item.quantity <= 0) cart.delete(button.dataset.id);
    renderCart();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && cartPanel.classList.contains("open")) closeCart();
  });

  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  loadHeaderLogo();
  renderProducts();
  renderCart();
})();
