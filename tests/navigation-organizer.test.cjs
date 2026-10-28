const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const modules=fs.readFileSync(path.join(root,'js/modulos.js'),'utf8');
const demands=fs.readFileSync(path.join(root,'js/demandas-secretarias.js'),'utf8');
const model=fs.readFileSync(path.join(root,'js/demandas-model.js'),'utf8');
const compat=fs.readFileSync(path.join(root,'supabase_compat.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028173000_navigation_settings.sql'),'utf8');

test('administrador encontra organizador no próprio menu lateral',()=>{
 assert.match(index,/id="sidebar-organize"/);
 assert.match(index,/openMenuOrganizer\(\)/);
 assert.match(index,/menuButton\.hidden=!S\.isAdmin/);
});

test('organizador permite renomear, reordenar e remover sem apagar dados',()=>{
 assert.match(modules,/Nome exibido no menu/);
 assert.match(modules,/menuOrganizerMove/);
 assert.match(modules,/toggleMenuOrganizerVisibility/);
 assert.match(modules,/remover uma área daqui apenas a oculta do menu/);
 assert.match(modules,/value:\{modules\}/);
 assert.match(modules,/visibleSystemModules/);
 assert.match(modules,/stepModuleGroup/);
 assert.match(modules,/confirmarExcluirAtividade/);
});

test('configuração do menu é global, persistente e gravável apenas por administrador',()=>{
 assert.match(compat,/'appSettings': 'app_settings'/);
 assert.match(index,/safeGet\('appSettings'/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/app_settings_read_authenticated/);
 assert.match(migration,/app_settings_write_admin/);
 assert.match(migration,/profile\.role = 'admin' OR profile\.is_admin IS TRUE/);
 assert.match(migration,/REVOKE ALL ON TABLE public\.app_settings FROM PUBLIC, anon/);
});

test('demandas órfãs ficam identificadas e têm exclusão direta ou em lote',()=>{
 assert.match(model,/Demandas sem secretaria/);
 assert.match(demands,/demand-delete-direct/);
 assert.match(demands,/confirmarExcluirAtividade/);
 assert.match(demands,/deleteUnassignedDemands/);
 assert.match(demands,/Excluir todas/);
});
