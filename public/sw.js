const CACHE = 'fastfood-v1';
const PRECACHE = [
  './',
  './index.html',
  './ads.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // deals.json / stores.json은 매일 갱신되는 데이터라 네트워크 우선 → 실패 시 캐시 폴백
  if (url.pathname.endsWith('deals.json') || url.pathname.endsWith('stores.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 그 외(정적 자산)는 캐시 우선 → 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
