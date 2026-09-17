const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function app(){
 const source=fs.readFileSync(path.join(__dirname,'../js/perfuracao-pocos.js'),'utf8'),writes=[],messages=[];
 const S={isAdmin:true,subitems:[{id:'p',atividade_id:'s',item_id:'d',description:'sítio são josé',responsaveis:'maria',observacao:'muita água',start_date:'2026-09-17',extra_fields:{registro_tipo:'poco',numero:'poço 1',imagens:['https://i.ibb.co/AbCd/photo.jpg'],valor:123.45,contatos_responsavel:[{tipo:'email',valor:'MARIA@EXAMPLE.COM'}]}},{id:'outro',atividade_id:'outra',description:'outro local',extra_fields:{registro_tipo:'poco'}}],items:[{id:'d',atividade_id:'s',description:'joão',observacao:'observação antiga',extra_fields:{registro_tipo:'perfurador',contato:'josé'}}]};
 const ctx={S,URL,Promise,console:{error(){}},localStorage:{getItem:()=>null},document:{getElementById:()=>null},toast:m=>messages.push(m),db:{},doc:(db,col,id)=>({col,id}),updateDoc:async(ref,data)=>writes.push({ref,data})};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const EF='),source.indexOf('  const style=document.createElement')),ctx);return{ctx,S,writes,messages};
}
test('converte cadastros antigos, mantém emails minúsculos e preserva fotos e valores',async()=>{
 const a=app();await a.ctx.migratePocoUppercase('s');assert.equal(a.writes.length,2);const p=a.S.subitems[0];assert.equal(p.observacao,'MUITA ÁGUA');assert.equal(p.description,'SÍTIO SÃO JOSÉ');assert.equal(p.extra_fields.numero,'POÇO 1');assert.equal(p.extra_fields.contatos_responsavel[0].valor,'maria@example.com');assert.equal(p.extra_fields.imagens[0],'https://i.ibb.co/AbCd/photo.jpg');assert.equal(p.extra_fields.valor,123.45);assert.equal(p.start_date,'2026-09-17');assert.equal(p.item_id,'d');assert.equal(a.S.items[0].extra_fields.contato,'JOSÉ');assert.equal(a.S.subitems[1].description,'outro local');
 a.writes.length=0;await a.ctx.migratePocoUppercase('s');assert.equal(a.writes.length,0);
});
test('falhas não simulam gravação e conversão pode ser repetida',async()=>{
 const a=app();a.ctx.updateDoc=async()=>{throw new Error('Falha simulada');};await a.ctx.migratePocoUppercase('s');assert.equal(a.S.subitems[0].observacao,'muita água');assert.equal(a.messages.length,1);
 a.ctx.updateDoc=async(ref,data)=>a.writes.push({ref,data});await a.ctx.migratePocoUppercase('s');assert.equal(a.S.subitems[0].observacao,'MUITA ÁGUA');
});
