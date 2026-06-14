// Kill-switch service worker.
// Non cachea mai: rimuove cache/registrazione legacy e *chiede* ai client di
// fare cache-busting tramite postMessage (così il client può rispettare il
// flag `__lovableFormDirty` ed evitare di buttare via form aperti).
const cleanup = async () => {
  try {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(
      clients.map((client) => {
        try {
          const url = new URL(client.url);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          url.searchParams.set("__v", Date.now().toString());
          // Non navighiamo direttamente: lasciamo decidere al client quando
          // è sicuro ricaricare (vedi src/lib/swCleanupListener.ts).
          client.postMessage({ type: "CBNET_SW_NAV", url: url.toString() });
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      })
    );
    await self.registration.unregister();
  } catch {
    // best effort
  }
};

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(cleanup()));
self.addEventListener("message", (event) => {
  if (event.data === "CBNET_SW_CLEANUP") event.waitUntil(cleanup());
});
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request, { cache: "no-store" }));
});
