const CACHE_NAME = 'rich-aroma-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/remesas.html',
    '/js/localforage.min.js',
    '/offline-manager.js',
    '/src/pos/pos.html',
    '/src/kds/kds.html',
    '/src/timeclock/timeclock.html',
    '/src/scheduling/scheduling.html',
    '/src/inventory/inventory.html',
    '/src/kpis/kpis.html',
    '/src/loyalty/loyalty.html',
    '/src/rewards/teacher-portal.html',
    '/src/rewards/load-balance.html',
    '/src/creators/review.html',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install Event - Cache Assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event - Cleanup Old Caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', event => {
    // API calls: Network First, then Offline (if GET)
    if (event.request.url.includes('/api/')) {
        // We generally don't cache API POSTs, only GETs might be useful.
        // But for this offline-first app, we handle data via offline-manager.js logic (IndexedDB).
        // So we just let the fetch fail if offline, and the UI handles it.
        return; 
    }

    // Static Assets: Cache First, then Network
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    // Cache new static assets visited
                    if (event.request.method === 'GET' && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        }).catch(() => {
            // Fallback for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
            }
        })
    );
});
