const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function restore(route){
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');const code=source.slice(source.indexOf('window.restoreWorkspace=function(){'),source.indexOf('const _renderModuloBase='));const calls=[];
 const ctx={_restoringWorkspace:false,WORKSPACE_ROUTE_KEY:'route',workspaceFromHash:()=>route,S:{secs:[{id:'a'}]},localStorage:{getItem:()=>'{"kind":"module","id":"financeiro"}',removeItem(){}},MODULOS:[{id:'financeiro'}],userCan:()=>true,setView:id=>calls.push(['view',id]),openActivity:id=>calls.push(['activity',id]),renderModulo:id=>calls.push(['module',id]),rememberWorkspace() {}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);assert.equal(ctx.restoreWorkspace(),true);return calls;
}
test('URL principal abre visão geral mesmo com módulo salvo anteriormente',()=>assert.deepEqual(restore(null),[['view','mod']]));
test('links diretos continuam abrindo módulos e atividades',()=>{assert.deepEqual(restore({kind:'module',id:'financeiro'}),[['module','financeiro']]);assert.deepEqual(restore({kind:'activity',id:'a'}),[['activity','a']]);});
