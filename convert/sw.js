const CACHE = "baseconv-v1";
const CORE = [
  "./",
  "./index.html",
  "./convert.js",
  "./sw.js"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith("baseconv-") && k !== CACHE) ? caches.delete(k) : 0));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r, { ignoreSearch: true });
    if (hit) return hit;

    try {
      const net = await fetch(r);
      if (net && net.ok) c.put(r, net.clone());
      return net;
    } catch {
      return hit || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
