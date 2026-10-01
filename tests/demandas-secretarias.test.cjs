const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
