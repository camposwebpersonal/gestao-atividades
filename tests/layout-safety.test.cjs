const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const modules=fs.readFileSync('js/modulos.js','utf8');
const demands=fs.readFileSync('js/demandas-secretarias.js','utf8');
const css=fs.readFileSync('css/layout-safety.css','utf8');
const agents=fs.readFileSync('AGENTS.md','utf8');
const sw=fs.readFileSync('sw.js','utf8');

test('secretaria abre direto com uma área e oferece seletor quando há várias',()=>{
  assert.match(modules,/if\(destinations\.length===1\)\{destinations\[0\]\.open\(\);return;\}/);
  assert.match(modules,/class="secretary-workspace"/);
  assert.match(modules,/Controle de Demandas/);
  assert.match(modules,/Locais de Captação de Água/);
  assert.match(modules,/class="sidebar-secretary-link/);
  assert.doesNotMatch(modules,/class="sidebar-secretary"/);
});

test('cards de grupos removem ruído e listas mantêm somente quantidade',()=>{
  assert.doesNotMatch(demands,/class="demand-progress/);
  assert.doesNotMatch(demands,/demand-open-cta/);
  assert.match(demands,/mode==='list'.*class="demand-total/s);
  assert.doesNotMatch(demands,/Acompanhamento<\/span>/);
  assert.match(demands,/role="button" tabindex="0" onclick="openActivity/);
});

test('tipografia e badges têm piso legível e proteção contra sobreposição',()=>{
  assert.match(css,/#navmenu :is\(button,summary\)\{font-size:12px/);
  assert.match(css,/small,th,.badge,\[class\*="-meta"\]/);
  assert.match(css,/attendance-urgency.*font-size:11px!important/s);
  assert.match(css,/flex-wrap:wrap!important/);
  assert.match(css,/overflow-wrap:anywhere/);
  assert.match(css,/@media\(max-width:680px\)/);
});

test('regras ficam persistidas e a camada entra no cache offline renovado',()=>{
  assert.match(agents,/Nunca usar texto operacional minúsculo/);
  assert.match(agents,/Nunca aceitar elementos sobrepostos/);
  assert.match(agents,/uma secretaria com apenas Controle de Demandas abre diretamente/);
  assert.match(sw,/gestao-pms-v162/);
  assert.match(sw,/css\/layout-safety\.css/);
});
