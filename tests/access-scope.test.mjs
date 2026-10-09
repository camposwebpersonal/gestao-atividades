import test from 'node:test';
import assert from 'node:assert/strict';
import {modulePermission,groupPermission,demandSecretaryPermission,scopeCount,groupCreationPermission} from '../js/access-scope.js';
import {recordSecretary,secretaryIsFixed} from '../js/record-context.js';

test('cadastros antigos mantêm acesso aos grupos do módulo',()=>{
 const permissions={modulos:{cadastros:{acesso:true,gerenciar:true}}};
 assert.equal(groupPermission(permissions,'cadastros',{id:'correios'},'acesso'),true);
 assert.equal(groupPermission(permissions,'cadastros',{id:'correios'},'editar'),true);
});

test('criação de grupos exige a permissão geral explicitamente marcada',()=>{
 assert.equal(groupCreationPermission({pode_criar_grupos:true}),true);
 assert.equal(groupCreationPermission({pode_criar_grupos:false}),false);
 assert.equal(groupCreationPermission({modulos:{cadastros:{gerenciar:true}}}),false);
});

test('escopo de todos os grupos inclui grupos futuros',()=>{
 const permissions={modulos:{cadastros:{acesso:true,gerenciar:true,escopo_configurado:true,todos_grupos:{acesso:true,gerenciar:true}}}};
 assert.equal(groupPermission(permissions,'cadastros',{id:'grupo-criado-amanha'},'editar'),true);
});

test('secretaria libera seus grupos atuais e futuros sem liberar outra secretaria',()=>{
 const permissions={modulos:{atendimentos:{acesso:true,gerenciar:true,escopo_configurado:true,secretarias:{agricultura:{acesso:true,gerenciar:true}},grupos:{}}}};
 assert.equal(demandSecretaryPermission(permissions,'agricultura','editar'),true);
 assert.equal(groupPermission(permissions,'atendimentos',{id:'pipa',demanda_secretaria_id:'agricultura'},'editar'),true);
 assert.equal(groupPermission(permissions,'atendimentos',{id:'correios',demanda_secretaria_id:'gabinete'},'acesso'),false);
});

test('grupo individual não amplia o acesso para os demais grupos',()=>{
 const permissions={modulos:{atendimentos:{acesso:true,escopo_configurado:true,grupos:{pipa:{acesso:true}},secretarias:{}}}};
 assert.equal(groupPermission(permissions,'atendimentos',{id:'pipa',demanda_secretaria_id:'agricultura'}),true);
 assert.equal(groupPermission(permissions,'atendimentos',{id:'pocos',demanda_secretaria_id:'agricultura'}),false);
 assert.equal(modulePermission(permissions,'atendimentos'),true);
 assert.equal(scopeCount(permissions.modulos.atendimentos),1);
});

test('secretaria do grupo prevalece no item e nos seus descendentes',()=>{
 const group={demanda_secretaria_id:'agricultura'};
 assert.equal(recordSecretary(group,{secretaria_id:'gabinete'},{secretaria_id:'infra'}),'agricultura');
 assert.equal(secretaryIsFixed(group),true);
 assert.equal(recordSecretary({},null,{secretaria_id:'infra'}),'infra');
});
