const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function app(){
 const nodes={content:{innerHTML:''},'pw-view':{innerHTML:''}},tables=[],messages=[];
 const well=(id,status,payment)=>({id,atividade_id:'s',item_id:'d',description:id,extra_fields:{registro_tipo:'poco',status_perfuracao:status,status_pagamento:payment}});
 const S={isAdmin:true,secs:[{id:'s'}],items:[{id:'d',atividade_id:'s',description:'EMPRESA',extra_fields:{registro_tipo:'perfurador'}}],subitems:[well('SOLICITADO','solicitada','pendente'),well('EXECUTADO','executada','pendente'),well('PAGO','executada','pago'),well('ANTIGO',undefined,undefined)]};
 const pdf={lastAutoTable:{finalY:80},autoTable(options){tables.push(options);},save(){}};
 for(const name of ['setFont','setFontSize','setTextColor','setFillColor','setDrawColor','rect','roundedRect','text','addPage'])pdf[name]=()=>{};
 const writes=[],stored=JSON.parse(JSON.stringify(S.subitems));
 const ctx={S,URL,console,db:{},serverTimestamp:()=> 'NOW',doc:(db,col,id)=>({col,id}),updateDoc:async(ref,data)=>{writes.push({ref,data});Object.assign(stored.find(p=>p.id===ref.id),data);},loadData:async()=>{S.subitems=JSON.parse(JSON.stringify(stored));},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},document:{createElement:()=>({}),head:{appendChild(){}},getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},toast:(...args)=>messages.push(args),loadB64:async()=>null,jspdf:{jsPDF:function(){return pdf;}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/perfuracao-pocos.js'),'utf8'),ctx);return{ctx,nodes,tables,messages,writes,stored,S};
}

const settle=()=>new Promise(resolve=>setImmediate(resolve));
const labels=html=>[...html.matchAll(/class="pw-num">(.*?)<\/div>/g)].map(m=>m[1]);
const locals=html=>[...html.matchAll(/class="pw-local">(.*?)<\/div>/g)].map(m=>m[1]);
test('numeração inicial automática, arraste persistido e mesma ordem no PDF',async()=>{
 const a=app();a.ctx.renderPocos('s');await settle();
 assert.deepEqual(labels(a.nodes.content.innerHTML),['POÇO 1','POÇO 2','POÇO 3','POÇO 4']);
 assert.equal(a.writes.length,4);assert.deepEqual(a.stored.map(p=>p.numero).sort(),['POÇO 1','POÇO 2','POÇO 3','POÇO 4']);
 const old=locals(a.nodes.content.innerHTML);await a.ctx.pocoReorder(old[3],old[0]);
 assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),[old[3],...old.slice(0,3)]);
 assert.deepEqual(labels(a.nodes['pw-view'].innerHTML),['POÇO 1','POÇO 2','POÇO 3','POÇO 4']);
 await a.ctx.loadData();a.ctx.renderPocos('s');await settle();
 assert.deepEqual(locals(a.nodes.content.innerHTML),[old[3],...old.slice(0,3)]);
 await a.ctx.gerarPdfPocos('s',{incluirFotos:false});assert.deepEqual(Array.from(a.tables[0].body,row=>row[0]),['POÇO 1','POÇO 2','POÇO 3','POÇO 4']);assert.equal(a.tables[0].body[0][1],old[3]);
 const writes=a.writes.length;a.ctx.renderPocos('s');await settle();assert.equal(a.writes.length,writes);
});
test('arraste com filtros mantém registros ocultos, identificação e dados intactos',async()=>{
 const a=app();a.ctx.renderPocos('s');await settle();a.ctx.pocoFilter('status','pendente');
 assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),['ANTIGO','EXECUTADO']);
 await a.ctx.pocoReorder('EXECUTADO','ANTIGO');
 assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),['EXECUTADO','ANTIGO']);
 a.ctx.pocoFilter('status','todos');assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),['EXECUTADO','ANTIGO','PAGO','SOLICITADO']);
 assert.equal(a.stored.find(p=>p.id==='PAGO').extra_fields.status_pagamento,'pago');assert.equal(a.stored.find(p=>p.id==='SOLICITADO').extra_fields.status_perfuracao,'solicitada');assert.equal(a.stored.length,4);
});
test('eventos de arraste movem abaixo do alvo e remoção fecha lacuna na sequência',async()=>{
 const a=app();a.ctx.renderPocos('s');await settle();
 a.ctx.pocoDragStart({dataTransfer:{setData(){}},preventDefault(){assert.fail();}},'ANTIGO');
 await a.ctx.pocoDrop({preventDefault(){},clientY:90,currentTarget:{getBoundingClientRect:()=>({top:0,height:100})}},'SOLICITADO');
 assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),['EXECUTADO','PAGO','SOLICITADO','ANTIGO']);
 a.ctx.deleteDoc=async ref=>{a.stored.splice(a.stored.findIndex(p=>p.id===ref.id),1);};await a.ctx.deletePoco('PAGO');
 assert.deepEqual(labels(a.nodes.content.innerHTML),['POÇO 1','POÇO 2','POÇO 3']);assert.deepEqual(a.stored.map(p=>p.numero).sort(),['POÇO 1','POÇO 2','POÇO 3']);
});
test('falha de gravação é informada e não simula sucesso; sem permissão não reorganiza',async()=>{
 const a=app();a.ctx.renderPocos('s');await settle();const previous=locals(a.nodes.content.innerHTML);
 a.ctx.updateDoc=async()=>{throw Error('Falha simulada');};await a.ctx.pocoReorder('SOLICITADO','ANTIGO');
 assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),previous);assert.match(a.messages.at(-1)[0],/Erro ao reorganizar/);
 a.S.isAdmin=false;a.ctx.updateDoc=()=>assert.fail('Sem permissão');await a.ctx.pocoReorder('SOLICITADO','ANTIGO');assert.deepEqual(locals(a.nodes['pw-view'].innerHTML),previous);
});
test('novos poços entram no fim e editar a data não muda a ordem escolhida',async()=>{
 const a=app();a.ctx.renderPocos('s');await settle();
 const fields={'pw-local':'novo local','pw-data':'2020-01-01','pw-status':'pendente','pw-status-perfuracao':'executada','pw-perfurador':'d','pw-representante':'maria','pw-obs':'observação','pw-valor':'12'};
 for(const [id,value] of Object.entries(fields))a.nodes[id]={value};
 a.ctx.collection=()=>({});a.ctx.addDoc=async(ref,payload)=>a.stored.push({id:'NEW',...payload});a.ctx.closeModal=()=>{};
 await a.ctx.savePoco('');assert.deepEqual(locals(a.nodes.content.innerHTML),['ANTIGO','EXECUTADO','PAGO','SOLICITADO','NOVO LOCAL']);
 assert.equal(a.stored.find(p=>p.id==='NEW').numero,'POÇO 5');assert.equal(a.stored.find(p=>p.id==='NEW').responsaveis,'MARIA');
 await a.ctx.savePoco('EXECUTADO');assert.deepEqual(a.S.subitems.slice().sort((x,y)=>x.poco_order-y.poco_order).map(p=>p.id),['ANTIGO','EXECUTADO','PAGO','SOLICITADO','NEW']);
 a.nodes['pw-data'].closest=()=>null;let modal='';a.ctx.openModal=(title,desc,html)=>{modal=html;};a.ctx.openPocoModal('NEW');assert.match(modal,/id="pw-numero" value="POÇO 5" readonly/);
});
