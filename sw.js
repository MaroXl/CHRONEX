const CACHE_NAME = 'chronex-v2.5.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/sessions.css',
  './css/countdown.css',
  './css/calendar.css',
  './css/modal.css',
  './js/app.js',
  './js/clock.js',
  './js/sessions.js',
  './js/countdown.js',
  './js/calendar.js',
  './js/storage.js',
  './js/audio.js',
  './js/auth.js',
  './assets/icons/icon.svg',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

// Install: Cache all static assets and activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Chronex SW] Warning caching static assets during install:', err);
      });
    })
  );
});

// Activate: Delete all old caches and take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name.startsWith('chronex-') && name !== 'chronex-fonts')
          .map((name) => {
            console.log('[Chronex SW] Purging obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// 1. Bypass SW completely for dynamic API calls (/api/...)
// 2. Network-First for local same-origin assets (fetches fresh copy; falls back to cache when offline)
// 3. Cache-First for external Google Fonts
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass SW for API endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle Google Fonts (Cache-First)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open('chronex-fonts').then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
        });
      })
    );
    return;
  }

  // Handle local same-origin assets (Network-First with Cache Fallback)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html') || caches.match('/');
            }
            return new Response('Network offline and asset not cached', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  // Fallback default network fetch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
