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
 assert.match(a.nodes.content.innerHTML,/Visualizar por pagamento:/);assert.match(a.nodes.content.innerHTML,/Pagamento pendente \(2\)/);assert.match(a.nodes.content.innerHTML,/Pagamento realizado \(1\)/);assert.match(a.nodes.content.innerHTML,/Situação do pagamento/);
 const requested=a.nodes.content.innerHTML.match(/<article class="pw-card solicitada"[^>]*>[\s\S]*?<\/article>/)[0];assert.doesNotMatch(requested,/PAGAMENTO PENDENTE|Confirmar pagamento/);
 a.ctx.pocoFilter('status','pendente');assert.match(a.nodes['pw-view'].innerHTML,/pw-pay-filter pending active/);assert.doesNotMatch(a.nodes['pw-view'].innerHTML,/pw-local">SOLICITADO|pw-local">PAGO/);assert.match(a.nodes['pw-view'].innerHTML,/pw-local">EXECUTADO/);assert.match(a.nodes['pw-view'].innerHTML,/pw-local">ANTIGO/);
 a.ctx.pocoFilter('status','pago');assert.match(a.nodes['pw-view'].innerHTML,/pw-local">PAGO/);assert.doesNotMatch(a.nodes['pw-view'].innerHTML,/pw-local">EXECUTADO/);
 a.ctx.pocoSetTab('perfuradores');assert.match(a.nodes.content.innerHTML,/>2<\/b>Pendentes/);
});
test('PDF exclui solicitações dos pendentes e preserva o registro na lista',async()=>{
 const a=app();a.ctx.renderPocos('s');await a.ctx.gerarPdfPocos('s',{incluirFotos:false});assert.equal(a.tables.length,2);
 const rows=a.tables[0].body,column=a.tables[0].head[0].indexOf('Pagamento');assert.equal(rows.find(row=>row[1]==='SOLICITADO')[column],'—');assert.equal(rows.find(row=>row[1]==='EXECUTADO')[column],'PENDENTE');assert.equal(rows.find(row=>row[1]==='PAGO')[column],'PAGO');assert.equal(a.tables[1].body[0][3],'2');
});

test('ordenação visual prioriza pagos, executados e solicitados, com fotos primeiro',()=>{
 const a=app();a.ctx.S.subitems.find(p=>p.id==='ANTIGO').extra_fields.imagens=['https://img.test/antigo.jpg'];a.ctx.S.subitems.push({id:'SOLICITADO-FOTO',atividade_id:'s',item_id:'d',description:'SOLICITADO COM FOTO',extra_fields:{registro_tipo:'poco',status_perfuracao:'solicitada',status_pagamento:'pendente',imagens:['https://img.test/solicitado.jpg']}});a.ctx.renderPocos('s');
 const order=[...a.nodes.content.innerHTML.matchAll(/class="pw-local">(.*?)<\/div>/g)].map(match=>match[1]),numbers=[...a.nodes.content.innerHTML.matchAll(/class="pw-num">(.*?)<\/div>/g)].map(match=>match[1]);assert.deepEqual(order,['PAGO','ANTIGO','EXECUTADO','SOLICITADO COM FOTO','SOLICITADO']);assert.deepEqual(numbers,['POÇO 1','POÇO 2','POÇO 3','POÇO 4','POÇO 5']);assert.match(a.nodes.content.innerHTML,/Ordem de exibição/);assert.match(a.nodes.content.innerHTML,/Pagos → executados → solicitados/);assert.doesNotMatch(a.nodes.content.innerHTML,/class="pw-drag-handle"/);
});

test('busca móvel preserva o mesmo campo e o foco durante toda a digitação',()=>{
 const a=app();a.ctx.smartSearchText=(values,q)=>({matched:JSON.stringify(values).toLowerCase().includes(q.toLowerCase())});a.ctx.renderPocos('s');const input={value:'antigo'},list={innerHTML:''},count={textContent:''},viewBefore=a.nodes['pw-view'].innerHTML;a.nodes['pw-search']=input;a.nodes['pw-list']=list;a.nodes['pw-results-count']=count;
 a.ctx.pocoSearch(input);assert.equal(a.nodes['pw-search'],input);assert.equal(a.nodes['pw-view'].innerHTML,viewBefore);assert.match(list.innerHTML,/pw-local">ANTIGO/);assert.doesNotMatch(list.innerHTML,/pw-local">SOLICITADO/);assert.equal(count.textContent,'Exibindo 1 de 4 perfuração(ões)');
});

test('ordem remota prevalece e uma nova escolha é salva no Supabase',async()=>{
 const a=app();a.ctx.S.isAdmin=true;a.ctx.S.secs[0].extra_fields={pocos_ordem_exibicao:'manual'};const writes=[];a.ctx.db={};a.ctx.doc=(db,collection,id)=>({collection,id});a.ctx.serverTimestamp=()=> 'NOW';a.ctx.updateDoc=async(ref,payload)=>{writes.push({ref,payload});};a.ctx.renderPocos('s');assert.match(a.nodes.content.innerHTML,/value="manual" selected/);
 const saved=await a.ctx.pocoFilter('ordem','prioridade'),write=writes.find(entry=>entry.ref.collection==='secretariats');assert.equal(saved,true);assert.equal(write.ref.id,'s');assert.equal(write.payload.pocos_ordem_exibicao,'prioridade');assert.equal(write.payload.updated_at,'NOW');assert.equal(a.ctx.S.secs[0].extra_fields.pocos_ordem_exibicao,'prioridade');assert.match(a.messages.at(-1)[0],/salva no Supabase/);
});

