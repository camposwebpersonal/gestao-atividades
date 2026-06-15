const CACHE_NAME = 'gestao-pms-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/exames.html',
  '/manifest.json',
  '/img/logo_sertania.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(name => { if(name !== CACHE_NAME) return caches.delete(name); }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if(response) return response;
      return fetch(event.request).catch(() => {
        if(event.request.destination === 'document'){
          return caches.match('/index.html');
        }
      });
    })
  );
});
