/*
 * Study Compass offline cache.
 *
 * The production build is a single self-contained index.html, so this worker
 * only needs to precache that shell plus the favicon. All planner data, FSRS
 * cards, and progress live in IndexedDB (via Dexie) and need no network.
 *
 * URLs are resolved relative to the worker's scope so the same build works
 * from a domain root or a GitHub Pages project site at
 * https://<user>.github.io/<repo>/.
 */

const VERSION = "study-compass-v4";
const CACHE = `${VERSION}`;
const PRECACHE_URLS = ["./", "./logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: cache-first so the app opens offline, refreshed in the
  // background whenever a connection is available.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("./").then((cached) => {
        const refreshed = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put("./", copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? refreshed;
      }),
    );
    return;
  }

  // Any other same-origin asset (the favicon today): cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refreshed = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? refreshed;
    }),
  );
});
