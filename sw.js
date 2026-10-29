const CACHE_NAME = 'gestao-pms-v158';
const STATIC_ASSETS = [
  'index.html',
  'login.html',
  'js/usuario-login.js',
  'js/atendimento-meta.js',
  'js/atendimento-fluxo.js',
  'js/autoria.js',
  'js/offline-store.js',
  'js/image-storage.js',
  'supabase_compat.js',
  'js/search-engine.js',
  'js/bulk-drafts-core.js',
  'js/bulk-entry-core.js',
  'js/bulk-entry.js',
  'js/completed-archive.js',
  'js/custom-fields.js',
  'js/record-context.js',
  'js/access-scope.js',
  'js/demand-report.js',
  'exames.html',
  'manifest.json',
  'bcc_data_junho_2026.json',
  'img/logo_sertania-header.webp',
  'img/logo_sertania-icon-192.png',
  'img/logo_sertania-icon-512.png',
  'js/modulos.js',
  'js/camera-capture.js',
  'js/camera-capture-core.js',
  'js/smart-camera.js',
  'js/geolocation.js',
  'js/demandas-secretarias.js',
  'js/demandas-model.js',
  'css/demandas-secretarias.css',
  'css/demandas-premium.css',
  'css/prefeitura-shell.css',
  'css/module-groups.css',
  'css/access-permissions.css',
  'css/bulk-archive.css',
  'css/trash.css',
  'css/custom-fields.css',
  'css/controle-licitacoes.css',
  'css/record-density.css',
  'css/header-density.css',
  'css/camera-capture.css',
  'css/smart-camera.css',
  'css/productivity-redesign.css',
  'css/geolocation.css',
  'js/perfuracao-pocos.js',
  'js/ordenacao-visual.js',
  'js/controle-contas.js',
  'js/controle-distribuicao.js',
  'js/controle-estoque.js',
  'js/controle-extintores.js',
  'js/controle-licitacoes.js',
  'js/requisicoes-pdf.json',
  'js/requisicoes-licitacao.json',
  'js/requisicoes-contratos.json',
  'https://esm.sh/@supabase/supabase-js@2.49.0?bundle',
  'https://esm.sh/node/buffer.mjs',
  'https://esm.sh/@supabase/supabase-js@2.49.0/es2022/supabase-js.bundle.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
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

self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});

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

  // Imagens atuais e links legados: cache-first para abertura rápida e offline
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

  // Interface: rede primeiro para que F5 receba a publicação nova. A espera é
  // curta; sem resposta, a cópia offline aparece imediatamente.
  if(request.mode === 'navigate' || ['document','script','style','worker','manifest'].includes(request.destination)){
    const network=fetch(request,{cache:'no-store'}).then(response=>{if(response&&response.status===200)putInCache(request,response.clone());return response;});
    const cached=()=>caches.match(request).then(response=>response||(request.mode==='navigate'?caches.match('index.html'):null));
    const offlineCached=()=>cached().then(response=>response||caches.match(request,{ignoreSearch:true}));
    const fastFallback=new Promise(resolve=>setTimeout(()=>cached().then(resolve),1400));
    event.respondWith(Promise.race([network,fastFallback]).then(response=>response||network).catch(err=>offlineCached().then(response=>response||offlineResponse(request,err))));
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
