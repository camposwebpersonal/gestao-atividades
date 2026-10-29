const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const status=fs.readFileSync(path.join(root,'js/supabase-status.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261029200845_supabase_status_dashboard.sql'),'utf8');
const egressMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261029204233_supabase_egress_usage_dashboard.sql'),'utf8');
const usageFunction=fs.readFileSync(path.join(root,'supabase/functions/supabase-usage/handler.js'),'utf8');

test('painel fica em Cadastros e sistema e possui atualização ao vivo',()=>{
  assert.match(html,/id="nav-supabase-status"[^>]+setView\('supabase-status'\)/);
  assert.match(html,/css\/supabase-status\.css\?v=2/);
  assert.match(status,/setInterval\([\s\S]*30000\)/);
  assert.match(status,/supabase\.rpc\('get_supabase_status'\)/);
  assert.match(status,/Última leitura salva no aparelho/);
});

test('gráfico mensal usa métricas oficiais e separa tráfego direto do cache',()=>{
  assert.match(status,/metricValue\(payload,'EGRESS'\)/);
  assert.match(status,/metricValue\(payload,'CACHED_EGRESS'\)/);
  assert.match(status,/EVOLUÇÃO DIÁRIA/);
  assert.match(status,/supabase\.functions\.invoke\('supabase-usage'/);
  assert.match(status,/configureSupabaseUsage/);
  assert.match(usageFunction,/\/usage\/daily/);
  assert.match(usageFunction,/billing\/subscription/);
});

test('credencial administrativa fica no Vault e nunca no cache público',()=>{
  assert.match(egressMigration,/vault\.create_secret/i);
  assert.match(egressMigration,/vault\.update_secret/i);
  assert.match(egressMigration,/revoke all on function public\.get_supabase_management_token_for_runtime\(\) from public, anon, authenticated/i);
  assert.match(egressMigration,/caller_role <> 'service_role'/i);
  assert.doesNotMatch(status,/localStorage\.setItem\([^\n]*management_token/i);
  assert.match(usageFunction,/Somente RCAMPOS pode configurar/);
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
