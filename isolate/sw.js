/*
 * Study Compass service worker.
 *
 * The entire product is local-first: the planner, FSRS engine, progress
 * tracking, and timetable live in IndexedDB (via Dexie), and there is no
 * backend or API. So once the app shell is cached, Study Compass opens and
 * runs with no network at all.
 *
 * Strategy:
 *   - App navigations: cache-first, so a previously visited install opens
 *     instantly offline; the cached shell is refreshed in the background
 *     whenever a network connection is available.
 *   - Hashed static assets (/assets/*, fonts, images, css, manifest):
 *     stale-while-revalidate.
 */

const VERSION = "study-compass-v2";
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

  // Full-page loads and refreshes: serve the cached shell first so the app
  // opens offline, and refresh that copy in the background when possible.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => {
        const refresh = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? refresh;
      }),
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
