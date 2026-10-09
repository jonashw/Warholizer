// Warholizer service worker:
// 1. Receives photos shared from other apps (Web Share Target) and hands them to Composer.
// 2. Keeps the app working offline: pages network-first (falling back to the cached app),
//    built assets cache-first (their names change with every build), other static files
//    stale-while-revalidate. The API is never cached.
const SHARED = 'warholizer-shared';
const APP = 'warholizer-app-v1';
const PRECACHE = ['/index.html', '/manifest.json', '/android-icon-192x192.png', '/android-icon-512x512.png', '/warhol.jpg', '/banana.jpg', '/soup-can.jpg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP).then(cache => cache.addAll(PRECACHE)).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== APP && name !== SHARED) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

const networkFirstPage = async request => {
  const cache = await caches.open(APP);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('/index.html')) ?? Response.error();
  }
};

const cacheFirst = async request => {
  const cache = await caches.open(APP);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

const staleWhileRevalidate = async (request, event) => {
  const cache = await caches.open(APP);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return (await fresh) ?? Response.error();
};

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/composer/share') {
    event.respondWith((async () => {
      const form = await request.formData();
      const files = form.getAll('photos').filter(f => f instanceof File && f.type.startsWith('image/'));
      const cache = await caches.open(SHARED);
      const stamp = Date.now();
      await Promise.all(files.map((file, i) =>
        cache.put(`/shared/${stamp}-${i}`, new Response(file, { headers: { 'Content-Type': file.type } }))));
      return Response.redirect('/composer?shared=' + files.length, 303);
    })());
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Shared links (/c/…) carry per-composition preview tags from a function: always from the network when possible.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (/\.(png|jpe?g|svg|ico|json|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
