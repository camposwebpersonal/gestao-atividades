const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const status=fs.readFileSync(path.join(root,'js/supabase-status.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261029200845_supabase_status_dashboard.sql'),'utf8');

test('painel fica em Cadastros e sistema e possui atualização ao vivo',()=>{
  assert.match(html,/id="nav-supabase-status"[^>]+setView\('supabase-status'\)/);
  assert.match(html,/css\/supabase-status\.css\?v=1/);
  assert.match(status,/setInterval\([\s\S]*30000\)/);
  assert.match(status,/supabase\.rpc\('get_supabase_status'\)/);
  assert.match(status,/Última leitura salva no aparelho/);
});

test('permissão aparece entre os controles gerais e é independente de administrador',()=>{
  assert.match(html,/id="usr-can-view-supabase-status"/);
  assert.match(html,/Visualizar status do Supabase/);
  assert.match(html,/_saveSupabaseStatusPermission/);
  assert.doesNotMatch(status,/isAdmin/);
});

test('acesso é protegido no banco e RCAMPOS continua proprietário permanente',()=>{
  assert.match(migration,/alter table public\.supabase_status_access enable row level security/i);
  assert.match(migration,/camposweb\.personal@gmail\.com/i);
  assert.match(migration,/revoke all on function public\.get_supabase_status\(\) from public, anon/i);
  assert.match(migration,/Seu usuário não possui permissão/i);
  assert.match(migration,/pg_database_size\(current_database\(\)\)/i);
  assert.match(migration,/storage\.objects/i);
});

test('camada de compatibilidade conhece a tabela de autorização',()=>{
  assert.match(compat,/'supabaseStatusAccess': 'supabase_status_access'/);
  assert.match(compat,/'supabase_status_access'/);
});

