const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync(new URL('../index.html',`file://${__filename}`),'utf8');
const modules=fs.readFileSync(new URL('../js/modulos.js',`file://${__filename}`),'utf8');

test('oferece lista e cards independentes para itens e subitens',()=>{
  assert.match(html,/setActivityRecordView\('\$\{secId\}','items','cards'\)/);
  assert.match(html,/setActivityRecordView\('\$\{secId\}','subitems','cards'\)/);
  assert.match(html,/activity-records[^`]*items-cards[^`]*subitems-cards/);
  assert.match(html,/activity-subitem-collection/);
});

test('salva o padrão por grupo no banco e permite uso temporário',()=>{
  assert.match(html,/const _activityViewOverrides=new Map\(\)/);
  assert.match(html,/items_view_mode:view\.items,subitems_view_mode:view\.subitems/);
  assert.match(html,/Salvar como padrão deste grupo/);
  assert.match(html,/Restaurar padrão/);
  assert.match(html,/id="s-items-view-mode"/);
  assert.match(html,/id="s-subitems-view-mode"/);
  assert.match(modules,/items_view_mode:'list', subitems_view_mode:'list'/);
});

test('cards preservam responsividade e não reduzem a opção de lista',()=>{
  assert.match(html,/\.activity-records\.items-cards\{display:grid/);
  assert.match(html,/@media\(max-width:600px\)[\s\S]*\.activity-records\.items-cards\{grid-template-columns:1fr\}/);
  assert.match(html,/itemsViewMode==='cards'\?'items-cards':'items-list'/);
  assert.match(html,/subitemsViewMode==='cards'\?'subitems-cards':'subitems-list'/);
});
