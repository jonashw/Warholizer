// Warholizer service worker: receives photos shared from other apps (Web Share Target) and hands
// them to Composer. Everything else goes to the network as usual.
const SHARED = 'warholizer-shared';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/composer/share') {
    event.respondWith((async () => {
      const form = await event.request.formData();
      const files = form.getAll('photos').filter(f => f instanceof File && f.type.startsWith('image/'));
      const cache = await caches.open(SHARED);
      const stamp = Date.now();
      await Promise.all(files.map((file, i) =>
        cache.put(`/shared/${stamp}-${i}`, new Response(file, { headers: { 'Content-Type': file.type } }))));
      return Response.redirect('/composer?shared=' + files.length, 303);
    })());
  }
});
