const CACHE_NAME = 'gestao-pms-v59';
const STATIC_ASSETS = [
  'index.html',
  'login.html',
  'exames.html',
  'manifest.json',
  'bcc_data_junho_2026.json',
  'img/logo_sertania.png',
  'js/modulos.js',
  'css/prefeitura-shell.css',
  'js/perfuracao-pocos.js',
  'js/controle-contas.js',
  'js/controle-distribuicao.js',
  'js/controle-estoque.js',
  'js/requisicoes-pdf.json',
  'js/requisicoes-licitacao.json',
  'js/requisicoes-contratos.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for(const url of STATIC_ASSETS){
        try{
          await cache.add(url);
        }catch(err){
          console.warn('[SW] Falha ao cachear:',url,err);
        }
      }
    })
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

// Falha de rede sem cópia em cache: responde com erro descritível em vez de
// deixar o fetch estourar sem diagnóstico.
function offlineResponse(request, err) {
  console.warn('[SW] Sem rede e sem cache para:', request.url, err);
  return new Response('Recurso indisponível offline: ' + request.url, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

function putInCache(request, response) {
  return caches.open(CACHE_NAME)
    .then(cache => cache.put(request, response))
    .catch(err => console.warn('[SW] Falha ao gravar no cache:', request.url, err));
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);

  // Firebase Firestore/API e Supabase: network-first, sem cache
  if(url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('supabase.co')){
    event.respondWith(
      fetch(request).then(response => {
        if(response && response.status === 200 && !url.hostname.includes('supabase.co')){
          putInCache(request, response.clone());
        }
        return response;
      }).catch(err => caches.match(request).then(cached => cached || offlineResponse(request, err)))
    );
    return;
  }

  // Dashboard de investimentos: rede primeiro para exibir alterações imediatamente
  if(url.pathname.includes('/investimento-dashboard/') && request.destination === 'document'){
    event.respondWith(
      fetch(request).then(response => {
        if(response && response.status === 200) putInCache(request, response.clone());
        return response;
      }).catch(err => caches.match(request).then(cached => cached || offlineResponse(request, err)))
    );
    return;
  }

  // ImgBB / imagens: cache-first
  if(url.hostname.includes('imgbb.com') || url.hostname.includes('i.ibb.co') || request.destination === 'image'){
    event.respondWith(
      caches.match(request).then(cached => {
        if(cached) return cached;
        return fetch(request).then(response => {
          if(response && response.status === 200){
            putInCache(request, response.clone());
          }
          return response;
        }).catch(err => offlineResponse(request, err));
      })
    );
    return;
  }

  // Páginas, scripts e estilos: rede primeiro. Assim, puxar para atualizar
  // sempre procura a versão recém-publicada e o cache continua como fallback offline.
  if(request.mode === 'navigate' || ['document','script','style','worker','manifest'].includes(request.destination)){
    event.respondWith(
      fetch(request).then(networkResponse => {
        if(networkResponse && networkResponse.status === 200){
          putInCache(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(err => caches.match(request).then(cached => {
        if(cached)return cached;
        if(request.destination === 'document')return caches.match('index.html').then(index => index || offlineResponse(request, err));
        return offlineResponse(request, err);
      }))
    );
    return;
  }

  // Demais recursos estáticos: cache-first
  event.respondWith(
    caches.match(request).then(response => {
      if(response) return response;
      return fetch(request).then(networkResponse => {
        if(networkResponse && networkResponse.status === 200){
          putInCache(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(err => {
        if(request.destination === 'document'){
          return caches.match('index.html').then(cached => cached || offlineResponse(request, err));
        }
        return offlineResponse(request, err);
      });
    })
  );
});
