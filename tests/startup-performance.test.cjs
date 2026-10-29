const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('logomarca visível usa ativo leve, prioritário e dimensionalmente estável',()=>{
  const source='img/logo_sertania-header.webp';
  assert.ok(fs.statSync(path.join(root,source)).size<10_000,'o logo do cabeçalho deve ter menos de 10 KB');
  assert.match(html,new RegExp(`<link rel="preload" href="${source}"[^>]*fetchpriority="high"`));
  assert.match(html,new RegExp(`<img src="${source}" width="160" height="112" fetchpriority="high" decoding="sync"`));
  assert.match(sw,/logo_sertania-header\.webp/);
});

test('recursos secundários não bloqueiam a primeira pintura',()=>{
  assert.match(html,/script defer src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf/);
  assert.match(html,/leaflet\.css[^>]*media="print"[^>]*onload="this\.media='all'"/);
  assert.match(html,/rel="modulepreload" href="supabase_compat\.js\?v=7"/);
  assert.match(html,/const cacheDataPromise=loadData\(\{cacheOnly:true\}\);[\s\S]*const cacheReady=await cacheDataPromise/);
});

test('manifesto usa ícones realmente dimensionados e cache renovado',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
  assert.match(sw,/gestao-pms-v155/);
  assert.doesNotMatch(sw,/^\s*'img\/logo_sertania\.png',/m);
});
