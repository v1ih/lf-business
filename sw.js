// Service worker: deixa o app funcionar offline.
// Estratégia "network first": com internet, busca sempre a versão mais nova
// (assim as atualizações chegam sozinhas); sem internet, usa a cópia do cache.
const CACHE = "lf-business-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./js/app.js",
  "./js/lib.js",
  "./js/store.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((hit) => hit || (request.mode === "navigate" ? caches.match("./") : undefined))
          .then((hit) => hit || Response.error()),
      ),
  );
});
