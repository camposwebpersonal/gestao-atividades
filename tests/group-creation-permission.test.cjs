const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const modules=fs.readFileSync(path.join(root,'js/modulos.js'),'utf8');
const demands=fs.readFileSync(path.join(root,'js/demandas-secretarias.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261009181200_restrict_group_creation_by_user_permission.sql'),'utf8');

test('cadastro administrativo salva a opção separada de criar grupos',()=>{
 assert.match(index,/id="usr-can-create-groups"/);
 assert.match(index,/pode_criar_grupos:document\.getElementById\('usr-can-create-groups'\)/);
 assert.match(index,/Desmarcado: pode alimentar e editar lançamentos/);
});

test('todas as entradas principais de criação consultam a permissão geral',()=>{
 assert.match(index,/!id&&!S\.isAdmin&&!window\.userCanCreateGroups/);
 assert.match(modules,/if\(!window\.userCanCreateGroups\(\)\)/);
 assert.match(demands,/const create=window\.userCanCreateGroups/);
 assert.match(demands,/window\.newDemandGroup[\s\S]*!window\.userCanCreateGroups/);
});

test('banco bloqueia criação de grupo e autoatribuição de permissão',()=>{
 assert.match(migration,/BEFORE INSERT ON public\.atividades/);
 assert.match(migration,/pode_criar_grupos/);
 assert.match(migration,/BEFORE INSERT OR UPDATE OR DELETE ON public\.users/);
 assert.match(migration,/Apenas administradores podem alterar usuários e permissões/);
});