test('opções do PDF oferecem filtro de pagamento e checkbox para cada perfuração',()=>{
 const a=app();a.ctx.renderPocos('s');let modal='';a.ctx.openModal=(title,description,html)=>{modal=title+' '+description+' '+html;};a.ctx.openPocoPdfOptions();
 assert.match(modal,/Somente pagamentos pendentes/);assert.match(modal,/Somente pagamentos realizados/);assert.match(modal,/Solicitações sem pagamento aplicável/);assert.match(modal,/Selecionar exibidas/);assert.equal((modal.match(/data-pw-pdf-well/g)||[]).length,4);assert.match(modal,/POÇO 1/);assert.match(modal,/PAGAMENTO PENDENTE/);
 const positions=['PAGO','EXECUTADO','ANTIGO','SOLICITADO'].map(name=>modal.indexOf(`· ${name}<\/b>`));assert.ok(positions.every(position=>position>=0));assert.ok(positions[0]<positions[1]&&positions[0]<positions[2]&&positions[1]<positions[3]&&positions[2]<positions[3]);assert.match(modal,/seguem exatamente a ordem de exibição/);
});

test('PDF contém somente as perfurações marcadas e na mesma ordem do seletor',async()=>{
 const a=app();a.ctx.renderPocos('s');a.ctx.pocoFilter('status','pago');await a.ctx.gerarPdfPocos(null,{incluirFotos:false,wellIds:['PAGO','EXECUTADO']});
 assert.equal(a.tables.length,2);const descriptions=Array.from(a.tables[0].body,row=>row[1]);assert.deepEqual(descriptions,['PAGO','EXECUTADO']);assert.equal(descriptions.includes('SOLICITADO'),false);assert.equal(descriptions.includes('ANTIGO'),false);
});

test('PDF omite colunas vazias, redistribui largura e incorpora status e vazão',async()=>{
 const a=app();a.ctx.S.items[0].extra_fields.is_placeholder=1;a.ctx.S.fieldTemplates=[{atividade_id:'s',scope:'subitem',field_name:'VAZÃO (LITROS / HORA)',field_type:'text',order_num:0},{atividade_id:'s',scope:'subitem',field_name:'STATUS DO POÇO',field_type:'text',order_num:1}];
 a.ctx.S.subitems[1].observacao='TESTE';a.ctx.S.subitems[1].extra_fields['VAZÃO (LITROS / HORA)']='7000';a.ctx.S.subitems[1].extra_fields['STATUS DO POÇO']='DEU ÁGUA';a.ctx.S.subitems[0].extra_fields['VAZÃO (LITROS / HORA)']='VERIFICAR VAZÃO';
 await a.ctx.gerarPdfPocos('s',{incluirFotos:false});assert.equal(a.tables.length,1);const table=a.tables[0],head=Array.from(table.head[0]);assert.ok(head.includes('Status do poço'));assert.equal(head.includes('Empresa / Perfurador'),false);assert.equal(head.includes('Data pgto.'),false);const status=head.indexOf('Status do poço'),obs=head.indexOf('Observações'),row=table.body.find(item=>item[1]==='EXECUTADO');assert.equal(row[status],'DEU ÁGUA');assert.match(row[obs],/TESTE\nVAZÃO: 7000 LITROS \/ HORA/);const width=Object.values(table.columnStyles).reduce((sum,style)=>sum+style.cellWidth,0);assert.ok(Math.abs(width-253)<.001);
 assert.equal(table.body.find(item=>item[1]==='SOLICITADO')[obs],'VAZÃO: VERIFICAR VAZÃO');
});

test('confirmação exige seleção e envia exatamente os IDs marcados',()=>{
 const a=app();a.ctx.renderPocos('s');a.nodes['pw-pdf-photos']={checked:false};const selected=[{value:'EXECUTADO'},{value:'PAGO'}];a.ctx.document.querySelectorAll=selector=>selector==='[data-pw-pdf-well]:checked'?selected:[];let options=null,closed=false;a.ctx.gerarPdfPocos=(sec,value)=>{options=value;};a.ctx.closeModal=()=>{closed=true;};a.ctx.confirmarPdfPocos();assert.equal(closed,true);assert.deepEqual(Array.from(options.wellIds),['EXECUTADO','PAGO']);assert.equal(options.incluirFotos,false);
 selected.length=0;closed=false;a.ctx.confirmarPdfPocos();assert.equal(closed,false);assert.match(a.messages.at(-1)[0],/Selecione pelo menos uma/);
});

test('filtro pendente exibe e marca apenas pagamentos realmente pendentes',()=>{
 const a=app(),statuses=['solicitada','pendente','pago','pendente'],boxes=statuses.map((status,index)=>({value:String(index),checked:true,status})),rows=statuses.map((status,index)=>({dataset:{pwPdfStatus:status},hidden:false,querySelector:()=>boxes[index]}));a.nodes['pw-pdf-count']={textContent:''};a.ctx.document.querySelectorAll=selector=>selector==='[data-pw-pdf-row]'?rows:selector==='[data-pw-pdf-well]'?boxes:selector==='[data-pw-pdf-well]:checked'?boxes.filter(box=>box.checked):[];
 a.ctx.pocoPdfSetStatus('pendente');assert.deepEqual(rows.map(row=>row.hidden),[true,false,true,false]);assert.deepEqual(boxes.map(box=>box.checked),[false,true,false,true]);assert.equal(a.nodes['pw-pdf-count'].textContent,'2 de 4 selecionadas');
});
