const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function app(){
 const nodes={content:{innerHTML:''},'pw-view':{innerHTML:''}},tables=[],messages=[];
 const well=(id,status,payment)=>({id,atividade_id:'s',item_id:'d',description:id,extra_fields:{registro_tipo:'poco',status_perfuracao:status,status_pagamento:payment}});
 const S={secs:[{id:'s'}],items:[{id:'d',atividade_id:'s',description:'EMPRESA',extra_fields:{registro_tipo:'perfurador'}}],subitems:[well('SOLICITADO','solicitada','pendente'),well('EXECUTADO','executada','pendente'),well('PAGO','executada','pago'),well('ANTIGO',undefined,undefined)]};
 const pdf={lastAutoTable:{finalY:80},autoTable(options){tables.push(options);},save(){}};
 for(const name of ['setFont','setFontSize','setTextColor','setFillColor','setDrawColor','rect','roundedRect','text','addPage'])pdf[name]=()=>{};
 const ctx={S,URL,console,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},document:{createElement:()=>({}),head:{appendChild(){}},getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},toast:(...args)=>messages.push(args),loadB64:async()=>null,jspdf:{jsPDF:function(){return pdf;}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/perfuracao-pocos.js'),'utf8'),ctx);return{ctx,nodes,tables,messages};
}
test('somente executados não pagos contam como pendentes, incluindo registros antigos',()=>{
 const a=app();a.ctx.renderPocos('s');
 assert.match(a.nodes.content.innerHTML,/>2<\/b><span>Aguardando pagamento/);
 const requested=a.nodes.content.innerHTML.match(/<article class="pw-card solicitada"[^>]*>[\s\S]*?<\/article>/)[0];assert.doesNotMatch(requested,/PAGAMENTO PENDENTE|Confirmar pagamento/);
 a.ctx.pocoFilter('status','pendente');assert.doesNotMatch(a.nodes['pw-view'].innerHTML,/pw-local">SOLICITADO|pw-local">PAGO/);assert.match(a.nodes['pw-view'].innerHTML,/pw-local">EXECUTADO/);assert.match(a.nodes['pw-view'].innerHTML,/pw-local">ANTIGO/);
 a.ctx.pocoFilter('status','pago');assert.match(a.nodes['pw-view'].innerHTML,/pw-local">PAGO/);assert.doesNotMatch(a.nodes['pw-view'].innerHTML,/pw-local">EXECUTADO/);
 a.ctx.pocoSetTab('perfuradores');assert.match(a.nodes.content.innerHTML,/>2<\/b>Pendentes/);
});
test('PDF exclui solicitações dos pendentes e preserva o registro na lista',async()=>{
 const a=app();a.ctx.renderPocos('s');await a.ctx.gerarPdfPocos('s',{incluirFotos:false});assert.equal(a.tables.length,2);
 const rows=a.tables[0].body,column=a.tables[0].head[0].indexOf('Pagamento');assert.equal(rows.find(row=>row[1]==='SOLICITADO')[column],'—');assert.equal(rows.find(row=>row[1]==='EXECUTADO')[column],'PENDENTE');assert.equal(rows.find(row=>row[1]==='PAGO')[column],'PAGO');assert.equal(a.tables[1].body[0][3],'2');
});
