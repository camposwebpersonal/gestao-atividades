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
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028155431_restrict_group_deletion_by_user_permission.sql'),'utf8');

test('visão geral prioriza captura e links das secretarias',()=>{
 assert.match(modules,/GESTÃO NA PALMA DA MÃO/);
 assert.match(modules,/dashboard-field-focus/);
 assert.match(modules,/secretary-launch-grid/);
 assert.match(modules,/openDemandSecretaria/);
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
});

test('autoria sai do corpo dos cartões e abre em botão informativo',()=>{
 assert.match(authorship,/document\.createElement\('details'\)/);
 assert.match(authorship,/record-audit-popover/);
 assert.match(authorship,/Informações de criação e edição/);
 assert.match(css,/\.record-audit-panel/);
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
