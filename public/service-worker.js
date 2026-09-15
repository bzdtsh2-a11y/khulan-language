const cacheName = "khulan-language-v20";
const coreFiles = ["/","/index.html","/styles.css?v=11","/topik.css?v=2","/topik-ch02.css?v=1","/topik-utils.js?v=2","/topik.js?v=4","/topik-ch02.js?v=1","/app.js?v=17","/lessons/hangul-foundation.html?v=17","/lessons/hangul-review-source.html?v=17","/data/lessons.js","/data/korean-pdf-additions.js?v=1","/data/korean-curriculum.js?v=4","/data/korean-master.js?v=6","/data/korean-legal-vocabulary.js?v=1","/data/korean-grammar-explained.js?v=7","/manifest.webmanifest","/vendor/lucide.js","/app-icon-192.png","/app-icon-512.png"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(coreFiles))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith("/api/")) return;
  const networkRequest = new Request(event.request, { cache:"no-store" });
  event.respondWith(
    fetch(networkRequest).then((response) => {
      if (response.ok && requestUrl.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html") || caches.match("/")))
  );
});
