// sw.js
// Minimal service worker: caches the app shell (+ shows.js) so Faen still
// opens offline, and keeps the cache fresh in the background. No build step
// — this is plain-array precaching, bump CACHE_NAME when you change any of
// these files so clients pick up the new versions.

const CACHE_NAME = "faen-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./analytics.js",
  "./watchlist.js",
  "./settings.js",
  "./shows.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for our own files, with a "stale-while-revalidate" refresh so
// shows.js (and everything else) updates in the background once a network
// connection is available — without ever blocking the offline response.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached); // offline and not cached: nothing we can do

      return cached || networkFetch;
    })
  );
});
