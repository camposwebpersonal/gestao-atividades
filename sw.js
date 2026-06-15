const CACHE_NAME = 'gestao-pms-v2';
const STATIC_ASSETS = [
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
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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
  const {request} = event;
  const url = new URL(request.url);

  // Firebase Firestore/API: network-first
  if(url.hostname.includes('googleapis.com') || url.hostname.includes('firebase')){
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // ImgBB / imagens: cache-first
  if(url.hostname.includes('imgbb.com') || url.hostname.includes('i.ibb.co') || request.destination === 'image'){
    event.respondWith(
      caches.match(request).then(cached => {
        if(cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Páginas e assets estáticos: cache-first
  event.respondWith(
    caches.match(request).then(response => {
      if(response) return response;
      return fetch(request).then(networkResponse => {
        if(networkResponse && networkResponse.status === 200){
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if(request.destination === 'document'){
          return caches.match('/index.html');
        }
      });
    })
  );
});
