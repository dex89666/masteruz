// ============================================
// MasterUz — Service Worker for PWA (v2)
// Улучшенное кэширование с стратегиями
// ============================================

const CACHE_VERSION = 3;
const STATIC_CACHE = `masteruz-static-v${CACHE_VERSION}`;
const API_CACHE = `masteruz-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `masteruz-images-v${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API endpoints that can be cached longer (rarely change)
const LONG_CACHE_API = ['/api/catalog/categories', '/api/catalog/tasks'];
// API that needs fresh data (short TTL)
const SHORT_CACHE_API = ['/api/orders', '/api/users'];

// Install event — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Helper: is API request cacheable?
function isLongCacheApi(pathname) {
  return LONG_CACHE_API.some((prefix) => pathname.startsWith(prefix));
}

// Helper: check if cached response is still fresh
function isCacheFresh(response, maxAgeSeconds) {
  if (!response) return false;
  const dateHeader = response.headers.get('date') || response.headers.get('sw-cache-date');
  if (!dateHeader) return false;
  const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
  return age < maxAgeSeconds;
}

// Fetch event — smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) schemes (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests in development — let Vite proxy handle them
  if (url.hostname === 'localhost' && url.pathname.startsWith('/api/')) return;

  // Image requests — cache-first, long TTL
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // API requests
  if (url.pathname.startsWith('/api/')) {
    // Catalog/categories — stale-while-revalidate (cache 1 hour)
    if (isLongCacheApi(url.pathname)) {
      event.respondWith(
        caches.open(API_CACHE).then(async (cache) => {
          const cached = await cache.match(request);
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              // Add cache timestamp
              const headers = new Headers(response.headers);
              headers.set('sw-cache-date', new Date().toUTCString());
              const cachedResponse = new Response(response.clone().body, {
                status: response.status,
                statusText: response.statusText,
                headers,
              });
              cache.put(request, cachedResponse);
            }
            return response;
          }).catch(() => cached);

          // Return cached if fresh enough, otherwise wait for network
          if (cached && isCacheFresh(cached, 3600)) return cached;
          return fetchPromise;
        })
      );
      return;
    }

    // Other API — network-first with 3-second timeout fallback to cache
    event.respondWith(
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          caches.match(request).then((cached) => {
            if (cached) resolve(cached);
          });
        }, 3000);

        fetch(request).then((response) => {
          clearTimeout(timer);
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          resolve(response);
        }).catch(() => {
          clearTimeout(timer);
          caches.match(request).then((cached) => {
            resolve(cached || new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }));
          });
        });
      })
    );
    return;
  }

  // Static assets — cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Revalidate in background
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
