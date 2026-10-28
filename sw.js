// Offline: cache the app shell on install, serve cache-first.
const CACHE = 'dompetku-43765e0c9d';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'core.js', 'receipts.js', 'zip.js', 'inter-latin.woff2', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];

// cache: 'reload' / 'no-cache' skip the browser's HTTP cache (GitHub Pages sends max-age=600): without it a new
// version could be cached with the previous app.js and the app would run mixed files.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache-first, no background refresh: each version's cache is filled once at install, so files of two versions
// never mix. An update ships by changing this file: `node stamp.mjs` sets CACHE to a hash of FILES (test.mjs checks it).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
