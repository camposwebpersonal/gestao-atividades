const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261024090000_central_trash_bin.sql'),'utf8');
const accessMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261025123035_restrict_trash_visibility.sql'),'utf8');

test('exclusão funcional preserva o registro antes de removê-lo da origem',()=>{
  const saveAt=compat.indexOf("await saveRawRow('trash_items', trash)");
  const deleteAt=compat.indexOf('await physicalDelete(docRef)',saveAt);
  assert.ok(saveAt>0&&deleteAt>saveAt);
  assert.match(compat,/record_data:\s*\{\.\.\.row, id:docRef\._id\}/);
  assert.match(compat,/não foi possível preservar uma cópia na lixeira/i);
});

test('lixeira restaura, confirma a exclusão definitiva e organiza conjuntos',()=>{
  assert.match(page,/Lixeira do sistema/);
  assert.match(page,/Restaurar conjunto/);
  assert.match(page,/Esta ação não poderá ser desfeita/);
  assert.match(page,/restoreTrashItem/);
  assert.match(page,/permanentDeleteDoc/);
});

test('tabela da lixeira usa RLS e reserva exclusão permanente ao administrador',()=>{
  assert.match(migration,/alter table public\.trash_items enable row level security/i);
  assert.match(migration,/create policy "trash_insert_own"/i);
  assert.match(migration,/create policy "trash_select_own_or_admin"/i);
  assert.match(migration,/create policy "trash_delete_admin"/i);
  assert.match(migration,/revoke all on table public\.trash_items from anon/i);
});

test('somente perfis marcados visualizam a lixeira e RCAMPOS e micheline começam autorizados',()=>{
  assert.match(accessMigration,/create policy "trash_select_authorized"/i);
  assert.match(accessMigration,/permissoes,pode_ver_lixeira/i);
  assert.match(accessMigration,/in \('rcampos', 'micheline'\)/i);
  assert.doesNotMatch(accessMigration,/deleted_by\s*=\s*\(select auth\.uid/i);
  assert.match(page,/id="usr-can-view-trash"/);
  assert.match(page,/pode_ver_lixeira:document\.getElementById\('usr-can-view-trash'\)/);
  assert.match(page,/S\.canViewTrash=S\.permissoes\.pode_ver_lixeira===true/);
  assert.match(page,/if\(v==='trash'&&!S\.canViewTrash\)/);
});

test('visualização delegada não concede restauração nem exclusão definitiva',()=>{
  assert.match(page,/S\.isAdmin\?\(batchCount>1/);
  assert.match(page,/Somente visualização/);
  assert.match(page,/restoreTrashRecord=async function\(id\)\{if\(!S\.isAdmin\)/);
  assert.match(accessMigration,/create policy "trash_delete_admin"[\s\S]*pode_ver_lixeira[\s\S]*is_admin/i);
});
