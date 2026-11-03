const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const compat=fs.readFileSync('supabase_compat.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/20261103093000_incremental_sync_at.sql','utf8');

test('leitura de tabela inteira usa sincronização incremental com volta para carga completa',()=>{
  assert.match(compat,/async function incrementalTableLoad\(table, constraints\)/);
  assert.match(compat,/incrementalTableLoad\(table, constraints\)\.catch/);
  assert.match(compat,/\|\| \(await fullTableLoad\(table, constraints\)\)/);
  assert.match(compat,/select\('id', \{ count: 'exact', head: true \}\)/);
});

test('usa sync_at quando existir e updated_at do servidor só nas tabelas com gatilho',()=>{
  assert.match(compat,/SERVER_UPDATED_AT_TABLES = new Set\(\[\s*'atividades','items','subitems'/);
  assert.match(compat,/if \(sample && 'sync_at' in sample\) return 'sync_at'/);
  assert.match(compat,/time <= limit/); // ignora datas futuras
});

test('a coluna interna sync_at nunca chega à aplicação nem é enviada nas gravações',()=>{
  assert.match(compat,/delete row\.sync_at;/);
  assert.match(compat,/'audit_updated_at','sync_at'\]\) delete payload\[key\]/);
});

test('lixeira só vem do servidor ao ser aberta e pré-carga offline é limitada',()=>{
  assert.match(html,/safeGet\('trashItems',\(\)=>getDocsFromCache\(/);
  assert.match(html,/_renderTrashBase/);
  assert.match(html,/gestao-offline-prefetch:/);
  assert.match(html,/6\*3600\*1000/);
});

test('migração cria sync_at com gatilho sempre ativo e índice',()=>{
  assert.match(migration,/new\.sync_at := clock_timestamp\(\)/);
  assert.match(migration,/before insert or update/);
  assert.match(migration,/_sync_at_idx/);
});
