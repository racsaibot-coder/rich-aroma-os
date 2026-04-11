const CACHE_NAME = 'rich-aroma-order-v1';
const ASSETS = [
    '/order',
    '/order-manifest.json',
    '/rico-logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('/api/')) return;
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
