/*
 * Study Compass service worker.
 *
 * The planner, FSRS engine, progress tracking, and timetable are local-first
 * (IndexedDB via Dexie), so once the app shell is cached the core product opens
 * with no network. Auth and Convex API calls are intentionally left network-only:
 * they must never be served from a stale cache.
 *
 * Strategy:
 *   - App navigations: network-first, falling back to the cached shell offline.
 *   - Hashed static assets: stale-while-revalidate.
 *   - Everything else (Convex, auth): pass through to the network untouched.
 */

const VERSION = "study-compass-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Full-page loads and refreshes: try the network first so fresh deployments
  // always win, and only reach for the cached shell when the network is gone.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Vite emits fingerprinted files under /assets/ (JS, CSS, images, fonts).
  // Serve them cache-first and refresh the copy in the background.
  if (
    url.pathname.startsWith("/assets/") ||
    /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|webmanifest|css)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const refreshed = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? refreshed;
      }),
    );
  }
});
