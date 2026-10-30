const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const interfaceSource=fs.readFileSync(path.join(__dirname,'../js/demandas-secretarias.js'),'utf8');
const moduleSource=fs.readFileSync(path.join(__dirname,'../js/modulos.js'),'utf8');
const demandCss=fs.readFileSync(path.join(__dirname,'../css/demandas-secretarias.css'),'utf8');
const premiumCss=fs.readFileSync(path.join(__dirname,'../css/demandas-premium.css'),'utf8');
const model=import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'../js/demandas-model.js'))).toString('base64'));
test('secretarias vazias aparecem, cadastros alheios não; vínculos inválidos ficam a classificar',async()=>{
 const {demandSections}=await model;
 const rows=demandSections([{id:'g',demanda_secretaria_id:'a'},{id:'o',demanda_secretaria_id:'deleted'},{id:'n'}],[{id:'a',name:'Agricultura'},{id:'i',name:'Infraestrutura',demandas_ativa:true},{id:'s',name:'Saúde'}]);
 assert.deepEqual(rows.map(s=>[s.id,s.groups.map(g=>g.id)]),[['a',['g']],['i',[]],['sem-secretaria',['o','n']]]);
});
test('arraste preserva todos os IDs, suporta subir e descer e ignora destinos inválidos',async()=>{
 const {reorderDemand}=await model,ids=['a','b','c','d'];
 assert.deepEqual(reorderDemand(ids,'a','c',true),['b','c','a','d']);
 assert.deepEqual(reorderDemand(ids,'d','b'),['a','d','b','c']);
 assert.deepEqual(reorderDemand(ids,'a','a'),ids);
 assert.deepEqual(reorderDemand(ids,'missing','b'),ids);
 assert.deepEqual(ids,['a','b','c','d']);
});
test('busca encontra nome, assunto e responsável sem depender de acentos',async()=>{
 const {demandMatches}=await model;
 assert.equal(demandMatches({name:'Perfuração de Poços'},'perfuracao'),true);
 assert.equal(demandMatches({name:'Grupo',assunto:'Iluminação'},'ILUMINACAO'),true);
 assert.equal(demandMatches({responsaveis:'João'},'joao'),true);
 assert.equal(demandMatches({name:'Estradas'},'poço'),false);
});
test('visualização principal permite escolha temporária e padrão global persistido nos grupos',()=>{
 assert.match(interfaceSource,/★ Salvar padrão para todos/);
 assert.match(interfaceSource,/for\(const group of all\)await window\.updateDoc[\s\S]*demandas_view_default:mode/);
 assert.match(interfaceSource,/window\.resetDemandView/);
 assert.doesNotMatch(interfaceSource,/localStorage\.setItem\('pms-demandas-view'/);
 assert.match(moduleSource,/base\.demandas_view_default=window\.getDemandViewDefault/);
});
test('lista de grupos usa uma linha fina no notebook e preserva a quebra responsiva',()=>{
 assert.match(demandCss,/@media\(min-width:1100px\)/);
 assert.match(demandCss,/\.demand-row:not\(\.demand-card\)\{[^}]*min-height:44px[^}]*flex-wrap:nowrap/);
 assert.match(demandCss,/@media\(max-width:650px\)/);
});
test('cards e listas premium preservam hierarquia e responsividade',()=>{
 assert.match(interfaceSource,/function visualFor/);
 assert.match(interfaceSource,/demand-symbol tone-/);
 assert.doesNotMatch(interfaceSource,/demand-open-cta/);
 assert.match(interfaceSource,/role="button" tabindex="0" onclick="openActivity/);
 assert.match(interfaceSource,/demand-list-head/);
 assert.match(premiumCss,/\.demand-card\{display:grid/);
 assert.match(premiumCss,/\.demand-list-head,\.demand-list>\.demand-row\{display:grid/);
 assert.match(premiumCss,/@media\(max-width:900px\)/);
 assert.match(premiumCss,/@media\(max-width:680px\)/);
 assert.match(premiumCss,/grid-template-columns:1fr/);
});
