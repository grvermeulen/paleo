// App-shell service worker — makes the game installable and resilient to flaky
// connections. Realtime data always goes over the network (Supabase).
//
// The cache name is tied to the build id, passed as `?v=<id>` on registration.
// A new deploy changes the script URL, so the browser installs a fresh worker
// and `activate` purges every older cache — no manual version bumps, and no
// stale Next chunks lingering across deploys.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `paleo-${VERSION}`;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navigations: network-first, but race the request against a short timeout so a
// stalled connection on weak coverage falls back to the cached shell within a
// few seconds instead of hanging. The live fetch still refreshes the cache.
async function handleNavigate(request) {
  const network = fetch(request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
    return res;
  });
  const cached = (await caches.match(request)) || (await caches.match("/"));
  if (!cached) {
    try {
      return await network;
    } catch {
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  }
  return Promise.race([
    network.catch(() => cached),
    new Promise((resolve) => setTimeout(() => resolve(cached), 3000)),
  ]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache Supabase / cross-origin API traffic.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
