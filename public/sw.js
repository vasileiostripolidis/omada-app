// Network-first χωρίς HTTP cache για τη σελίδα, ώστε οι ενημερώσεις να φαίνονται αμέσως
const C = 'pss-v3'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin) return
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')
  e.respondWith(fetch(isPage ? new Request(e.request, { cache: 'no-store' }) : e.request)
    .then((r) => { if (r.ok) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)) } return r })
    .catch(() => caches.match(e.request)))
})
