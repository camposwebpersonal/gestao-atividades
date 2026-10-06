import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../supabase/migrations/20261006180027_transfer_groups_and_content.sql',import.meta.url),'utf8');
const modules=fs.readFileSync(new URL('../js/modulos.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../css/module-groups.css',import.meta.url),'utf8');

test('transferência integral é atômica, administrativa e preserva o histórico dos filhos',()=>{
  assert.match(migration,/SECURITY INVOKER/i);
  assert.match(migration,/profile\.role='admin' OR profile\.is_admin IS TRUE/);
  assert.match(migration,/REVOKE ALL[\s\S]+FROM PUBLIC,anon/i);
  assert.match(migration,/operation='content'/);
  assert.match(migration,/operation='group'/);
  assert.match(migration,/set_config\('pms\.audit_override','on',true\)/);
  assert.match(migration,/UPDATE public\.subitems[\s\S]+SET atividade_id=target_group/);
  assert.doesNotMatch(migration,/DELETE FROM public\.(items|subitems)/i);
});

test('lista compacta oferece os dois tipos de transferência somente ao administrador',()=>{
  assert.match(modules,/class="module-group-row"/);
  assert.match(modules,/Apenas os lançamentos/);
  assert.match(modules,/Grupo completo/);
  assert.match(modules,/admin\?`<button[^`]+openModuleGroupTransfer/);
  assert.match(modules,/transfer_group_content_admin/);
  assert.match(css,/\.module-group-row\{[^}]*min-height:64px/);
});
