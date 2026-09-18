// Runtime-caching service worker. Nothing is precached except the manifest
// and icons; every page, RSC payload, and hashed build chunk is cached the
// first time it is fetched, so pages you have opened while online keep working
// offline with the exact assets they were served with. New deploys are picked
// up on the next online navigation because pages are fetched network-first.
const CACHE = "kcal-runtime-v2";
const PRECACHE = ["/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function put(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Hashed build assets never change for a given URL: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }

  // Pages, RSC payloads, and public files: network first, cache as fallback.
  event.respondWith(
    fetch(req)
      .then((res) => put(req, res))
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          // Fall back to any cached page so the shell still opens offline.
          const home = await caches.match("/");
          if (home) return home;
        }
        return Response.error();
      }),
  );
});
