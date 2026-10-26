const CACHE_NAME = "khadika-admin-v2";
const APP_SHELL = [
  "./admin.html",
  "./admin.js?v=20261026-pwa",
  "./admin-pwa.js?v=20261026-pwa",
  "./kasir.html",
  "./kasir.js?v=20261026-pos",
  "./products.js",
  "./manifest.webmanifest",
  "./manifest-kasir.webmanifest",
  "./images/admin-icon-192.png",
  "./images/admin-icon-512.png",
  "./images/beras-lahap-lele.jpg",
  "./images/gulaku.jpg",
  "./images/tropical1.webp",
  "./images/giv800.jpg",
  "./images/zinc680.jpg",
  "./images/sosoft360.jpg",
  "./images/kapalapisc.jpeg",
  "./images/daia150.jpg",
  "./images/rinso144.jpg",
  "./images/wipol720.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("khadika-admin-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") return caches.match("./admin.html");
      return Response.error();
    })
  );
});
