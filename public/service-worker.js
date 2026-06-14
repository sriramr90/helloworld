// Bright & Early service worker — installable + offline.
// App shell: cache-first.  Edition data: network-first with cache fallback,
// so you always get the freshest paper online and yesterday's when offline.

const VERSION = "bright-and-early-v15";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Edition data: network-first.
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell + everything else: cache-first, then network.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match("/index.html")))
  );
});
