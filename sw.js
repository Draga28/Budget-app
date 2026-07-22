/* Service worker: gør appen tilgængelig offline.
   Bump CACHE-navnet når filerne ændres, så telefonen henter nyt. */

const CACHE = "davids-budget-v9";

const FILER = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILER)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Netværk først, cache som fallback – så opdateringer slår igennem når der er net.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(svar => {
        const kopi = svar.clone();
        caches.open(CACHE).then(c => c.put(e.request, kopi));
        return svar;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
