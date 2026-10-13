// Network-first χωρίς HTTP cache για τη σελίδα, ώστε οι ενημερώσεις να φαίνονται αμέσως
const C = 'pss-v5'
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

// Ειδοποιήσεις push
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Patras Schools Soccer', body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'Patras Schools Soccer', {
    body: d.body || '', icon: 'brand/icon-192.png', badge: 'brand/favicon.png', tag: d.tag || undefined, data: { url: d.url || './' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || './'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus() } }
    return self.clients.openWindow(url)
  }))
})
