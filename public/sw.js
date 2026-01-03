const CACHE_NAME = 'stajla-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/giris.html',
  '/css/style.css',
  '/js/main.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Yükleme (Install)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Önbellek açıldı');
        return cache.addAll(urlsToCache);
      })
  );
});

// İstekleri Yakalama (Fetch)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Önbellekte varsa onu döndür, yoksa internetten çek
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});