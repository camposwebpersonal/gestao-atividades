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
  assert.match(css,/min-height:25px!important/);
  assert.match(page,/css\/record-density\.css\?v=1/);
  assert.match(worker,/css\/record-density\.css/);
});
