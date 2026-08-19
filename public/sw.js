/*
 * Study Compass service worker.
 *
 * The entire product is local-first: the planner, FSRS engine, progress
 * tracking, and timetable live in IndexedDB (via Dexie), and there is no
 * backend or API. So once the app shell is cached, Study Compass opens and
 * runs with no network at all.
 *
 * Everything is resolved relative to the service worker's scope (rather than
 * hardcoded to "/") so the same build works from a domain root, a custom
 * domain, or a GitHub Pages project site at https://<user>.github.io/<repo>/.
 *
 * Strategy:
 *   - App navigations: cache-first, so a previously visited install opens
 *     instantly offline; the cached shell is refreshed in the background
 *     whenever a network connection is available.
 *   - Hashed static assets (assets/, fonts, images, css, manifest):
 *     stale-while-revalidate.
 */

const VERSION = "study-compass-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// The service worker's scope ends in "/" and points at the app root, e.g.
// "https://user.github.io/repo/". Relative URLs below resolve against the SW
// script URL, so "./" is that same app root.
const scopePath = new URL(self.registration.scope).pathname;
const APP_SHELL = "./";
const PRECACHE_URLS = [APP_SHELL, "./manifest.webmanifest", "./logo.svg"];

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
      caches.match(APP_SHELL).then((cached) => {
        const refresh = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? refresh;
      }),
    );
    return;
  }

  // Vite emits fingerprinted files under assets/ (JS, CSS, images, fonts).
  // Serve them cache-first and refresh the copy in the background.
  if (
    url.pathname.startsWith(`${scopePath}assets/`) ||
    /\.(?:svg|png|jpe?g|webp|gif|ico|woff2?|webmanifest|css|js)$/.test(url.pathname)
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
