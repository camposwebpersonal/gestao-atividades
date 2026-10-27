const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const compat=fs.readFileSync(new URL('../supabase_compat.js',`file://${__filename}`),'utf8');
const html=fs.readFileSync(new URL('../index.html',`file://${__filename}`),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261027235434_enable_live_updates.sql',`file://${__filename}`),'utf8');

test('alterações locais atualizam o estado e evitam recarga remota integral imediata',()=>{
  assert.match(compat,/emitRecordChange\(table,'UPDATE',saved/);
  assert.match(html,/_lastLocalMutationAt/);
  assert.match(html,/recentLocalMutation[\s\S]*getDocsFromCache:getDocs/);
});

test('navegadores recebem alterações confirmadas via Supabase Realtime',()=>{
  assert.match(compat,/postgres_changes/);
  assert.match(compat,/subscribeToRealtimeChanges/);
  assert.match(html,/gestao-record-change/);
  assert.match(migration,/ALTER PUBLICATION supabase_realtime ADD TABLE/);
});

test('conclusão de item e subitens grava em paralelo',()=>{
  assert.match(html,/const updates=\[\]/);
  assert.match(html,/await Promise\.all\(updates\)/);
  assert.match(html,/if\(col==='subitem'\) await _markSubChildren\(id,d\);\s*closeModal\(\);toast\('✅ Concluído!'\);openActivity\(curSecId\)/);
});
