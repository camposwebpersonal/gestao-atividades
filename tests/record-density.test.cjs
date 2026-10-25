const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'css/record-density.css'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('modo de alta densidade cobre lançamentos, poços, tabelas e celular',()=>{
  for(const selector of ['.item-header','.sub-row','.pw-card-body','.cc-mobile-card','.registry-table td','.lic-grid td'])assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/min-height:0!important/);
  assert.match(page,/css\/record-density\.css\?v=6/);
  assert.match(worker,/css\/record-density\.css/);
});

test('auditoria de concluídos permanece dentro do cartão compacto',()=>{
  const audit=fs.readFileSync(path.join(root,'js/autoria.js'),'utf8');
  assert.match(audit,/host\.classList\.contains\('completed-row'\)/);
  assert.match(css,/attendance-inline-meta>\.record-audit/);
});

test('compactação preserva fontes legíveis e reduz apenas os espaços',()=>{
  const archive=fs.readFileSync(path.join(root,'css/bulk-archive.css'),'utf8');
  assert.match(css,/\.item-name\{[^}]*font-size:13px!important/);
  assert.match(css,/\.item-meta\{[^}]*font-size:10px!important/);
  assert.match(css,/\.item-header\{[^}]*padding:0 5px!important/);
  assert.match(archive,/\.completed-row-main>strong\{font-size:11px/);
  assert.match(archive,/\.completed-row\{[^}]*padding:0 5px/);
});

test('conteúdo quebra linha sem sobreposição ou corte em zoom',()=>{
  const archive=fs.readFileSync(path.join(root,'css/bulk-archive.css'),'utf8');
  const completed=fs.readFileSync(path.join(root,'js/completed-archive.js'),'utf8');
  const audit=fs.readFileSync(path.join(root,'js/autoria.js'),'utf8');
  assert.match(css,/attendance-inline-meta[^}]*flex-wrap:wrap!important/);
  assert.match(css,/record-audit[^}]*white-space:normal!important/);
  assert.match(archive,/completed-row-main[^}]*flex-wrap:wrap/);
  assert.match(archive,/completed-row-main>strong[^}]*overflow-wrap:anywhere/);
  assert.match(completed,/class="completed-row-side"/);
  assert.match(audit,/moveTarget\.insertBefore\(button/);
});

test('cartões eliminam padding vertical sem empilhar responsável e secretaria',()=>{
  const archive=fs.readFileSync(path.join(root,'css/bulk-archive.css'),'utf8');
  assert.match(css,/attendance-compact>\.item-header\{[^}]*padding-block:0!important/);
  assert.match(css,/attendance-compact>\.item-header>\.item-info\{[^}]*display:block!important/);
  assert.match(css,/\.item-meta\{display:inline/);
  assert.match(css,/\.sub-row\{[^}]*padding-top:0!important[^}]*padding-bottom:0!important/);
  assert.match(css,/\.pw-card-head\{[^}]*padding:0 6px!important/);
  assert.match(archive,/\.completed-row\{[^}]*padding:0 5px/);
});
