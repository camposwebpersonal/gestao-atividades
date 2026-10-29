const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const modules=fs.readFileSync(path.join(root,'js/modulos.js'),'utf8');
const authorship=fs.readFileSync(path.join(root,'js/autoria.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/productivity-redesign.css'),'utf8');
const access=fs.readFileSync(path.join(root,'js/access-scope.js'),'utf8');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028155431_restrict_group_deletion_by_user_permission.sql'),'utf8');
const itemPermissionMigration=fs.readFileSync(path.join(root,'supabase/migrations/20261028195500_restrict_item_and_subitem_mutations_by_user_permission.sql'),'utf8');

test('visão geral prioriza captura e links das secretarias',()=>{
 assert.match(modules,/Gestão na Palma da Mão/);
 assert.match(modules,/dashboard-field-focus/);
 assert.match(modules,/secretary-launch-grid/);
 assert.match(modules,/openDemandSecretaria/);
 assert.match(modules,/dashboard-new-demand/);
 assert.match(modules,/Buscar secretaria/);
 assert.match(modules,/setDashboardSecretaryView/);
 assert.match(modules,/_dashboardIcons/);
 assert.doesNotMatch(modules.slice(modules.lastIndexOf('window.renderModulos=function()')),/Bem-vindo à Central de Gestão|dashboard-kpis|Atividades por área/);
 assert.match(css,/grid-template-columns:repeat\(4/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.doesNotMatch(modules.slice(modules.lastIndexOf('window.renderModulos=function()')),/Criar grupo/);
});

test('exclusão de grupos tem checkbox, verificação de interface e bloqueio no banco',()=>{
 assert.match(index,/id="usr-can-delete-groups"/);
 assert.match(index,/pode_excluir_grupos:document\.getElementById/);
 assert.match(access,/groupDeletionPermission/);
 assert.match(modules,/userCanDeleteGroups/);
 assert.match(migration,/BEFORE DELETE ON public\.atividades/);
 assert.match(migration,/pode_excluir_grupos/);
 assert.match(migration,/SECURITY INVOKER/);
 assert.match(migration,/FROM PUBLIC, anon, authenticated/);
});

test('permissões gerais ficam sempre visíveis antes das permissões por módulo',()=>{
 const general=index.indexOf('${_generalUserPermissions(u)}');
 const modules=index.indexOf('user-form-disclosure user-form-permissions');
 assert.ok(general>0&&modules>general);
 assert.match(index,/user-general-permissions/);
 assert.match(index,/id="usr-can-create-items"/);
 assert.match(index,/id="usr-can-delete-items"/);
 assert.match(index,/pode_criar_itens:document\.getElementById/);
 assert.match(index,/pode_excluir_itens:document\.getElementById/);
 assert.match(access,/itemCreationPermission/);
 assert.match(access,/itemDeletionPermission/);
 assert.match(itemPermissionMigration,/BEFORE INSERT ON public\.items/);
 assert.match(itemPermissionMigration,/BEFORE INSERT ON public\.subitems/);
 assert.match(itemPermissionMigration,/BEFORE DELETE ON public\.items/);
 assert.match(itemPermissionMigration,/BEFORE DELETE ON public\.subitems/);
 assert.match(itemPermissionMigration,/COALESCE\(profile_extra -> 'permissoes' ->> 'pode_criar_itens', 'true'\)/);
 assert.match(compat,/table === 'items' \|\| table === 'subitems'[^\n]*userCanCreateItems/);
 assert.match(compat,/table === 'items' \|\| table === 'subitems'[^\n]*userCanDeleteItems/);
 assert.match(index,/userCanCreateItems[^\n]*openBulkEntry/);
});

test('autoria sai de cards e listas e aparece somente dentro da edição',()=>{
 assert.doesNotMatch(authorship,/record-audit-popover/);
 assert.match(authorship,/attachAuditToEditor/);
 assert.match(authorship,/editor-audit-panel/);
 assert.match(authorship,/Informações do registro/);
 assert.match(css,/\.editor-audit-panel/);
 assert.doesNotMatch(index,/activity-audit-popover/);
});

test('secretaria redundante é ocultada usando o grupo do próprio registro',()=>{
 assert.match(index,/secretaria_id!==_sec\?\.demanda_secretaria_id/);
 assert.doesNotMatch(index,/secretaria_id!==sec\.demanda_secretaria_id/);
});

test('ações principais têm tamanho confortável para toque',()=>{
 assert.match(index,/activity-create-primary/);
 assert.match(modules,/demand-create-primary/);
 assert.match(css,/min-height:48px!important/);
});

test('itens usam cartões premium uniformes e lista horizontal quando há espaço',()=>{
 assert.match(css,/\.activity-records>\.item-row\{background:linear-gradient\(145deg,#fbfefc/);
 assert.match(css,/\.activity-records\.items-cards\{align-items:stretch!important\}/);
 assert.match(css,/\.activity-records\.items-cards>\.item-row\{height:100%/);
 assert.match(css,/\.activity-records\.items-cards>\.item-row>\.item-header\{min-height:82px!important/);
 assert.match(css,/@media\(min-width:1100px\)[\s\S]*\.activity-records\.items-list>\.item-row>\.item-header\{[^}]*flex-wrap:nowrap!important/);
 assert.match(css,/\.activity-records\.items-list>\.item-row>\.item-header>\.item-info\{display:flex!important;align-items:center/);
});
