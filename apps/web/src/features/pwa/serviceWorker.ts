/** Build-time worker template. Only the public application bundle enters its cache. */
export function createWorkerSource(version: string, assets: string[], precache: string[] = assets) {
  return `
const CACHE = ${JSON.stringify(`sol-portal-${version}`)};
const ASSETS = ${JSON.stringify(['/index.html', ...assets.filter(path => path !== '/index.html')])};
const PRECACHE = ${JSON.stringify(['/index.html', ...precache.filter(path => path !== '/index.html')])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_VISITED_ASSETS' && Array.isArray(event.data.paths)) {
    const paths = [...new Set(event.data.paths.filter(path => ASSETS.includes(path)))];
    event.waitUntil(caches.open(CACHE).then(cache => Promise.all(paths.map(async path => {
      if (await cache.match(path)) return;
      try {
        const response = await fetch(path, { cache: 'force-cache', credentials: 'omit' });
        if (response.ok) await cache.put(path, response);
      } catch { /* Reconnect or another visit can cache a missed static asset. */ }
    }))));
  }
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sol-portal-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    // Never store a navigation response: authenticated HTML must not enter Cache Storage.
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) event.waitUntil(cache.put(url.pathname, response.clone()).catch(() => {}));
      return response;
    }));
  }
});
`;
}
