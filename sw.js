const CACHE_NAME = 'chronex-v1.1.0';
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
  './assets/icons/icon.svg',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

// Install: Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Chronex SW] Warning caching static assets during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Delete old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('chronex-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate for local assets, cache-first for fonts
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Handle Google Fonts
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open('chronex-fonts').then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }).catch(() => cachedResponse);
        });
      })
    );
    return;
  }

  // Handle local same-origin assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Fallback default network fetch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
