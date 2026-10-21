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

test('opções do PDF oferecem filtro de pagamento e checkbox para cada perfuração',()=>{
 const a=app();a.ctx.renderPocos('s');let modal='';a.ctx.openModal=(title,description,html)=>{modal=title+' '+description+' '+html;};a.ctx.openPocoPdfOptions();
 assert.match(modal,/Somente pagamentos pendentes/);assert.match(modal,/Somente pagamentos realizados/);assert.match(modal,/Solicitações sem pagamento aplicável/);assert.match(modal,/Selecionar exibidas/);assert.equal((modal.match(/data-pw-pdf-well/g)||[]).length,4);assert.match(modal,/POÇO 1/);assert.match(modal,/PAGAMENTO PENDENTE/);
});

test('PDF contém somente as perfurações marcadas, independentemente do filtro da tela',async()=>{
 const a=app();a.ctx.renderPocos('s');a.ctx.pocoFilter('status','pago');await a.ctx.gerarPdfPocos(null,{incluirFotos:false,wellIds:['EXECUTADO','PAGO']});
 assert.equal(a.tables.length,2);const descriptions=Array.from(a.tables[0].body,row=>row[1]);assert.deepEqual(descriptions.sort(),['EXECUTADO','PAGO']);assert.equal(descriptions.includes('SOLICITADO'),false);assert.equal(descriptions.includes('ANTIGO'),false);
});

test('confirmação exige seleção e envia exatamente os IDs marcados',()=>{
 const a=app();a.ctx.renderPocos('s');a.nodes['pw-pdf-photos']={checked:false};const selected=[{value:'EXECUTADO'},{value:'PAGO'}];a.ctx.document.querySelectorAll=selector=>selector==='[data-pw-pdf-well]:checked'?selected:[];let options=null,closed=false;a.ctx.gerarPdfPocos=(sec,value)=>{options=value;};a.ctx.closeModal=()=>{closed=true;};a.ctx.confirmarPdfPocos();assert.equal(closed,true);assert.deepEqual(Array.from(options.wellIds),['EXECUTADO','PAGO']);assert.equal(options.incluirFotos,false);
 selected.length=0;closed=false;a.ctx.confirmarPdfPocos();assert.equal(closed,false);assert.match(a.messages.at(-1)[0],/Selecione pelo menos uma/);
});

test('filtro pendente exibe e marca apenas pagamentos realmente pendentes',()=>{
 const a=app(),statuses=['solicitada','pendente','pago','pendente'],boxes=statuses.map((status,index)=>({value:String(index),checked:true,status})),rows=statuses.map((status,index)=>({dataset:{pwPdfStatus:status},hidden:false,querySelector:()=>boxes[index]}));a.nodes['pw-pdf-count']={textContent:''};a.ctx.document.querySelectorAll=selector=>selector==='[data-pw-pdf-row]'?rows:selector==='[data-pw-pdf-well]'?boxes:selector==='[data-pw-pdf-well]:checked'?boxes.filter(box=>box.checked):[];
 a.ctx.pocoPdfSetStatus('pendente');assert.deepEqual(rows.map(row=>row.hidden),[true,false,true,false]);assert.deepEqual(boxes.map(box=>box.checked),[false,true,false,true]);assert.equal(a.nodes['pw-pdf-count'].textContent,'2 de 4 selecionadas');
});
