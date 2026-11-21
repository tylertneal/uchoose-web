// Keeps the app's own files on the phone so it opens instantly, even on a weak signal.
// Restaurant searches always go to the network. Bump VERSION whenever app files change.
const VERSION = "uchoose-v2";
const FILES = [
  "./", "index.html", "styles.css", "app.js?v=2", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];
const assetUrl = (path) => new URL(path, self.registration.scope).href;
const ASSETS = new Set(FILES.map(assetUrl));
const PAGES = new Set(["./", "index.html"].map(assetUrl));

self.addEventListener("install", (e) => {
  const requests = [...ASSETS].map((url) => new Request(url, { cache: "reload" }));
  e.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => /^uchoose-v\d+$/.test(key) && key !== VERSION)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function fetchAsset(request, url) {
  const response = await fetch(request).catch(() => null);
  if (!response || response.status >= 500) {
    const cache = await caches.open(VERSION);
    return (await cache.match(url)) || response || Response.error();
  }
  if (request.url === url && response.status === 200 && !response.redirected) {
    await caches.open(VERSION).then((cache) => cache.put(url, response.clone())).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  if (ASSETS.has(request.url)) {
    e.respondWith(fetchAsset(request, request.url));
    return;
  }
  if (request.mode === "navigate") {
    const url = new URL(request.url);
    url.search = "";
    url.hash = "";
    if (PAGES.has(url.href)) e.respondWith(fetchAsset(request, url.href));
  }
});
