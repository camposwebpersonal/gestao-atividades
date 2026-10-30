const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('css/global-search-premium.css','utf8');
const modules=fs.readFileSync('js/modulos.js','utf8');

test('Enter abre página completa e busca também está no menu lateral',()=>{
  assert.match(html,/event\.key==='Enter'.*abrirPaginaBuscaGlobal/s);
  assert.match(html,/class="sidebar-search-launch"/);
  assert.match(html,/search-results-page/);
  assert.match(css,/width:min\(760px/);
  assert.match(css,/@media\(max-width:960px\)/);
});

test('módulos operacionais ficam organizados dentro das secretarias',()=>{
  assert.match(modules,/label:'Secretarias'/);
  assert.match(modules,/DEFESA CIVIL'.*extintores/);
  assert.match(modules,/TRANSPORTES'.*frota/);
  assert.match(modules,/ADMINISTRACAO'.*!\['extintores','frota'\]/);
  assert.match(modules,/Locais de Captação de Água/);
});

test('cabeçalho móvel não deixa ações vazarem para o conteúdo',()=>{
  assert.match(css,/#navbar\{display:flex!important;flex-wrap:nowrap!important;overflow:hidden!important\}/);
  assert.match(css,/sidebar-mobile-session/);
});
